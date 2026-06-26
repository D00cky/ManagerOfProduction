import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { chaveObsNaoConforme } from "@/data/grupos-ffr";
import {
  buildExportDataset,
  sanitizeSheetName,
  PREFIXO_OBS_NAO_CONFORME,
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
    tipoServico: "RedeRamalEsgoto",
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
    tabuladoPorId: "f1",
    respostas: {},
    somaObtida: 5,
    somaPossivel: 8,
    percentual: 62.5,
    conceito: "B" as const,
    observacoes: null,
    bloqueada: false,
    alterada: false,
    alteradoPorId: null,
    motivoAlteracao: null,
    alteradaEm: null,
    createdAt: now,
    updatedAt: now,
    tabuladoPor: { name: "Fiscal Teste", matricula: "F0001" },
    alteradoPor: null,
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
      os({ id: "b", numero: "1002", tipoServico: "RamalAgua", descricaoTss: "LIGAÇÃO DE ÁGUA" })
    ]);

    const { sheets } = await buildExportDataset(repository, supervisor, {});

    expect(sheets).toHaveLength(2);
    expect(sheets.map((s) => s.nome)).toContain("Ramal de agua");
    // Esgoto group name has slashes, sanitized for Excel.
    expect(sheets.some((s) => s.nome.startsWith("Rede   Ramal de esgoto"))).toBe(true);
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

  it("includes audit columns (tabulador + alteração)", async () => {
    const { repository } = repo([
      os({
        descricaoTss: "LIGAÇÃO DE ÁGUA",
        tabulacao: tab({
          tabuladoPor: { name: "Joao Fiscal", matricula: "F0001" },
          alterada: true,
          motivoAlteracao: "ajuste de peso",
          alteradoPor: { name: "Ana Monitor", matricula: "M0001" }
        })
      })
    ]);

    const { sheets } = await buildExportDataset(repository, supervisor, {});
    const sheet = sheets[0];
    const idx = (label: string) => sheet.colunas.indexOf(label);
    const linha = sheet.linhas[0];

    expect(linha[idx("Tabulado por")]).toBe("Joao Fiscal (F0001)");
    expect(linha[idx("Alterada")]).toBe("Sim");
    expect(linha[idx("Alterado por")]).toBe("Ana Monitor (M0001)");
    expect(linha[idx("Motivo da alteração")]).toBe("ajuste de peso");
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

  it("pairs each booleano criteria with a Não conforme observation column", async () => {
    const q1 = "O REGISTRO FOTOGRÁFICO DO SERVIÇO FOI EXECUTADO?";
    const q2 = "A QUALIDADE DAS FOTOS ESTÁ FAVORECENDO A FISCALIZAÇÃO (NÍTIDAS/BEM ENQUADRADAS)?";
    const textoQ4 = "SERVIÇO DECORRENTE DE DANOS DE TERCEIROS?";
    const { repository } = repo([
      os({
        descricaoTss: "LIGAÇÃO DE ÁGUA",
        tabulacao: tab({
          respostas: {
            gerais_q1: "1", // conforme → observação fica em branco
            gerais_q2: "0", // não conforme → observação preenchida
            [chaveObsNaoConforme("gerais_q2")]: "faltou registro fotografico",
            gerais_q4: "dano de terceiro" // item texto → sem coluna de observação
          }
        })
      })
    ]);

    const { sheets } = await buildExportDataset(repository, supervisor, {});
    const sheet = sheets[0];
    const idx = (label: string) => sheet.colunas.indexOf(label);
    const linha = sheet.linhas[0];

    // A coluna de observação fica imediatamente após a coluna do critério.
    expect(idx(`${PREFIXO_OBS_NAO_CONFORME}${q2}`)).toBe(idx(q2) + 1);
    expect(linha[idx(`${PREFIXO_OBS_NAO_CONFORME}${q2}`)]).toBe("faltou registro fotografico");
    // Critério Conforme: sem observação.
    expect(linha[idx(`${PREFIXO_OBS_NAO_CONFORME}${q1}`)]).toBe("");
    // Itens do tipo texto não recebem coluna de observação de Não conforme.
    expect(idx(`${PREFIXO_OBS_NAO_CONFORME}${textoQ4}`)).toBe(-1);
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
