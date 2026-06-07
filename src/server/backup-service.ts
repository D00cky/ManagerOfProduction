import { copyFileSync, mkdirSync } from "node:fs";
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
  copyFile(source: string, destination: string): void;
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
  },
  copyFile(source, destination) {
    copyFileSync(source, destination);
  }
};

export function resolveSqlitePath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Backup local exige DATABASE_URL sqlite");
  }

  const filePath = databaseUrl.slice("file:".length);
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(process.cwd(), "prisma", filePath);
}

export async function executarBackup(
  repository: BackupRepository,
  storage: BackupStorage,
  options: BackupOptions = {}
) {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL nao configurado");

  const config = await repository.getConfig();
  const destino = config?.caminhoRede ?? options.destinoFallback ?? process.env.BACKUP_LOCAL_DIR ?? "./backups";

  if (options.mode === "automatico" && config?.autoBackup === false) {
    return repository.createBackupRegistro({
      destino,
      formato: "sqlite",
      caminho: "",
      sucesso: false,
      mensagem: "Backup automatico desativado"
    });
  }

  const source = resolveSqlitePath(databaseUrl);
  const now = options.now ?? new Date();
  const filename = `manager-of-production-${now.toISOString().replace(/[:.]/g, "-")}.db`;
  const destination = path.join(destino, filename);

  try {
    storage.ensureDir(destino);
    storage.copyFile(source, destination);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro ao executar backup";
    return repository.createBackupRegistro({
      destino,
      formato: "sqlite",
      caminho: destination,
      sucesso: false,
      mensagem
    });
  }

  return repository.createBackupRegistro({
    destino,
    formato: "sqlite",
    caminho: destination,
    sucesso: true,
    mensagem: "Backup concluido"
  });
}

export async function executarBackupPadrao(user: SessionUserScope, options: BackupOptions = {}) {
  if (!hasPermission(user.perfil, "configuracoes:write")) {
    throw new Error("Sem permissao para executar backup");
  }

  return executarBackup(prismaBackupRepository, nodeBackupStorage, {
    databaseUrl: process.env.DATABASE_URL,
    destinoFallback: process.env.BACKUP_LOCAL_DIR,
    ...options
  });
}
