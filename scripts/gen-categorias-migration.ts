// Gera o SQL da migração de recategorização a partir da fonte de verdade
// (src/data/categorias-servico.ts), garantindo que as listas IN(...) do CASE
// batam exatamente com o runtime.
//
// Dois modos:
//   npx tsx scripts/gen-categorias-migration.ts
//     → variante DESTRUTIVA (padrão): exclui OS fora de escopo + dependentes.
//   npx tsx scripts/gen-categorias-migration.ts --keep-off-table
//     → variante NÃO DESTRUTIVA: mantém OS fora de escopo num balde `SemCategoria`
//       (adiciona o 9º valor ao enum), sem apagar nada.
import { categoriaPorCodigoMap } from "../src/data/categorias-servico";
import type { TipoServico } from "@prisma/client";

const keepOffTable = process.argv.includes("--keep-off-table");

const NOVAS: string[] = [
  "RedeAgua",
  "RamalAgua",
  "CavaleteHidrometro",
  "RedeRamalEsgoto",
  "Desobstrucao",
  "LavagemEee",
  "ReposicaoPiso",
  "ReposicaoAsfaltica"
];

// Valores do enum a criar. Na variante não destrutiva, acrescenta o balde.
const enumValues = keepOffTable ? [...NOVAS, "SemCategoria"] : NOVAS;

const codigosPorCategoria = new Map<string, string[]>(NOVAS.map((c) => [c, []]));
for (const [codigo, categoria] of Object.entries(categoriaPorCodigoMap)) {
  codigosPorCategoria.get(categoria as TipoServico)!.push(codigo);
}

const todos = Object.keys(categoriaPorCodigoMap);
const inList = (codes: string[]) => codes.map((c) => `'${c}'`).join(", ");

// Predicado de "fora de escopo": nenhum código (TSS/TSE) consta na tabela.
const foraDeEscopo =
  `("codigoTss" IS NULL OR "codigoTss" NOT IN (${inList(todos)}))\n` +
  `    AND ("codigoTse" IS NULL OR "codigoTse" NOT IN (${inList(todos)}))`;
const foraOs = foraDeEscopo.replace(/"codigo/g, 'o."codigo');

// CASE que replica categoriaPorCodigo: TSS primeiro (todas as categorias), depois TSE.
const whenBlocos: string[] = [];
for (const col of ["codigoTss", "codigoTse"] as const) {
  for (const categoria of NOVAS) {
    const codes = codigosPorCategoria.get(categoria)!;
    whenBlocos.push(`      WHEN "${col}" IN (${inList(codes)})\n        THEN '${categoria}'`);
  }
}
// Off-table: na variante destrutiva já não existem (DELETE antes), o ELSE é defensivo.
// Na não destrutiva, off-table cai no balde SemCategoria.
const elseValue = keepOffTable ? "SemCategoria" : "RedeAgua";

const deleteSteps = `-- 1. Apagar OS fora de escopo e suas dependentes (FKs sem ON DELETE CASCADE).
DELETE FROM "Avaliacao"
WHERE "tabulacaoId" IN (
  SELECT t."id" FROM "Tabulacao" t
  JOIN "OrdemServico" o ON o."id" = t."ordemServicoId"
  WHERE ${foraOs}
);

DELETE FROM "Tabulacao"
WHERE "ordemServicoId" IN (
  SELECT o."id" FROM "OrdemServico" o
  WHERE ${foraOs}
);

UPDATE "LogAtividade"
SET "ordemServicoId" = NULL
WHERE "ordemServicoId" IN (
  SELECT o."id" FROM "OrdemServico" o
  WHERE ${foraOs}
);

DELETE FROM "OrdemServico" o
WHERE ${foraOs};

`;

const headerDestrutiva = `-- Recategorização de serviços por código fixo (tabela Sabesp). Passos:
--   1. Excluir OS fora de escopo (código não consta na tabela) e suas dependentes.
--   2. Redefinir o enum TipoServico para as 8 categorias definitivas (com LavagemEee).
--   3. Converter a coluna com CASE pelas listas de códigos (TSS primeiro, depois TSE).
-- ATENÇÃO (prod): DESTRUTIVO — faça pg_dump antes do deploy.
-- Gerado por scripts/gen-categorias-migration.ts; não editar à mão.`;

const headerNaoDestrutiva = `-- Recategorização de serviços por código fixo (tabela Sabesp) — variante NÃO DESTRUTIVA.
--   1. NÃO apaga nada: OS fora de escopo são preservadas.
--   2. Redefine o enum para as 8 categorias + 'SemCategoria' (balde de fora de escopo).
--   3. Converte a coluna com CASE; o que não casa nenhum código vira 'SemCategoria'.
-- Requer que schema.prisma inclua o valor 'SemCategoria' no enum TipoServico
-- (e que o client seja regenerado), senão o app falha ao ler essas linhas.
-- Gerado por scripts/gen-categorias-migration.ts --keep-off-table; não editar à mão.`;

const sql = `${keepOffTable ? headerNaoDestrutiva : headerDestrutiva}

${keepOffTable ? "" : deleteSteps}-- Redefinir o enum (Postgres não remove valores de enum: renomear → criar → converter → dropar).
ALTER TYPE "TipoServico" RENAME TO "TipoServico_old";

CREATE TYPE "TipoServico" AS ENUM (
${enumValues.map((c) => `  '${c}'`).join(",\n")}
);

ALTER TABLE "OrdemServico"
  ALTER COLUMN "tipoServico" TYPE "TipoServico"
  USING (
    CASE
${whenBlocos.join("\n")}
      ELSE '${elseValue}'
    END::"TipoServico"
  );

DROP TYPE "TipoServico_old";
`;

process.stdout.write(sql);
