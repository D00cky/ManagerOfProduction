import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const buildRelatorioExportDataset = vi.fn();
const gerarRelatorioPdf = vi.fn();
const gerarRelatorioExcel = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/relatorio-export-service", () => ({ buildRelatorioExportDataset }));
vi.mock("@/server/prisma-relatorio-export-repository", () => ({
  prismaRelatorioExportRepository: { name: "repo" }
}));
vi.mock("@/server/relatorio-pdf", () => ({ gerarRelatorioPdf }));
vi.mock("@/server/relatorio-excel", () => ({ gerarRelatorioExcel }));

function request(url: string) {
  return new NextRequest(url);
}

const monitor = { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] };

describe("GET /api/relatorios/export/preview", () => {
  beforeEach(() => vi.resetAllMocks());

  it("retorna 401 sem usuário autenticado", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/relatorios/export/preview/route");
    const response = await GET(request("http://localhost/api/relatorios/export/preview"));
    expect(response.status).toBe(401);
  });

  it("retorna o dataset e repassa os filtros", async () => {
    getCurrentUser.mockResolvedValue(monitor);
    buildRelatorioExportDataset.mockResolvedValue({ kpis: { totalOS: 3 } });
    const { GET } = await import("@/app/api/relatorios/export/preview/route");
    const response = await GET(
      request("http://localhost/api/relatorios/export/preview?periodoTipo=mensal&mes=2026-05&regiao=METROPOLITANA")
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { kpis: { totalOS: 3 } } });
    const filtros = buildRelatorioExportDataset.mock.calls[0][2];
    expect(filtros).toMatchObject({ periodoTipo: "mensal", mes: "2026-05", regiao: "METROPOLITANA" });
  });

  it("retorna 403 quando o serviço nega acesso", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal", poloId: "p1" });
    buildRelatorioExportDataset.mockRejectedValue(new Error("Sem permissao para gerar relatorio"));
    const { GET } = await import("@/app/api/relatorios/export/preview/route");
    const response = await GET(request("http://localhost/api/relatorios/export/preview"));
    expect(response.status).toBe(403);
  });
});

describe("GET /api/relatorios/export/pdf", () => {
  beforeEach(() => vi.resetAllMocks());

  it("retorna 401 sem usuário", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/relatorios/export/pdf/route");
    const response = await GET(request("http://localhost/api/relatorios/export/pdf"));
    expect(response.status).toBe(401);
  });

  it("retorna PDF com headers de download", async () => {
    getCurrentUser.mockResolvedValue(monitor);
    buildRelatorioExportDataset.mockResolvedValue({ kpis: {} });
    gerarRelatorioPdf.mockReturnValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    const { GET } = await import("@/app/api/relatorios/export/pdf/route");
    const response = await GET(request("http://localhost/api/relatorios/export/pdf"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("relatorio-inspecoes.pdf");
  });
});

describe("GET /api/relatorios/export/excel", () => {
  beforeEach(() => vi.resetAllMocks());

  it("retorna planilha com headers de download", async () => {
    getCurrentUser.mockResolvedValue(monitor);
    buildRelatorioExportDataset.mockResolvedValue({ kpis: {} });
    gerarRelatorioExcel.mockResolvedValue(Buffer.from([1, 2, 3]));
    const { GET } = await import("@/app/api/relatorios/export/excel/route");
    const response = await GET(request("http://localhost/api/relatorios/export/excel"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("spreadsheetml.sheet");
    expect(response.headers.get("content-disposition")).toContain("relatorio-inspecoes.xlsx");
  });

  it("retorna 403 quando o serviço nega acesso", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal" });
    buildRelatorioExportDataset.mockRejectedValue(new Error("Sem permissao para gerar relatorio"));
    const { GET } = await import("@/app/api/relatorios/export/excel/route");
    const response = await GET(request("http://localhost/api/relatorios/export/excel"));
    expect(response.status).toBe(403);
  });
});
