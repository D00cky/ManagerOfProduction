import { describe, expect, it } from "vitest";
import { detectMapping, normalizeHeader, normalizeImportRow, normalizeTipoServico } from "@/lib/importacao";

describe("normalizeHeader", () => {
  it("normalizes accents, casing, and separators", () => {
    expect(normalizeHeader("Número OS")).toBe("numero_os");
    expect(normalizeHeader("Endereço Completo")).toBe("endereco_completo");
  });
});

describe("detectMapping", () => {
  it("detects import columns from known aliases", () => {
    const mapping = detectMapping(["Número OS", "Endereço Completo", "Serviço", "Matrícula", "Polo"]);

    expect(mapping.numero).toBe("Número OS");
    expect(mapping.enderecoCompleto).toBe("Endereço Completo");
    expect(mapping.tipoServico).toBe("Serviço");
    expect(mapping.fiscal).toBe("Matrícula");
    expect(mapping.polo).toBe("Polo");
  });
});

describe("normalizeImportRow", () => {
  it("validates required numero_os and endereco_completo fields", () => {
    const result = normalizeImportRow(
      { OS: "", Endereco: "", Servico: "vistoria" },
      { numero: "OS", enderecoCompleto: "Endereco", tipoServico: "Servico" }
    );

    expect(result.errors).toEqual(["numero_os obrigatorio", "endereco_completo obrigatorio"]);
  });

  it("normalizes a valid row into domain fields", () => {
    const result = normalizeImportRow(
      {
        OS: "123",
        Endereco: "Rua A, 10",
        Servico: "Troca Hidrômetro",
        Fiscal: "1002",
        Polo: "Norte"
      },
      {
        numero: "OS",
        enderecoCompleto: "Endereco",
        tipoServico: "Servico",
        fiscal: "Fiscal",
        polo: "Polo"
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.row).toMatchObject({
      numero: "123",
      enderecoCompleto: "Rua A, 10",
      tipoServico: "TrocaHidrometro",
      fiscal: "1002",
      polo: "Norte"
    });
  });
});

describe("normalizeTipoServico", () => {
  it("falls back to Outros for unknown service types", () => {
    expect(normalizeTipoServico("servico especial")).toBe("Outros");
  });

  it("matches Sabesp service descriptions by keyword", () => {
    expect(normalizeTipoServico("LIGAÇÃO DE ÁGUA S/V")).toBe("LigacaoAgua");
    expect(normalizeTipoServico("RELIGAÇÃO DE ÁGUA")).toBe("ReligacaoAgua");
    expect(normalizeTipoServico("CORTE NO CAVALETE")).toBe("CorteAgua");
  });
});

describe("Sabesp execution export", () => {
  const headers = [
    "Unidade Executante", "Número OS", "Código TSS", "Descrição TSS", "Família",
    "PDE", "Município", "Endereço", "Número", "Complemento", "Bairro",
    "Código Resultado", "Resultado", "Data Início Execução", "Data Fim Execução",
    "Código Contrato", "Descrição Contrato", "Equipe"
  ];

  const sampleRow = {
    "Unidade Executante": "ORMR - DIV MANUT SERV OPE REGISTRO",
    "Número OS": "2610596894",
    "Código TSS": "2540",
    "Descrição TSS": "LIGAÇÃO DE ÁGUA S/V",
    "Família": "LIGAÇÃO DE ÁGUA",
    PDE: "2001000975",
    "Município": "MIRACATU",
    "Endereço": "RUA CANDIDO DOS SANTOS COELHO",
    "Número": "82",
    Complemento: "C/1",
    Bairro: "VILA KAMAIT",
    "Código Resultado": "254000",
    Resultado: "LIGAÇÃO DE ÁGUA S/V",
    "Data Início Execução": "01/06/2026 12:05",
    "Data Fim Execução": "01/06/2026 15:00",
    "Código Contrato": "9999999999",
    "Descrição Contrato": "SABESP",
    Equipe: "LEANDRO ESTEVAM"
  };

  it("maps the Sabesp columns, keys polo off the unit and derives the region", () => {
    const mapping = detectMapping(headers);
    const { row, errors } = normalizeImportRow(sampleRow, mapping);

    expect(errors).toEqual([]);
    expect(row).toMatchObject({
      numero: "2610596894",
      enderecoCompleto: "RUA CANDIDO DOS SANTOS COELHO",
      numeroImovel: "82",
      complemento: "C/1",
      bairro: "VILA KAMAIT",
      cidade: "MIRACATU",
      regiaoAdministrativa: "Registro",
      tipoServico: "LigacaoAgua",
      // No Polo column — keyed off the Unidade Executante.
      polo: "ORMR - DIV MANUT SERV OPE REGISTRO",
      unidadeExecutante: "ORMR - DIV MANUT SERV OPE REGISTRO",
      // Fiscal comes from the Equipe column.
      fiscal: "LEANDRO ESTEVAM",
      equipe: "LEANDRO ESTEVAM",
      codigoContrato: "9999999999",
      descricaoContrato: "SABESP",
      codigoTss: "2540",
      descricaoTss: "LIGAÇÃO DE ÁGUA S/V",
      codigoTse: "254000",
      descricaoTse: "LIGAÇÃO DE ÁGUA S/V",
      pde: "2001000975"
    });
    expect(row.dataInicioExecucao?.getMonth()).toBe(5);
    expect(row.dataInicioExecucao?.getDate()).toBe(1);
    expect(row.dataFimExecucao?.getHours()).toBe(15);
  });
});
