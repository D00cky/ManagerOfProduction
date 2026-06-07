import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  // A couple of sample OS: one unassigned (ready to atribuir), one already with the fiscal.
  await prisma.ordemServico.upsert({
    where: { numero: "OS-1001" },
    update: {},
    create: {
      numero: "OS-1001",
      enderecoCompleto: "Rua das Flores, 100",
      bairro: "Centro",
      cidade: "Cidade Teste",
      tipoServico: "LigacaoAgua",
      poloId: polo.id
    }
  });

  await prisma.ordemServico.upsert({
    where: { numero: "OS-1002" },
    update: {},
    create: {
      numero: "OS-1002",
      enderecoCompleto: "Av. Brasil, 200",
      bairro: "Jardim",
      cidade: "Cidade Teste",
      tipoServico: "Vistoria",
      poloId: polo.id,
      fiscalId: fiscal.id
    }
  });

  console.log("Seed concluido. Usuarios:");
  console.log(`  supervisor@example.com / ${supervisor.matricula}`);
  console.log(`  monitor@example.com    / ${monitor.matricula}`);
  console.log(`  fiscal@example.com     / ${fiscal.matricula}`);
  console.log(`  senha: ${password}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
