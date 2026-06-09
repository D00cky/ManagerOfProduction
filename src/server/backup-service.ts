import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { BackupRegistro } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import type { SessionUserScope } from "@/lib/scope";
import { prismaBackupRepository } from "@/server/prisma-backup-repository";

export type BackupConfig = {
  caminhoRede: string | null;
  autoBackup: boolean;
};

export type BackupCreate = {
  destino: string;
  formato: string;
  caminho: string;
  sucesso: boolean;
  mensagem?: string | null;
};

export type BackupRepository = {
  getConfig(): Promise<BackupConfig | null>;
  createBackupRegistro(input: BackupCreate): Promise<BackupRegistro>;
};

export type BackupStorage = {
  ensureDir(path: string): void;
};

export type BackupProcess = {
  pgDump(input: { databaseUrl: string; destination: string }): void;
};

export type BackupOptions = {
  databaseUrl?: string;
  destinoFallback?: string;
  mode?: "manual" | "automatico";
  now?: Date;
};

export const nodeBackupStorage: BackupStorage = {
  ensureDir(directory) {
    mkdirSync(directory, { recursive: true });
  }
};

export const nodeBackupProcess: BackupProcess = {
  pgDump({ databaseUrl, destination }) {
    execFileSync("pg_dump", ["--format=custom", "--file", destination], {
      stdio: "pipe",
      env: { ...process.env, PGDATABASE: databaseUrl }
    });
  }
};

function isPostgresqlUrl(databaseUrl: string) {
  return databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");
}

export async function executarBackup(
  repository: BackupRepository,
  storage: BackupStorage,
  processRunner: BackupProcess,
  options: BackupOptions = {}
) {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL nao configurado");
  if (!isPostgresqlUrl(databaseUrl)) throw new Error("Backup exige DATABASE_URL PostgreSQL");

  const config = await repository.getConfig();
  const destino = config?.caminhoRede ?? options.destinoFallback ?? process.env.BACKUP_LOCAL_DIR ?? "./backups";

  if (options.mode === "automatico" && config?.autoBackup === false) {
    return repository.createBackupRegistro({
      destino,
      formato: "postgresql-custom",
      caminho: "",
      sucesso: false,
      mensagem: "Backup automatico desativado"
    });
  }

  const now = options.now ?? new Date();
  const filename = `manager-of-production-${now.toISOString().replace(/[:.]/g, "-")}.dump`;
  const destination = path.join(destino, filename);

  try {
    storage.ensureDir(destino);
    processRunner.pgDump({ databaseUrl, destination });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro ao executar backup";
    return repository.createBackupRegistro({
      destino,
      formato: "postgresql-custom",
      caminho: destination,
      sucesso: false,
      mensagem
    });
  }

  return repository.createBackupRegistro({
    destino,
    formato: "postgresql-custom",
    caminho: destination,
    sucesso: true,
    mensagem: "Backup concluido"
  });
}

export async function executarBackupPadrao(user: SessionUserScope, options: BackupOptions = {}) {
  if (!hasPermission(user.perfil, "configuracoes:write")) {
    throw new Error("Sem permissao para executar backup");
  }

  return executarBackup(prismaBackupRepository, nodeBackupStorage, nodeBackupProcess, {
    databaseUrl: process.env.DATABASE_URL,
    destinoFallback: process.env.BACKUP_LOCAL_DIR,
    ...options
  });
}
