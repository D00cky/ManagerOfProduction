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
});
