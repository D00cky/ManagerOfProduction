// Relatório READ-ONLY do impacto da migração `categorias_por_codigo` antes de aplicá-la.
// Usa exatamente a mesma lógica de runtime (categoriaPorCodigo) que a migração replica,
// então as contagens batem com o que a migração faria: quantas OS seriam EXCLUÍDAS
// (código fora da tabela) e como as restantes se distribuiriam nas 8 categorias.
//
// NÃO escreve nada no banco — apenas SELECTs. Aponte para um restore do pg_dump
// (recomendado) ou para a própria base, via DATABASE_URL:
//   DATABASE_URL="postgresql://user:pass@host:5432/db" npx tsx scripts/check-recategorizacao-impacto.ts
import { PrismaClient } from "@prisma/client";
import { categoriaPorCodigo } from "../src/data/categorias-servico";

const prisma = new PrismaClient();

type Grupo = { codigoTss: string | null; codigoTse: string | null; n: number };

async function main() {
  // Uma linha por combinação (codigoTss, codigoTse) com a contagem — pequeno o
  // suficiente para resolver a categoria em JS com a função canônica.
  const grupos = await prisma.$queryRaw<Grupo[]>`
    SELECT "codigoTss", "codigoTse", count(*)::int AS n
    FROM "OrdemServico"
    GROUP BY "codigoTss", "codigoTse"
  `;

  let total = 0;
  let excluidas = 0;
  let semTssEnenhum = 0; // sem codigoTss E sem codigoTse (mais críticas)
  const porCategoria = new Map<string, number>();
  const offTablePorCodigo = new Map<string, number>(); // codigoTss (ou TSE) das que cairiam fora

  for (const g of grupos) {
    total += g.n;
    const categoria = categoriaPorCodigo(g.codigoTss, g.codigoTse);
    if (categoria) {
      porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + g.n);
    } else {
      excluidas += g.n;
      if (g.codigoTss == null && g.codigoTse == null) semTssEnenhum += g.n;
      const chave = (g.codigoTss ?? "").trim() || (g.codigoTse ?? "").trim() || "(sem código)";
      offTablePorCodigo.set(chave, (offTablePorCodigo.get(chave) ?? 0) + g.n);
    }
  }

  const mantidas = total - excluidas;
  const pct = (n: number) => (total === 0 ? "0" : ((n / total) * 100).toFixed(1));

  console.log("==================================================================");
  console.log(" IMPACTO DA MIGRAÇÃO categorias_por_codigo (READ-ONLY, nada alterado)");
  console.log("==================================================================");
  console.log(`Total de OS no banco:        ${total}`);
  console.log(`Seriam MANTIDAS (em escopo): ${mantidas}  (${pct(mantidas)}%)`);
  console.log(`Seriam EXCLUÍDAS (fora):     ${excluidas}  (${pct(excluidas)}%)`);
  console.log(`  └─ destas, sem nenhum código (TSS e TSE nulos): ${semTssEnenhum}`);
  console.log("");
  console.log("Distribuição das MANTIDAS por nova categoria:");
  for (const [cat, n] of [...porCategoria.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(20)} ${String(n).padStart(8)}  (${pct(n)}%)`);
  }
  console.log("");
  console.log("Top 30 códigos que seriam EXCLUÍDOS (fora da tabela), por volume:");
  console.log("(revise — se algum destes deveria ser mantido, falta na tabela de códigos)");
  const top = [...offTablePorCodigo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  for (const [codigo, n] of top) {
    console.log(`  ${codigo.padEnd(16)} ${String(n).padStart(8)}`);
  }
  if (offTablePorCodigo.size > 30) {
    console.log(`  ... e mais ${offTablePorCodigo.size - 30} códigos distintos.`);
  }
  console.log("==================================================================");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
