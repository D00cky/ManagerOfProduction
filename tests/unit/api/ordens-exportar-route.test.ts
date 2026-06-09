import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const buildExportDataset = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/exportacao-service", () => ({ buildExportDataset }));
vi.mock("@/server/prisma-exportacao-repository", () => ({ prismaExportacaoRepository: { name: "repo" } }));

const dataset = {
  sheets: [
    {
      nome: "Ramal de agua",
      colunas: ["nº OS", "Conceito"],
      linhas: [["1001", "B"]]
    }
  ]
};

describe("GET /api/ordens/exportar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/ordens/exportar/route");

    const response = await GET(new Request("http://localhost/api/ordens/exportar"));

    expect(response.status).toBe(401);
  });

  it("builds an XLSX from the parsed filters and user scope", async () => {
    const user = { id: "m1", perfil: "monitor" };
    getCurrentUser.mockResolvedValue(user);
    buildExportDataset.mockResolvedValue(dataset);
    const { GET } = await import("@/app/api/ordens/exportar/route");

    const response = await GET(
      new Request("http://localhost/api/ordens/exportar?status=Concluida&tipoServico=LigacaoAgua")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("spreadsheetml");
    expect(response.headers.get("content-disposition")).toContain("ordens-ffr.xlsx");
    expect(buildExportDataset).toHaveBeenCalledWith(
      { name: "repo" },
      user,
      expect.objectContaining({ status: "Concluida", tipoServico: "LigacaoAgua" })
    );
  });

  it("returns a flat CSV when formato=csv", async () => {
    getCurrentUser.mockResolvedValue({ id: "s1", perfil: "supervisor" });
    buildExportDataset.mockResolvedValue(dataset);
    const { GET } = await import("@/app/api/ordens/exportar/route");

    const response = await GET(new Request("http://localhost/api/ordens/exportar?formato=csv"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const body = await response.text();
    expect(body).toContain("Categoria");
    expect(body).toContain("Ramal de agua");
    expect(body).toContain("1001");
  });

  it("maps a permission error to 403", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal" });
    buildExportDataset.mockRejectedValue(new Error("Sem permissao para exportar ordens"));
    const { GET } = await import("@/app/api/ordens/exportar/route");

    const response = await GET(new Request("http://localhost/api/ordens/exportar"));

    expect(response.status).toBe(403);
  });
});
