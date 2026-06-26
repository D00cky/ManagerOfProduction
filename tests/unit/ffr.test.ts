import { describe, expect, it } from "vitest";
import { calcularConceito, contarConformidade, iqesPercentual } from "@/lib/ffr";
import {
  chaveObsNaoConforme,
  gruposParaTipo,
  gruposParaOrdem,
  selecionarGrupoEspecificoId
} from "@/data/grupos-ffr";

describe("calcularConceito", () => {
  it("sums obtained and possible points only for answers marked as 1 or 0", () => {
    const result = calcularConceito({ tipoServico: "RamalAgua" }, {
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

  it("ignores Não conforme observation keys stored alongside the answers", () => {
    const semObs = calcularConceito({ tipoServico: "RamalAgua" }, {
      gerais_q1: "1", // peso 3
      gerais_q2: "0" // peso 2
    });
    const comObs = calcularConceito({ tipoServico: "RamalAgua" }, {
      gerais_q1: "1",
      gerais_q2: "0",
      [chaveObsNaoConforme("gerais_q2")]: "faltou foto"
    });

    expect(comObs).toEqual(semObs);
    expect(comObs.somaObtida).toBe(3);
    expect(comObs.somaPossivel).toBe(5);
  });

  it("returns NaoAvaliado when no weighted item is applicable", () => {
    const result = calcularConceito({ tipoServico: "RedeRamalEsgoto" }, {
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

describe("contarConformidade / iqesPercentual", () => {
  it("counts conforme/não-conforme items, excluding X, vazio, texto e peso 0", () => {
    const contagem = contarConformidade({ tipoServico: "RamalAgua" }, {
      gerais_q1: "1", // conforme
      gerais_q2: "0", // não conforme
      gerais_q3: "1", // conforme
      gerais_q4: "texto livre", // item texto (peso 0) -> excluído
      ramal_agua_q1: "X", // não avaliado -> excluído
      ramal_agua_q2: null, // vazio -> excluído
      ramal_agua_q3: "1" // conforme (grupo específico do tipo RamalAgua)
    });

    expect(contagem).toEqual({ conforme: 3, naoConforme: 1 });
    expect(iqesPercentual(contagem)).toBeCloseTo(0.75, 5);
  });

  it("returns 0 IQES when there are no evaluated items", () => {
    const contagem = contarConformidade({ tipoServico: "RamalAgua" }, {
      gerais_q1: "X",
      gerais_q4: "informativo"
    });

    expect(contagem).toEqual({ conforme: 0, naoConforme: 0 });
    expect(iqesPercentual(contagem)).toBe(0);
  });
});

describe("selecionarGrupoEspecificoId / gruposParaOrdem", () => {
  it("maps each service type to its FFR scoring group", () => {
    expect(selecionarGrupoEspecificoId({ tipoServico: "RedeAgua" })).toBe("rede_agua");
    expect(selecionarGrupoEspecificoId({ tipoServico: "RamalAgua" })).toBe("ramal_agua");
    expect(selecionarGrupoEspecificoId({ tipoServico: "CavaleteHidrometro" })).toBe("cavalete_hidrometro");
    expect(selecionarGrupoEspecificoId({ tipoServico: "RedeRamalEsgoto" })).toBe("esgoto");
    expect(selecionarGrupoEspecificoId({ tipoServico: "Desobstrucao" })).toBe("desobstrucao");
    expect(selecionarGrupoEspecificoId({ tipoServico: "LavagemEee" })).toBe("lavagem_eee");
    expect(selecionarGrupoEspecificoId({ tipoServico: "ReposicaoPiso" })).toBe("reposicao_piso");
    expect(selecionarGrupoEspecificoId({ tipoServico: "ReposicaoAsfaltica" })).toBe("reposicao_asfaltica");
  });

  it("scores LavagemEee with the lavagem_eee group", () => {
    const ids = gruposParaOrdem({ tipoServico: "LavagemEee" }).map((g) => g.id);
    expect(ids).toEqual(["gerais", "nao_executado", "lavagem_eee"]);
  });

  it("always returns Itens Gerais + Serviço não executado plus exactly one specific group", () => {
    const ids = gruposParaOrdem({ tipoServico: "RedeRamalEsgoto" }).map((g) => g.id);
    expect(ids).toEqual(["gerais", "nao_executado", "esgoto"]);
    expect(ids).not.toContain("desobstrucao");
    expect(ids).not.toContain("reposicao_asfaltica");
  });
});

describe("gruposParaTipo", () => {
  it("always includes the general groups and only the matching service group", () => {
    const groups = gruposParaTipo("CavaleteHidrometro").map((group) => group.id);

    expect(groups).toContain("gerais");
    expect(groups).toContain("nao_executado");
    expect(groups).toContain("cavalete_hidrometro");
    expect(groups).not.toContain("ramal_agua");
    expect(groups).not.toContain("rede_agua");
  });
});

describe("pontuação condicional do grupo 'Serviço não executado'", () => {
  it("ignora itens de nao_executado quando os Itens Gerais NÃO são todos Não conforme", () => {
    const result = calcularConceito(
      { tipoServico: "RamalAgua" },
      {
        gerais_q1: "1", // peso 3
        nao_executado_q1: "0", // peso 2 — não deve contar (serviço foi executado)
        nao_executado_q3: "1" // peso 3 — não deve contar
      }
    );
    // só gerais_q1 conta: 3/3
    expect(result.somaObtida).toBe(3);
    expect(result.somaPossivel).toBe(3);
  });

  it("inclui itens de nao_executado quando todos os Itens Gerais são Não conforme", () => {
    const result = calcularConceito(
      { tipoServico: "RamalAgua" },
      {
        gerais_q1: "0", // peso 3
        gerais_q2: "0", // peso 2
        gerais_q3: "0", // peso 3
        nao_executado_q3: "1" // peso 3 — agora conta
      }
    );
    // gerais: 0/8 obtido, 8 possível; nao_executado_q3: +3 obtido, +3 possível
    expect(result.somaObtida).toBe(3);
    expect(result.somaPossivel).toBe(11);
  });

  it("contarConformidade também respeita a regra do nao_executado", () => {
    const semExecucao = contarConformidade(
      { tipoServico: "RamalAgua" },
      { gerais_q1: "1", nao_executado_q1: "0", nao_executado_q3: "1" }
    );
    // nao_executado ignorado: só gerais_q1 conforme
    expect(semExecucao).toEqual({ conforme: 1, naoConforme: 0 });
  });
});
