import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const getRelatorio = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/relatorio-service", () => ({ getRelatorio }));
vi.mock("@/server/prisma-relatorio-repository", () => ({ prismaRelatorioRepository: { name: "repo" } }));

describe("GET /api/relatorios", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/relatorios/route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns the report through the service", async () => {
    const user = { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] };
    getCurrentUser.mockResolvedValue(user);
    getRelatorio.mockResolvedValue({ totalAvaliadas: 0 });
    const { GET } = await import("@/app/api/relatorios/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getRelatorio).toHaveBeenCalledWith({ name: "repo" }, user);
    await expect(response.json()).resolves.toEqual({ data: { totalAvaliadas: 0 } });
  });

  it("returns 403 when the service denies access", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal", poloId: "p1" });
    getRelatorio.mockRejectedValue(new Error("Sem permissao para ver relatorios"));
    const { GET } = await import("@/app/api/relatorios/route");

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Sem permissao para ver relatorios" });
  });
});
