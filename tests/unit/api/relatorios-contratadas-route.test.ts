import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const buildRelatorioExportDataset = vi.fn();
const getContratadaFacets = vi.fn();
const paginarDetalhamento = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/relatorio-export-service", () => ({
  buildRelatorioExportDataset,
  getContratadaFacets,
  paginarDetalhamento
}));
vi.mock("@/server/prisma-relatorio-export-repository", () => ({
  prismaRelatorioExportRepository: { name: "repo" },
  prismaRelatorioContratadaFacetsRepository: { name: "facets" }
}));

function request(url: string) {
  return new NextRequest(url);
}

const supervisor = { id: "s1", perfil: "supervisor" };

const datasetFake = {
  periodo: { from: new Date(), to: new Date(), label: "x" },
  filtrosAplicados: {},
  kpis: { totalOS: 3 },
  situacaoInspecoes: [],
  distribuicaoConceito: { A: 1, B: 0, C: 1, D: 1, NaoAvaliado: 0 },
  principaisNaoConformidades: [{ itemId: "x" }],
  detalhesNaoConformidades: [{ numeroOS: "OS-1" }, { numeroOS: "OS-2" }],
  quebras: { porRegiao: [], porPolo: [], porMunicipio: [], porTipoServico: [], porContrato: [], porUnidadeExecutante: [] }
};

describe("GET /api/relatorios/contratadas", () => {
  beforeEach(() => vi.resetAllMocks());

  it("retorna 401 sem usuário", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/relatorios/contratadas/route");
    const res = await GET(request("http://localhost/api/relatorios/contratadas"));
    expect(res.status).toBe(401);
  });

  it("retorna resumo/rankings/detalhamento paginado e repassa filtros + página", async () => {
    getCurrentUser.mockResolvedValue(supervisor);
    buildRelatorioExportDataset.mockResolvedValue(datasetFake);
    getContratadaFacets.mockResolvedValue({ contratos: [], unidades: [] });
    paginarDetalhamento.mockReturnValue({ rows: [{ numeroOS: "OS-2" }], total: 2, page: 2, pageSize: 1 });

    const { GET } = await import("@/app/api/relatorios/contratadas/route");
    const res = await GET(
      request("http://localhost/api/relatorios/contratadas?codigoContrato=C-1&conceito=C&page=2&pageSize=1")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.resumo.kpis.totalOS).toBe(3);
    expect(body.data.detalhamento.page).toBe(2);
    expect(body.data.rankingNaoConformidades).toHaveLength(1);

    // filtros repassados ao serviço
    const filtros = buildRelatorioExportDataset.mock.calls[0][2];
    expect(filtros).toMatchObject({ codigoContrato: "C-1", conceito: "C" });
    // paginação repassada
    expect(paginarDetalhamento).toHaveBeenCalledWith(datasetFake.detalhesNaoConformidades, 2, 1);
  });

  it("retorna 403 quando o serviço nega acesso", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal" });
    buildRelatorioExportDataset.mockRejectedValue(new Error("Sem permissao para gerar relatorio"));
    getContratadaFacets.mockRejectedValue(new Error("Sem permissao para gerar relatorio"));
    const { GET } = await import("@/app/api/relatorios/contratadas/route");
    const res = await GET(request("http://localhost/api/relatorios/contratadas"));
    expect(res.status).toBe(403);
  });
});
