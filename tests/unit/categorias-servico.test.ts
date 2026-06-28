import { describe, expect, it } from "vitest";
import { categoriaPorCodigo, categoriaPorCodigoMap } from "@/data/categorias-servico";

describe("categoriaPorCodigo", () => {
  it("mapeia um código representativo de cada categoria", () => {
    expect(categoriaPorCodigo("3000")).toBe("RedeAgua");
    expect(categoriaPorCodigo("2860")).toBe("RamalAgua");
    expect(categoriaPorCodigo("2010")).toBe("CavaleteHidrometro");
    expect(categoriaPorCodigo("5050")).toBe("RedeRamalEsgoto");
    expect(categoriaPorCodigo("5880")).toBe("RedeRamalEsgoto");
    expect(categoriaPorCodigo("5810")).toBe("Desobstrucao");
    expect(categoriaPorCodigo("7070")).toBe("LavagemEee");
    expect(categoriaPorCodigo("7670")).toBe("ReposicaoPiso");
    expect(categoriaPorCodigo("7850")).toBe("ReposicaoAsfaltica");
  });

  it("classifica 'Ligação de água S/V' (2540) como Ramal de água", () => {
    expect(categoriaPorCodigo("2540")).toBe("RamalAgua");
  });

  it("classifica 'Ligação de esgoto' (5010) como Rede/Ramal de esgoto", () => {
    expect(categoriaPorCodigo("5010")).toBe("RedeRamalEsgoto");
  });

  it("inclui os códigos de pavimentação/esgoto adicionados após revisão da base", () => {
    // 73xx (compactar/selar base, repor asfalto a frio, recompor sinalização) → asfáltica
    expect(categoriaPorCodigo("7300")).toBe("ReposicaoAsfaltica");
    expect(categoriaPorCodigo("7306")).toBe("ReposicaoAsfaltica");
    expect(categoriaPorCodigo("7307")).toBe("ReposicaoAsfaltica");
    expect(categoriaPorCodigo("7320")).toBe("ReposicaoAsfaltica");
    expect(categoriaPorCodigo("7340")).toBe("ReposicaoAsfaltica");
    // sondar ramal de esgoto
    expect(categoriaPorCodigo("5670")).toBe("RedeRamalEsgoto");
  });

  it("retorna null para código fora da tabela", () => {
    expect(categoriaPorCodigo("9999")).toBeNull();
    expect(categoriaPorCodigo("0000")).toBeNull();
  });

  it("retorna null quando nenhum código é informado", () => {
    expect(categoriaPorCodigo(null, null)).toBeNull();
    expect(categoriaPorCodigo(undefined, undefined)).toBeNull();
    expect(categoriaPorCodigo("", "  ")).toBeNull();
  });

  it("usa o código TSS primeiro e cai para o TSE quando o TSS está fora da tabela", () => {
    expect(categoriaPorCodigo("3000", "5810")).toBe("RedeAgua");
    expect(categoriaPorCodigo("9999", "5810")).toBe("Desobstrucao");
    expect(categoriaPorCodigo(null, "7670")).toBe("ReposicaoPiso");
  });

  it("normaliza espaços em volta do código", () => {
    expect(categoriaPorCodigo(" 3000 ")).toBe("RedeAgua");
  });

  it("não contém as categorias removidas Outros, RedeRamalAgua nem LigacaoEsgoto", () => {
    const categorias = new Set(Object.values(categoriaPorCodigoMap));
    expect(categorias.has("Outros" as never)).toBe(false);
    expect(categorias.has("RedeRamalAgua" as never)).toBe(false);
    expect(categorias.has("LigacaoEsgoto" as never)).toBe(false);
  });
});
