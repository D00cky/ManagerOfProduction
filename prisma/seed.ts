import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { demoOrdensServico } from "../src/data/demo-os";

const prisma = new PrismaClient();

// Default password for every seeded account. Override with SEED_PASSWORD.
// Intended for local/ephemeral test environments only.
const password = process.env.SEED_PASSWORD ?? "senha123";

async function main() {
  const passwordHash = bcrypt.hashSync(password, 10);

  const polo = await prisma.polo.upsert({
    where: { codigo: "POLO-01" },
    update: {},
    create: { nome: "Polo Central", codigo: "POLO-01" }
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@example.com" },
    update: { passwordHash, perfil: "supervisor", status: "ativo" },
    create: {
      name: "Supervisor Teste",
      email: "supervisor@example.com",
      matricula: "S0001",
      passwordHash,
      perfil: "supervisor"
    }
  });

  const monitor = await prisma.user.upsert({
    where: { email: "monitor@example.com" },
    update: { passwordHash, perfil: "monitor", status: "ativo", poloId: polo.id },
    create: {
      name: "Monitor Teste",
      email: "monitor@example.com",
      matricula: "M0001",
      passwordHash,
      perfil: "monitor",
      poloId: polo.id
    }
  });

  const fiscal = await prisma.user.upsert({
    where: { email: "fiscal@example.com" },
    update: { passwordHash, perfil: "fiscal", status: "ativo", poloId: polo.id },
    create: {
      name: "Fiscal Teste",
      email: "fiscal@example.com",
      matricula: "F0001",
      passwordHash,
      perfil: "fiscal",
      poloId: polo.id
    }
  });

  // Monitor can see the polo it manages.
  await prisma.userPoloAccess.upsert({
    where: { userId_poloId: { userId: monitor.id, poloId: polo.id } },
    update: {},
    create: { userId: monitor.id, poloId: polo.id }
  });

  const fiscais = new Map([[fiscal.matricula, fiscal.id]]);
  for (const ordem of demoOrdensServico) {
    await prisma.ordemServico.upsert({
      where: { numero: ordem.numero },
      update: {},
      create: {
        numero: ordem.numero,
        enderecoCompleto: ordem.enderecoCompleto,
        bairro: ordem.bairro,
        cidade: ordem.cidade,
        tipoServico: ordem.tipoServico,
        status: ordem.status,
        poloId: polo.id,
        fiscalId: ordem.fiscalMatricula ? fiscais.get(ordem.fiscalMatricula) ?? null : null,
        observacao: ordem.observacao ?? null
      }
    });
  }

  console.log("Seed concluido. Usuarios:");
  console.log(`  supervisor@example.com / ${supervisor.matricula}`);
  console.log(`  monitor@example.com    / ${monitor.matricula}`);
  console.log(`  fiscal@example.com     / ${fiscal.matricula}`);
  console.log(`  senha: ${password}`);
  console.log(`  OS demo: ${demoOrdensServico.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
