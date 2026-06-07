import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const executarBackupPadrao = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/backup-service", () => ({ executarBackupPadrao }));

describe("POST /api/configuracoes/sync", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/configuracoes/sync/route");

    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("runs a manual backup for a supervisor", async () => {
    const user = { id: "sup", perfil: "supervisor" };
    getCurrentUser.mockResolvedValue(user);
    executarBackupPadrao.mockResolvedValue({ id: "b1", sucesso: true });
    const { POST } = await import("@/app/api/configuracoes/sync/route");

    const response = await POST();

    expect(response.status).toBe(201);
    expect(executarBackupPadrao).toHaveBeenCalledWith(user, { mode: "manual" });
    await expect(response.json()).resolves.toEqual({ data: { id: "b1", sucesso: true } });
  });

  it("returns 403 when the backup service denies access", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor" });
    executarBackupPadrao.mockRejectedValue(new Error("Sem permissao para executar backup"));
    const { POST } = await import("@/app/api/configuracoes/sync/route");

    const response = await POST();

    expect(response.status).toBe(403);
  });
});
