-- Duplicidade de OS passa a ser definida por (numero, codigoTss, codigoTse):
-- a mesma OS (numero) com TSS/TSE diferentes deixa de ser tratada como duplicata,
-- então o numero sozinho não é mais único.
DROP INDEX "OrdemServico_numero_key";

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_numero_codigoTss_codigoTse_key" ON "OrdemServico"("numero", "codigoTss", "codigoTse");
