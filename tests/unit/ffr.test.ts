import { describe, expect, it } from "vitest";
import { calcularConceito } from "@/lib/ffr";
import { gruposParaTipo } from "@/data/grupos-ffr";

describe("calcularConceito", () => {
  it("sums obtained and possible points only for answers marked as 1 or 0", () => {
    const result = calcularConceito("LigacaoAgua", {
      gerais_identificacao: "1",
      gerais_epi: "0",
      gerais_fotos: "X",
      gerais_observacao: "free text",
      ligacao_ramal: "1",
      ligacao_cavalete: null,
      ligacao_pavimento: "0",
      qualidade_prazo: "1",
      qualidade_sistema: "X"
    });

    expect(result.somaObtida).toBe(4);
    expect(result.somaPossivel).toBe(6);
    expect(result.percentual).toBeCloseTo(4 / 6);
    expect(result.conceito).toBe("C");
  });

  it("returns NaoAvaliado when no weighted item is applicable", () => {
    const result = calcularConceito("Outros", {
      gerais_observacao: "sem avaliacao",
      outros_obs: "texto",
      qualidade_prazo: "X",
      qualidade_sistema: null
    });

    expect(result.somaObtida).toBe(0);
    expect(result.somaPossivel).toBe(0);
    expect(result.percentual).toBe(0);
    expect(result.conceito).toBe("NaoAvaliado");
  });
});

describe("gruposParaTipo", () => {
  it("always includes general groups and only the specific service group", () => {
    const groups = gruposParaTipo("CorteAgua").map((group) => group.id);

    expect(groups).toContain("gerais");
    expect(groups).toContain("qualidade_final");
    expect(groups).toContain("corte_agua");
    expect(groups).not.toContain("ligacao_agua");
    expect(groups).not.toContain("troca_hidrometro");
  });
});
