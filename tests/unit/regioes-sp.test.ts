import { describe, expect, it } from "vitest";
import { REGIOES_SP, arvoreRegioes, resolveRegiao } from "@/data/regioes-sp";

describe("resolveRegiao", () => {
  it("maps sampled municipalities to their administrative region", () => {
    expect(resolveRegiao("MIRACATU")).toBe("Registro");
    expect(resolveRegiao("GUARULHOS")).toBe("São Paulo");
    expect(resolveRegiao("SANTOS")).toBe("Santos");
    expect(resolveRegiao("FRANCA")).toBe("Franca");
    expect(resolveRegiao("PRESIDENTE PRUDENTE")).toBe("Presidente Prudente");
    expect(resolveRegiao("SÃO JOSE DOS CAMPOS")).toBe("São José dos Campos");
  });

  it("is accent- and case-insensitive and handles export abbreviations", () => {
    expect(resolveRegiao("sao paulo")).toBe("São Paulo");
    expect(resolveRegiao("São Paulo")).toBe("São Paulo");
    expect(resolveRegiao("STA.CRUZ DO R.PARDO")).toBe(resolveRegiao("Santa Cruz do Rio Pardo"));
    expect(resolveRegiao("AGUAS DE STA BARBARA")).toBe("Sorocaba");
    expect(resolveRegiao("EMBU")).toBe("São Paulo");
  });

  it("returns null for unknown or empty municipalities", () => {
    expect(resolveRegiao("Belo Horizonte")).toBeNull();
    expect(resolveRegiao("")).toBeNull();
    expect(resolveRegiao(null)).toBeNull();
    expect(resolveRegiao(undefined)).toBeNull();
  });
});

describe("arvoreRegioes", () => {
  it("returns the São Paulo state tree with all 15 regions", () => {
    const arvore = arvoreRegioes();
    expect(arvore.estado).toBe("São Paulo");
    expect(arvore.regioes).toHaveLength(15);
    expect(arvore.regioes.map((node) => node.regiao)).toEqual([...REGIOES_SP]);
    const registro = arvore.regioes.find((node) => node.regiao === "Registro");
    expect(registro?.municipios).toContain("Miracatu");
  });
});
