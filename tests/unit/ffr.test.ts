import { describe, expect, it } from "vitest";
import { calcularConceito } from "@/lib/ffr";
import { gruposParaTipo, gruposParaOrdem, selecionarGrupoEspecificoId } from "@/data/grupos-ffr";

describe("calcularConceito", () => {
  it("sums obtained and possible points only for answers marked as 1 or 0", () => {
    const result = calcularConceito({ tipoServico: "LigacaoAgua" }, {
      gerais_q1: "1", // peso 3 -> obtida + possivel
      gerais_q2: "0", // peso 2 -> possivel
      gerais_q3: "X", // excluido (nao avaliado)
      gerais_q4: "texto livre", // item informativo (texto) -> excluido
      ramal_agua_q1: "1", // peso 3 -> obtida + possivel
      ramal_agua_q2: null, // excluido
      ramal_agua_q5: "12345" // item informativo (leitura) -> excluido
    });

    expect(result.somaObtida).toBe(6);
    expect(result.somaPossivel).toBe(8);
    expect(result.percentual).toBeCloseTo(6 / 8);
    expect(result.conceito).toBe("B");
  });

  it("returns NaoAvaliado when no weighted item is applicable", () => {
    const result = calcularConceito({ tipoServico: "Outros", descricaoTss: "REDE DE ESGOTO" }, {
      gerais_q4: "sem avaliacao", // texto
      gerais_q1: "X", // nao avaliado
      esgoto_q1: null
    });

    expect(result.somaObtida).toBe(0);
    expect(result.somaPossivel).toBe(0);
    expect(result.percentual).toBe(0);
    expect(result.conceito).toBe("NaoAvaliado");
  });
});

describe("selecionarGrupoEspecificoId / gruposParaOrdem", () => {
  it("maps the Descrição TSS keyword to the matching group", () => {
    expect(selecionarGrupoEspecificoId({ tipoServico: "Outros", descricaoTss: "LIGAÇÃO DE ÁGUA S/V" })).toBe("ramal_agua");
    expect(selecionarGrupoEspecificoId({ tipoServico: "Outros", descricaoTss: "RELIGAÇÃO DE ÁGUA" })).toBe("cavalete_hidrometro");
    expect(selecionarGrupoEspecificoId({ tipoServico: "Outros", descricaoTss: "REPOSIÇÃO ASFÁLTICA" })).toBe("reposicao_asfaltica");
    expect(selecionarGrupoEspecificoId({ tipoServico: "Outros", descricaoTss: "DESOBSTRUÇÃO DE RAMAL" })).toBe("desobstrucao");
    expect(selecionarGrupoEspecificoId({ tipoServico: "Outros", descricaoTss: "REDE DE ESGOTO" })).toBe("esgoto");
  });

  it("falls back to the tipoServico when the TSS text is empty/unmatched", () => {
    expect(selecionarGrupoEspecificoId({ tipoServico: "ReparoRede", descricaoTss: null })).toBe("rede_agua");
    expect(selecionarGrupoEspecificoId({ tipoServico: "Vistoria", descricaoTss: "algo sem palavra-chave" })).toBeNull();
  });

  it("always returns Itens Gerais + Serviço não executado plus at most one specific group", () => {
    const ids = gruposParaOrdem({ tipoServico: "Outros", descricaoTss: "REDE DE ESGOTO" }).map((g) => g.id);
    expect(ids).toEqual(["gerais", "nao_executado", "esgoto"]);
    // The over-broad Outros groups are no longer all shown together.
    expect(ids).not.toContain("desobstrucao");
    expect(ids).not.toContain("reposicao_asfaltica");
  });

  it("shows only the general groups for Vistoria", () => {
    expect(gruposParaOrdem({ tipoServico: "Vistoria" }).map((g) => g.id)).toEqual(["gerais", "nao_executado"]);
  });
});

describe("gruposParaTipo", () => {
  it("always includes the general groups and only the matching service group", () => {
    const groups = gruposParaTipo("CorteAgua").map((group) => group.id);

    expect(groups).toContain("gerais");
    expect(groups).toContain("nao_executado");
    expect(groups).toContain("cavalete_hidrometro");
    expect(groups).not.toContain("ramal_agua");
    expect(groups).not.toContain("rede_agua");
  });
});
