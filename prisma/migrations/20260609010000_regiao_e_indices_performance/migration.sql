-- Adds the região hierarchy fields (Polo.regiao source of truth, User.regiao for
-- monitor scope) and the time/região/throughput indexes used by the operational
-- dashboard and the daily 20k+ OS ingest.
--
-- PRODUCTION NOTE (large OrdemServico table): the `CREATE INDEX` statements below
-- take an ACCESS EXCLUSIVE-style lock and will block writes while they build. On a
-- table with hundreds of thousands of rows, build each of the OrdemServico indexes
-- out-of-band with `CREATE INDEX CONCURRENTLY` (cannot run inside a migration
-- transaction) and then `prisma migrate resolve --applied 20260609010000_regiao_e_indices_performance`.
-- The dev/demo databases are small, so the in-transaction form here is fine there.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "regiao" TEXT;

-- AlterTable
ALTER TABLE "Polo" ADD COLUMN     "regiao" TEXT;

-- CreateIndex
CREATE INDEX "Polo_regiao_idx" ON "Polo"("regiao");

-- CreateIndex
CREATE INDEX "OrdemServico_regiaoAdministrativa_cidade_idx" ON "OrdemServico"("regiaoAdministrativa", "cidade");

-- CreateIndex
CREATE INDEX "OrdemServico_regiaoAdministrativa_status_createdAt_idx" ON "OrdemServico"("regiaoAdministrativa", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OrdemServico_concluidaEm_idx" ON "OrdemServico"("concluidaEm");

-- CreateIndex
CREATE INDEX "OrdemServico_status_updatedAt_idx" ON "OrdemServico"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "OrdemServico_fiscalId_status_concluidaEm_idx" ON "OrdemServico"("fiscalId", "status", "concluidaEm");

-- CreateIndex
CREATE INDEX "OrdemServico_poloId_tipoServico_idx" ON "OrdemServico"("poloId", "tipoServico");

-- CreateIndex
CREATE INDEX "Tabulacao_fiscalId_idx" ON "Tabulacao"("fiscalId");

-- CreateIndex
CREATE INDEX "Tabulacao_createdAt_idx" ON "Tabulacao"("createdAt");

-- CreateIndex
CREATE INDEX "LogAtividade_ordemServicoId_idx" ON "LogAtividade"("ordemServicoId");

-- CreateIndex
CREATE INDEX "LogAtividade_userId_idx" ON "LogAtividade"("userId");

-- CreateIndex
CREATE INDEX "LogAtividade_createdAt_idx" ON "LogAtividade"("createdAt");
