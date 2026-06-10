-- Registro de quem tabulou o serviço (separado do fiscal responsável pela OS,
-- já que monitor/supervisor também podem tabular) e rastreio de alterações
-- feitas após a tabulação inicial (quem alterou e o motivo), exposto na exportação.
ALTER TABLE "Tabulacao"
  ADD COLUMN IF NOT EXISTS "tabuladoPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "alterada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "alteradoPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoAlteracao" TEXT,
  ADD COLUMN IF NOT EXISTS "alteradaEm" TIMESTAMP(3);

ALTER TABLE "Tabulacao"
  ADD CONSTRAINT "Tabulacao_tabuladoPorId_fkey"
  FOREIGN KEY ("tabuladoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tabulacao"
  ADD CONSTRAINT "Tabulacao_alteradoPorId_fkey"
  FOREIGN KEY ("alteradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
