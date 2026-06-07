import { describe, expect, it, vi } from "vitest";
import type { BackupRepository, BackupStorage } from "@/server/backup-service";
import { executarBackup, resolveSqlitePath } from "@/server/backup-service";

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
  return {
    ensureDir: vi.fn(),
    copyFile: vi.fn()
  };
}

describe("resolveSqlitePath", () => {
  it("resolves relative Prisma sqlite URLs from the prisma directory", () => {
    expect(resolveSqlitePath("file:./dev.db")).toMatch(/prisma\/dev\.db$/);
  });

  it("resolves absolute sqlite URLs", () => {
    expect(resolveSqlitePath("file:/var/data/prod.db")).toBe("/var/data/prod.db");
  });
});

describe("executarBackup", () => {
  it("fails when DATABASE_URL is not a sqlite file URL", async () => {
    const repository = repo();

    await expect(
      executarBackup(repository, storage(), { databaseUrl: "postgresql://example", now: new Date("2026-01-01") })
    ).rejects.toThrow("Backup local exige DATABASE_URL sqlite");
  });

  it("records a skipped automatic backup when auto backup is disabled", async () => {
    const repository = repo({ caminhoRede: "/backups", autoBackup: false });
    const fileStorage = storage();

    const result = await executarBackup(repository, fileStorage, {
      databaseUrl: "file:./dev.db",
      mode: "automatico",
      now: new Date("2026-01-01T00:00:00Z")
    });

    expect(fileStorage.copyFile).not.toHaveBeenCalled();
    expect(result.sucesso).toBe(false);
    expect(result.mensagem).toBe("Backup automatico desativado");
  });

  it("copies the sqlite database and records the destination", async () => {
    const repository = repo({ caminhoRede: "/backups" });
    const fileStorage = storage();

    const result = await executarBackup(repository, fileStorage, {
      databaseUrl: "file:./dev.db",
      now: new Date("2026-01-02T03:04:05Z")
    });

    expect(fileStorage.ensureDir).toHaveBeenCalledWith("/backups");
    expect(fileStorage.copyFile).toHaveBeenCalledWith(
      expect.stringMatching(/prisma\/dev\.db$/),
      "/backups/manager-of-production-2026-01-02T03-04-05-000Z.db"
    );
    expect(repository.createBackupRegistro).toHaveBeenCalledWith({
      destino: "/backups",
      formato: "sqlite",
      caminho: "/backups/manager-of-production-2026-01-02T03-04-05-000Z.db",
      sucesso: true,
      mensagem: "Backup concluido"
    });
    expect(result.sucesso).toBe(true);
  });

  it("records a failed backup attempt", async () => {
    const repository = repo({ caminhoRede: "/backups" });
    const fileStorage = storage();
    vi.mocked(fileStorage.copyFile).mockImplementation(() => {
      throw new Error("sem acesso");
    });

    const result = await executarBackup(repository, fileStorage, {
      databaseUrl: "file:./dev.db",
      now: new Date("2026-01-02T03:04:05Z")
    });

    expect(repository.createBackupRegistro).toHaveBeenCalledWith({
      destino: "/backups",
      formato: "sqlite",
      caminho: "/backups/manager-of-production-2026-01-02T03-04-05-000Z.db",
      sucesso: false,
      mensagem: "sem acesso"
    });
    expect(result.sucesso).toBe(false);
  });
});
