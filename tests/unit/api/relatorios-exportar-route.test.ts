import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const exportRelatorioCsv = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
// Keep the real mesParaIntervalo (the route uses it to parse `mes`); only stub the export fn.
vi.mock("@/server/relatorio-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/relatorio-service")>();
  return { ...actual, exportRelatorioCsv };
});
vi.mock("@/server/prisma-relatorio-repository", () => ({ prismaRelatorioRepository: { name: "repo" } }));

describe("GET /api/relatorios/exportar", () => {
  beforeEach(() => vi.resetAllMocks());

  function request(url = "http://localhost/api/relatorios/exportar") {
    return new NextRequest(url);
  }

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/relatorios/exportar/route");

    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it("returns a csv export and forwards the geo + period filter", async () => {
    const user = { id: "m1", perfil: "monitor" };
    getCurrentUser.mockResolvedValue(user);
    exportRelatorioCsv.mockResolvedValue("Fiscal,Tabulacoes,Media FFR\nf1,2,75.00%");
    const { GET } = await import("@/app/api/relatorios/exportar/route");

    const response = await GET(
      request("http://localhost/api/relatorios/exportar?regiao=METROPOLITANA&polo=p1&mes=2026-05")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("relatorio-ffr.csv");
    expect(exportRelatorioCsv).toHaveBeenCalledWith({ name: "repo" }, user, {
      regiao: "METROPOLITANA",
      polo: "p1",
      municipio: undefined,
      from: new Date(2026, 4, 1, 0, 0, 0, 0),
      to: new Date(2026, 4, 31, 23, 59, 59, 999)
    });
    await expect(response.text()).resolves.toContain("Fiscal,Tabulacoes,Media FFR");
  });

  it("sends an empty period window when no month is provided", async () => {
    const user = { id: "m1", perfil: "monitor" };
    getCurrentUser.mockResolvedValue(user);
    exportRelatorioCsv.mockResolvedValue("");
    const { GET } = await import("@/app/api/relatorios/exportar/route");

    await GET(request());

    expect(exportRelatorioCsv).toHaveBeenCalledWith({ name: "repo" }, user, {
      regiao: undefined,
      polo: undefined,
      municipio: undefined,
      from: undefined,
      to: undefined
    });
  });

  it("returns 403 when the service denies access", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal" });
    exportRelatorioCsv.mockRejectedValue(new Error("Sem permissao para ver relatorios"));
    const { GET } = await import("@/app/api/relatorios/exportar/route");

    const response = await GET(request());

    expect(response.status).toBe(403);
  });
});
