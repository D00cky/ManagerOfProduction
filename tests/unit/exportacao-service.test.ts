import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  buildExportDataset,
  sanitizeSheetName,
  type ExportacaoRepository,
  type OrdemExport
} from "@/server/exportacao-service";

function os(overrides: Partial<OrdemExport> = {}): OrdemExport {
  const now = new Date("2026-06-07T10:00:00.000Z");
  return {
    id: "os1",
    numero: "1001",
    enderecoCompleto: "Rua A, 10",
    numeroImovel: null,
    complemento: null,
    bairro: "Centro",
    cidade: "Campinas",
    regiaoAdministrativa: null,
    unidadeExecutante: "UN-1",
    codigoContrato: "C1",
    descricaoContrato: "Contrato 1",
    codigoTss: "T1",
    descricaoTss: "REDE DE ESGOTO",
    codigoTse: "E1",
    descricaoTse: "TSE 1",
    pde: "PDE9",
    equipe: null,
    dataInicioExecucao: null,
    dataFimExecucao: null,
    tipoServico: "Outros",
    status: "Concluida",
    poloId: "p1",
    fiscalId: "f1",
    observacao: null,
    dataProgramada: null,
    iniciadaEm: now,
    concluidaEm: now,
    canceladaEm: null,
    createdAt: now,
    updatedAt: now,
    tabulacao: null,
    fiscal: { name: "Fiscal Teste" },
    polo: { nome: "Polo 1" },
    ...overrides
  };
}

function tab(overrides: Partial<NonNullable<OrdemExport["tabulacao"]>> = {}) {
  const now = new Date("2026-06-07T10:00:00.000Z");
  return {
    id: "tab1",
    ordemServicoId: "os1",
    fiscalId: "f1",
    respostas: {},
    somaObtida: 5,
    somaPossivel: 8,
    percentual: 62.5,
    conceito: "B" as const,
    observacoes: null,
    bloqueada: false,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function repo(ordens: OrdemExport[]) {
  const captured: { where?: Prisma.OrdemServicoWhereInput } = {};
  const repository: ExportacaoRepository = {
    findOrdensParaExport: vi.fn(async (where) => {
      captured.where = where;
      return ordens;
    })
  };
  return { repository, captured };
}

const supervisor = { id: "s1", perfil: "supervisor" as const, poloId: "p1" };
const fiscal = { id: "f1", perfil: "fiscal" as const, poloId: "p1" };

describe("buildExportDataset", () => {
  it("creates one sheet per service category", async () => {
    const { repository } = repo([
      os({ id: "a", descricaoTss: "REDE DE ESGOTO" }),
      os({ id: "b", numero: "1002", descricaoTss: "LIGAÇÃO DE ÁGUA" })
    ]);

    const { sheets } = await buildExportDataset(repository, supervisor, {});

    expect(sheets).toHaveLength(2);
    expect(sheets.map((s) => s.nome)).toContain("Ramal de agua");
    // Esgoto group name has slashes, sanitized for Excel.
    expect(sheets.some((s) => s.nome.startsWith("Rede   Ramal de esgoto"))).toBe(true);
  });

  it("places an OS spanning TSS PAI + TSE in both service sheets", async () => {
    const { repository } = repo([
      os({ id: "a", descricaoTss: "LIGAÇÃO DE ÁGUA", descricaoTse: "REPOSIÇÃO ASFÁLTICA" })
    ]);

    const { sheets } = await buildExportDataset(repository, supervisor, {});

    expect(sheets).toHaveLength(2);
    expect(sheets.map((s) => s.nome)).toContain("Ramal de agua");
    expect(sheets.some((s) => s.nome.startsWith("Reposicao asfaltica"))).toBe(true);
    // The same OS number shows up under each corresponding service.
    for (const sheet of sheets) {
      expect(sheet.linhas).toHaveLength(1);
      expect(sheet.linhas[0][sheet.colunas.indexOf("nº OS")]).toBe("1001");
    }
  });

  it("includes metadata, criteria and score columns and maps answers", async () => {
    const { repository } = repo([
      os({
        descricaoTss: "LIGAÇÃO DE ÁGUA",
        tabulacao: tab({
          respostas: { gerais_q1: "1", gerais_q2: "0", gerais_q3: "X", gerais_q4: "dano de terceiro" }
        })
      })
    ]);

    const { sheets } = await buildExportDataset(repository, supervisor, {});
    const sheet = sheets[0];

    expect(sheet.colunas.slice(0, 3)).toEqual(["nº OS", "Status", "Tipo de serviço"]);
    expect(sheet.colunas).toContain("Soma obtida");
    expect(sheet.colunas).toContain("Conceito");

    const idx = (label: string) => sheet.colunas.indexOf(label);
    const linha = sheet.linhas[0];
    expect(linha[idx("nº OS")]).toBe("1001");
    expect(linha[idx("O REGISTRO FOTOGRÁFICO DO SERVIÇO FOI EXECUTADO?")]).toBe("Conforme");
    expect(
      linha[idx("A QUALIDADE DAS FOTOS ESTÁ FAVORECENDO A FISCALIZAÇÃO (NÍTIDAS/BEM ENQUADRADAS)?")]
    ).toBe("Não conforme");
    expect(
      linha[idx("AS COORDENADAS GEOGRÁFICAS CONDIZEM COM O ENDEREÇO DO SERVIÇO SOLICITADO?")]
    ).toBe("N/A");
    expect(linha[idx("SERVIÇO DECORRENTE DE DANOS DE TERCEIROS?")]).toBe("dano de terceiro");
    expect(linha[idx("Soma obtida")]).toBe(5);
    expect(linha[idx("Conceito")]).toBe("B");
  });

  it("emits blank cells for an OS without tabulação", async () => {
    const { repository } = repo([os({ tabulacao: null })]);

    const { sheets } = await buildExportDataset(repository, supervisor, {});
    const sheet = sheets[0];
    const idx = (label: string) => sheet.colunas.indexOf(label);
    const linha = sheet.linhas[0];

    expect(linha[idx("O REGISTRO FOTOGRÁFICO DO SERVIÇO FOI EXECUTADO?")]).toBe("");
    expect(linha[idx("Soma obtida")]).toBe("");
    expect(linha[idx("Conceito")]).toBe("");
  });

  it("builds the query where from the user's row scope", async () => {
    const { repository, captured } = repo([os()]);

    await buildExportDataset(repository, fiscal, {});

    expect(JSON.stringify(captured.where)).toContain("\"fiscalId\":\"f1\"");
  });
});

describe("sanitizeSheetName", () => {
  it("strips illegal characters, truncates to 31, and de-duplicates", () => {
    const usados = new Set<string>();
    expect(sanitizeSheetName("Rede / Ramal de esgoto / PV / PI / TL", usados)).toBe(
      "Rede   Ramal de esgoto   PV   P"
    );
    expect(sanitizeSheetName("Esgoto", usados)).toBe("Esgoto");
    expect(sanitizeSheetName("Esgoto", usados)).toBe("Esgoto~2");
    expect(sanitizeSheetName("Esgoto", usados)).toBe("Esgoto~3");
  });
});
