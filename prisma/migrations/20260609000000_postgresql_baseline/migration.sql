-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('fiscal', 'monitor', 'supervisor');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ativo', 'inativo');

-- CreateEnum
CREATE TYPE "StatusOS" AS ENUM ('NaFila', 'EmExecucao', 'Pendente', 'Concluida', 'Cancelada');

-- CreateEnum
CREATE TYPE "TipoServico" AS ENUM ('LigacaoAgua', 'ReligacaoAgua', 'CorteAgua', 'TrocaHidrometro', 'Vistoria', 'ReparoRede', 'Outros');

-- CreateEnum
CREATE TYPE "Conceito" AS ENUM ('A', 'B', 'C', 'D', 'NaoAvaliado');

-- CreateEnum
CREATE TYPE "EventoLog" AS ENUM ('importacao', 'atribuicao', 'reatribuicao', 'status', 'tabulacao', 'usuario', 'sync');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "status" "StatusUsuario" NOT NULL DEFAULT 'ativo',
    "poloId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Polo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Polo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPoloAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poloId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPoloAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "enderecoCompleto" TEXT NOT NULL,
    "numeroImovel" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "regiaoAdministrativa" TEXT,
    "tipoServico" "TipoServico" NOT NULL,
    "status" "StatusOS" NOT NULL DEFAULT 'NaFila',
    "poloId" TEXT NOT NULL,
    "fiscalId" TEXT,
    "unidadeExecutante" TEXT,
    "codigoContrato" TEXT,
    "descricaoContrato" TEXT,
    "codigoTss" TEXT,
    "descricaoTss" TEXT,
    "codigoTse" TEXT,
    "descricaoTse" TEXT,
    "pde" TEXT,
    "equipe" TEXT,
    "observacao" TEXT,
    "dataProgramada" TIMESTAMP(3),
    "dataInicioExecucao" TIMESTAMP(3),
    "dataFimExecucao" TIMESTAMP(3),
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdemServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tabulacao" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "fiscalId" TEXT NOT NULL,
    "respostas" JSONB NOT NULL,
    "somaObtida" DOUBLE PRECISION NOT NULL,
    "somaPossivel" DOUBLE PRECISION NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL,
    "conceito" "Conceito" NOT NULL,
    "observacoes" TEXT,
    "bloqueada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tabulacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "tabulacaoId" TEXT NOT NULL,
    "avaliadorId" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAtividade" (
    "id" TEXT NOT NULL,
    "evento" "EventoLog" NOT NULL,
    "descricao" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "ordemServicoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAtividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigSync" (
    "id" TEXT NOT NULL,
    "caminhoRede" TEXT,
    "intervaloMin" INTEGER NOT NULL DEFAULT 60,
    "formato" TEXT NOT NULL DEFAULT 'ambos',
    "autoBackup" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRegistro" (
    "id" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "sucesso" BOOLEAN NOT NULL,
    "mensagem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_matricula_key" ON "User"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Polo_nome_key" ON "Polo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Polo_codigo_key" ON "Polo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "UserPoloAccess_userId_poloId_key" ON "UserPoloAccess"("userId", "poloId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_numero_key" ON "OrdemServico"("numero");

-- CreateIndex
CREATE INDEX "OrdemServico_fiscalId_status_idx" ON "OrdemServico"("fiscalId", "status");

-- CreateIndex
CREATE INDEX "OrdemServico_poloId_status_fiscalId_dataProgramada_createdA_idx" ON "OrdemServico"("poloId", "status", "fiscalId", "dataProgramada", "createdAt");

-- CreateIndex
CREATE INDEX "OrdemServico_createdAt_idx" ON "OrdemServico"("createdAt");

-- PostgreSQL-specific partial indexes for the automatic queue hot paths.
CREATE INDEX "OrdemServico_available_queue_idx"
ON "OrdemServico"("poloId", "dataProgramada", "createdAt")
WHERE "status" = 'NaFila' AND "fiscalId" IS NULL;

CREATE INDEX "OrdemServico_open_fiscal_idx"
ON "OrdemServico"("fiscalId", "status")
WHERE "fiscalId" IS NOT NULL
  AND "status" IN ('NaFila', 'EmExecucao', 'Pendente');

CREATE UNIQUE INDEX "OrdemServico_one_open_per_fiscal_idx"
ON "OrdemServico"("fiscalId")
WHERE "fiscalId" IS NOT NULL
  AND "status" IN ('NaFila', 'EmExecucao', 'Pendente');

-- CreateIndex
CREATE UNIQUE INDEX "Tabulacao_ordemServicoId_key" ON "Tabulacao"("ordemServicoId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_poloId_fkey" FOREIGN KEY ("poloId") REFERENCES "Polo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPoloAccess" ADD CONSTRAINT "UserPoloAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPoloAccess" ADD CONSTRAINT "UserPoloAccess_poloId_fkey" FOREIGN KEY ("poloId") REFERENCES "Polo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_poloId_fkey" FOREIGN KEY ("poloId") REFERENCES "Polo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_fiscalId_fkey" FOREIGN KEY ("fiscalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tabulacao" ADD CONSTRAINT "Tabulacao_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tabulacao" ADD CONSTRAINT "Tabulacao_fiscalId_fkey" FOREIGN KEY ("fiscalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_tabulacaoId_fkey" FOREIGN KEY ("tabulacaoId") REFERENCES "Tabulacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_avaliadorId_fkey" FOREIGN KEY ("avaliadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAtividade" ADD CONSTRAINT "LogAtividade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAtividade" ADD CONSTRAINT "LogAtividade_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
