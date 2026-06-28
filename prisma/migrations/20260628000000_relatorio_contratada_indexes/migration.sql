-- Índices para o relatório executivo / "Não Conformidades por Contratada":
--   - dataFimExecucao: período do relatório/dashboard é fatiado pela data real de execução.
--   - codigoContrato / unidadeExecutante: filtros e agregações por contratada.
--
-- PRODUCTION NOTE (OrdemServico grande): CREATE INDEX pega ACCESS EXCLUSIVE por um
-- instante. Em tabela muito grande, prefira rodar `CREATE INDEX CONCURRENTLY ...`
-- fora de transação e depois
-- `prisma migrate resolve --applied 20260628000000_relatorio_contratada_indexes`.
-- Em dev/demo (bases pequenas) a forma in-transaction abaixo é suficiente.

-- CreateIndex
CREATE INDEX "OrdemServico_dataFimExecucao_idx" ON "OrdemServico"("dataFimExecucao");

-- CreateIndex
CREATE INDEX "OrdemServico_codigoContrato_idx" ON "OrdemServico"("codigoContrato");

-- CreateIndex
CREATE INDEX "OrdemServico_unidadeExecutante_idx" ON "OrdemServico"("unidadeExecutante");
