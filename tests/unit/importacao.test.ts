import { describe, expect, it } from "vitest";
import { detectMapping, normalizeHeader, normalizeImportRow } from "@/lib/importacao";

describe("normalizeHeader", () => {
  it("normalizes accents, casing, and separators", () => {
    expect(normalizeHeader("Número OS")).toBe("numero_os");
    expect(normalizeHeader("Endereço Completo")).toBe("endereco_completo");
  });
});

describe("detectMapping", () => {
  it("detects import columns from known aliases", () => {
    const mapping = detectMapping(["Número OS", "Endereço Completo", "Código TSS", "Matrícula", "Polo"]);

    expect(mapping.numero).toBe("Número OS");
    expect(mapping.enderecoCompleto).toBe("Endereço Completo");
    expect(mapping.codigoTss).toBe("Código TSS");
    expect(mapping.fiscal).toBe("Matrícula");
    expect(mapping.polo).toBe("Polo");
  });
});

describe("normalizeImportRow", () => {
  it("validates required numero_os and endereco_completo fields", () => {
    const result = normalizeImportRow(
      { OS: "", Endereco: "", Codigo: "2540", Contrato: "9999999999" },
      { numero: "OS", enderecoCompleto: "Endereco", codigoTss: "Codigo", codigoContrato: "Contrato" }
    );

    expect(result.errors).toEqual(["numero_os obrigatorio", "endereco_completo obrigatorio"]);
  });

  it("exige contrato/empresa: rejeita linha sem contrato", () => {
    const result = normalizeImportRow(
      { OS: "123", Endereco: "Rua A, 10", Codigo: "2010" },
      { numero: "OS", enderecoCompleto: "Endereco", codigoTss: "Codigo" }
    );

    expect(result.errors).toEqual(["contrato obrigatorio"]);
  });

  it("categoriza a OS pelo código TSS (não pela descrição)", () => {
    const result = normalizeImportRow(
      {
        OS: "123",
        Endereco: "Rua A, 10",
        Codigo: "2010",
        Fiscal: "1002",
        Polo: "Norte",
        Contrato: "9999999999"
      },
      {
        numero: "OS",
        enderecoCompleto: "Endereco",
        codigoTss: "Codigo",
        fiscal: "Fiscal",
        polo: "Polo",
        codigoContrato: "Contrato"
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.row).toMatchObject({
      numero: "123",
      enderecoCompleto: "Rua A, 10",
      tipoServico: "CavaleteHidrometro",
      foraDeEscopo: false,
      fiscal: "1002",
      polo: "Norte"
    });
  });

  it("cai para o código TSE quando o TSS está ausente", () => {
    const result = normalizeImportRow(
      { OS: "123", Endereco: "Rua A, 10", Tse: "5810" },
      { numero: "OS", enderecoCompleto: "Endereco", codigoTse: "Tse" }
    );

    expect(result.row.tipoServico).toBe("Desobstrucao");
    expect(result.row.foraDeEscopo).toBe(false);
  });

  it("marca como fora de escopo quando o código não está na tabela", () => {
    const result = normalizeImportRow(
      { OS: "123", Endereco: "Rua A, 10", Codigo: "9999", Contrato: "9999999999" },
      { numero: "OS", enderecoCompleto: "Endereco", codigoTss: "Codigo", codigoContrato: "Contrato" }
    );

    expect(result.errors).toEqual([]);
    expect(result.row.tipoServico).toBeNull();
    expect(result.row.foraDeEscopo).toBe(true);
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
    "Código Resultado": "2540",
    Resultado: "LIGAÇÃO DE ÁGUA S/V",
    "Data Início Execução": "01/06/2026 12:05",
    "Data Fim Execução": "01/06/2026 15:00",
    "Código Contrato": "9999999999",
    "Descrição Contrato": "SABESP",
    Equipe: "LEANDRO ESTEVAM"
  };

  it("categoriza pelo Código TSS (independente da descrição da Família)", () => {
    const mapping = detectMapping(headers);
    const { row } = normalizeImportRow(
      { ...sampleRow, "Código TSS": "2010" },
      mapping
    );

    expect(mapping.codigoTss).toBe("Código TSS");
    expect(row.tipoServico).toBe("CavaleteHidrometro");
  });

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
      tipoServico: "RamalAgua",
      foraDeEscopo: false,
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
      codigoTse: "2540",
      descricaoTse: "LIGAÇÃO DE ÁGUA S/V",
      pde: "2001000975"
    });
    expect(row.dataInicioExecucao?.getMonth()).toBe(5);
    expect(row.dataInicioExecucao?.getDate()).toBe(1);
    expect(row.dataFimExecucao?.getHours()).toBe(15);
  });
});
