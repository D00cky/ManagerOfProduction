import { prisma } from "@/lib/prisma";
import type { BackupRepository } from "@/server/backup-service";

export const prismaBackupRepository: BackupRepository = {
  getConfig() {
    return prisma.configSync.findFirst({
      select: { caminhoRede: true, autoBackup: true }
    });
  },
  createBackupRegistro(input) {
    return prisma.backupRegistro.create({ data: input });
  }
};
