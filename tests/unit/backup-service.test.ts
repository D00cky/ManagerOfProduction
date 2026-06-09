import { describe, expect, it, vi } from "vitest";
import type { BackupProcess, BackupRepository, BackupStorage } from "@/server/backup-service";
import { executarBackup } from "@/server/backup-service";

function repo(config: { caminhoRede?: string | null; autoBackup?: boolean } | null = { caminhoRede: "/backups" }) {
  return {
    getConfig: vi.fn(async () =>
      config
        ? { caminhoRede: config.caminhoRede ?? "/backups", autoBackup: config.autoBackup ?? true }
        : null
    ),
    createBackupRegistro: vi.fn(async (input) => ({ id: "b1", ...input }))
  } satisfies BackupRepository;
}

function storage(): BackupStorage {
  return { ensureDir: vi.fn() };
}

function processRunner(): BackupProcess {
  return { pgDump: vi.fn() };
}

describe("executarBackup", () => {
  it("fails when DATABASE_URL is not PostgreSQL", async () => {
    await expect(
      executarBackup(repo(), storage(), processRunner(), {
        databaseUrl: "file:./dev.db",
        now: new Date("2026-01-01")
      })
    ).rejects.toThrow("Backup exige DATABASE_URL PostgreSQL");
  });

  it("records a skipped automatic backup when auto backup is disabled", async () => {
    const repository = repo({ caminhoRede: "/backups", autoBackup: false });
    const runner = processRunner();

    const result = await executarBackup(repository, storage(), runner, {
      databaseUrl: "postgresql://app:secret@postgres:5432/app",
      mode: "automatico",
      now: new Date("2026-01-01T00:00:00Z")
    });

    expect(runner.pgDump).not.toHaveBeenCalled();
    expect(result.sucesso).toBe(false);
    expect(result.mensagem).toBe("Backup automatico desativado");
  });

  it("runs pg_dump in custom format and records the destination", async () => {
    const repository = repo({ caminhoRede: "/backups" });
    const fileStorage = storage();
    const runner = processRunner();

    const result = await executarBackup(repository, fileStorage, runner, {
      databaseUrl: "postgresql://app:secret@postgres:5432/app",
      now: new Date("2026-01-02T03:04:05Z")
    });

    expect(fileStorage.ensureDir).toHaveBeenCalledWith("/backups");
    expect(runner.pgDump).toHaveBeenCalledWith({
      databaseUrl: "postgresql://app:secret@postgres:5432/app",
      destination: "/backups/manager-of-production-2026-01-02T03-04-05-000Z.dump"
    });
    expect(repository.createBackupRegistro).toHaveBeenCalledWith({
      destino: "/backups",
      formato: "postgresql-custom",
      caminho: "/backups/manager-of-production-2026-01-02T03-04-05-000Z.dump",
      sucesso: true,
      mensagem: "Backup concluido"
    });
    expect(result.sucesso).toBe(true);
  });

  it("records a failed pg_dump attempt", async () => {
    const repository = repo({ caminhoRede: "/backups" });
    const runner = processRunner();
    vi.mocked(runner.pgDump).mockImplementation(() => {
      throw new Error("pg_dump indisponivel");
    });

    const result = await executarBackup(repository, storage(), runner, {
      databaseUrl: "postgresql://app:secret@postgres:5432/app",
      now: new Date("2026-01-02T03:04:05Z")
    });

    expect(repository.createBackupRegistro).toHaveBeenCalledWith({
      destino: "/backups",
      formato: "postgresql-custom",
      caminho: "/backups/manager-of-production-2026-01-02T03-04-05-000Z.dump",
      sucesso: false,
      mensagem: "pg_dump indisponivel"
    });
    expect(result.sucesso).toBe(false);
  });
});
