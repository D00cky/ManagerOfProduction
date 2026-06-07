import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const exportRelatorioCsv = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/relatorio-service", () => ({ exportRelatorioCsv }));
vi.mock("@/server/prisma-relatorio-repository", () => ({ prismaRelatorioRepository: { name: "repo" } }));

describe("GET /api/relatorios/exportar", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/relatorios/exportar/route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns a csv export", async () => {
    const user = { id: "m1", perfil: "monitor" };
    getCurrentUser.mockResolvedValue(user);
    exportRelatorioCsv.mockResolvedValue("Fiscal,Tabulacoes,Media FFR\nf1,2,75.00%");
    const { GET } = await import("@/app/api/relatorios/exportar/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("relatorio-ffr.csv");
    expect(exportRelatorioCsv).toHaveBeenCalledWith({ name: "repo" }, user);
    await expect(response.text()).resolves.toContain("Fiscal,Tabulacoes,Media FFR");
  });

  it("returns 403 when the service denies access", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal" });
    exportRelatorioCsv.mockRejectedValue(new Error("Sem permissao para ver relatorios"));
    const { GET } = await import("@/app/api/relatorios/exportar/route");

    const response = await GET();

    expect(response.status).toBe(403);
  });
});
