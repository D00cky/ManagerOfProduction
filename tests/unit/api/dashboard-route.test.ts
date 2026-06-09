import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const getDashboardResumo = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/dashboard-service", () => ({ getDashboardResumo }));
vi.mock("@/server/prisma-dashboard-repository", () => ({ prismaDashboardRepository: { name: "dash-repo" } }));

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/dashboard/route");

    const response = await GET(new Request("http://localhost/api/dashboard"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Nao autenticado" });
  });

  it("returns dashboard summary for the authenticated user", async () => {
    const user = { id: "m1", perfil: "monitor", poloId: "p1" };
    const resumo = { metricas: { total: 1 }, progressoPorFiscal: [], osParadas: [], atividades: [] };
    getCurrentUser.mockResolvedValue(user);
    getDashboardResumo.mockResolvedValue(resumo);
    const { GET } = await import("@/app/api/dashboard/route");

    const response = await GET(new Request("http://localhost/api/dashboard?regiao=Campinas"));

    expect(response.status).toBe(200);
    expect(getDashboardResumo).toHaveBeenCalledWith(
      { name: "dash-repo" },
      user,
      expect.any(Date),
      expect.objectContaining({ regiao: "Campinas" })
    );
    await expect(response.json()).resolves.toEqual({ data: resumo });
  });
});
