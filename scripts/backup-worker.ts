import { executarBackup, nodeBackupStorage } from "@/server/backup-service";
import { prismaBackupRepository } from "@/server/prisma-backup-repository";

async function main() {
  const backup = await executarBackup(prismaBackupRepository, nodeBackupStorage, {
    mode: "automatico",
    databaseUrl: process.env.DATABASE_URL,
    destinoFallback: process.env.BACKUP_LOCAL_DIR
  });

  if (!backup.sucesso) {
    console.log(backup.mensagem ?? "Backup nao executado");
    return;
  }

  console.log(`Backup concluido: ${backup.caminho}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
