-- Redefine TipoServico to match the FFR form (Formulário_FFR_v2026_04_06.xlsx, aba "FFR"):
-- 6 categorias oficiais + "Outros" (catch-all). Postgres não remove valores de enum,
-- então renomeamos o tipo antigo, criamos o novo e convertemos a coluna com CASE.
--
-- A conversão prioriza a Descrição TSS (texto livre da Sabesp). Os padrões ILIKE usam
-- radicais que evitam letras acentuadas (ex.: "relig" casa "RELIGAÇÃO", "asf" casa
-- "ASFÁLTICA", "gua"/"liga" cobrem "ÁGUA"/"LIGAÇÃO"), para tolerar acentuação sem
-- depender da extensão unaccent. Quando a Descrição TSS não casa (ou é nula), cai no
-- mapeamento exato do enum antigo. Ordem importa: regras específicas antes das amplas
-- (CavaleteHidrometro com "relig" antes de RedeRamalAgua com "liga").

ALTER TYPE "TipoServico" RENAME TO "TipoServico_old";

CREATE TYPE "TipoServico" AS ENUM (
  'RedeRamalAgua',
  'CavaleteHidrometro',
  'RedeRamalEsgoto',
  'Desobstrucao',
  'ReposicaoPiso',
  'ReposicaoAsfaltica',
  'Outros'
);

ALTER TABLE "OrdemServico"
  ALTER COLUMN "tipoServico" TYPE "TipoServico"
  USING (
    CASE
      WHEN "descricaoTss" ILIKE '%esgoto%' OR "descricaoTss" ILIKE '%coletor%'
        THEN 'RedeRamalEsgoto'
      WHEN "descricaoTss" ILIKE '%desobstru%' OR "descricaoTss" ILIKE '%lavagem%'
        THEN 'Desobstrucao'
      WHEN "descricaoTss" ILIKE '%asf%'
        THEN 'ReposicaoAsfaltica'
      WHEN "descricaoTss" ILIKE '%piso%' OR "descricaoTss" ILIKE '%passeio%'
        OR "descricaoTss" ILIKE '%bloquete%' OR "descricaoTss" ILIKE '%paralelep%'
        THEN 'ReposicaoPiso'
      WHEN "descricaoTss" ILIKE '%relig%' OR "descricaoTss" ILIKE '%corte%'
        OR "descricaoTss" ILIKE '%hidr%' OR "descricaoTss" ILIKE '%cavalete%'
        THEN 'CavaleteHidrometro'
      WHEN "descricaoTss" ILIKE '%liga%' OR "descricaoTss" ILIKE '%ramal%'
        OR "descricaoTss" ILIKE '%reparo%' OR "descricaoTss" ILIKE '%vazamento%'
        OR "descricaoTss" ILIKE '%gua%'
        THEN 'RedeRamalAgua'
      WHEN "tipoServico"::text IN ('LigacaoAgua', 'ReparoRede')
        THEN 'RedeRamalAgua'
      WHEN "tipoServico"::text IN ('ReligacaoAgua', 'CorteAgua', 'TrocaHidrometro')
        THEN 'CavaleteHidrometro'
      ELSE 'Outros'
    END::"TipoServico"
  );

DROP TYPE "TipoServico_old";
