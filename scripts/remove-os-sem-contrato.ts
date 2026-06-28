/**
 * Remove OS importadas "sem contrato/empresa" — registros em que tanto
 * `codigoContrato` quanto `descricaoContrato` estão vazios (a coluna de contrato
 * veio em branco na planilha). Essas OS não têm contratada identificável e
 * poluem o relatório "Por Contratada".
 *
 * A remoção é física e cuida das dependências sem cascade no schema:
 * Avaliacao → Tabulacao → LogAtividade → OrdemServico, tudo numa transação.
 *
 * Uso:
 *   tsx scripts/remove-os-sem-contrato.ts            # dry-run: só lista
 *   tsx scripts/remove-os-sem-contrato.ts --apply    # executa a remoção
 *
 * Requer DATABASE_URL apontando para o banco alvo (ex.: produção no VPS).
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// "Sem contrato" = ambos os campos de contrato nulos ou string vazia.
const semContratoWhere: Prisma.OrdemServicoWhereInput = {
  AND: [
    { OR: [{ codigoContrato: null }, { codigoContrato: "" }] },
    { OR: [{ descricaoContrato: null }, { descricaoContrato: "" }] }
  ]
};

async function main() {
  const alvo = await prisma.ordemServico.findMany({
    where: semContratoWhere,
    select: {
      id: true,
      numero: true,
      status: true,
      enderecoCompleto: true,
      codigoContrato: true,
      descricaoContrato: true,
      polo: { select: { nome: true } },
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`OS sem contrato encontradas: ${alvo.length}`);
  for (const os of alvo) {
    console.log(
      `  ${os.numero}\t[${os.status}]\tpolo=${os.polo?.nome ?? "—"}\t${os.enderecoCompleto}`
    );
  }

  if (alvo.length === 0) {
    console.log("Nada a remover.");
    return;
  }

  if (!APPLY) {
    console.log("\nDry-run. Para remover de fato, rode novamente com --apply.");
    return;
  }

  const ids = alvo.map((os) => os.id);
  const tabulacoes = await prisma.tabulacao.findMany({
    where: { ordemServicoId: { in: ids } },
    select: { id: true }
  });
  const tabulacaoIds = tabulacoes.map((t) => t.id);

  const resultado = await prisma.$transaction(async (tx) => {
    const avaliacoes =
      tabulacaoIds.length > 0
        ? await tx.avaliacao.deleteMany({ where: { tabulacaoId: { in: tabulacaoIds } } })
        : { count: 0 };
    const tab = await tx.tabulacao.deleteMany({ where: { ordemServicoId: { in: ids } } });
    const logs = await tx.logAtividade.deleteMany({ where: { ordemServicoId: { in: ids } } });
    const os = await tx.ordemServico.deleteMany({ where: { id: { in: ids } } });
    return { avaliacoes: avaliacoes.count, tabulacoes: tab.count, logs: logs.count, os: os.count };
  });

  console.log(
    `\nRemovidas: ${resultado.os} OS, ${resultado.tabulacoes} tabulações, ` +
      `${resultado.avaliacoes} avaliações, ${resultado.logs} logs.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
