import { describe, expect, it } from "vitest";
import {
  chaveCampoTexto,
  gruposFfr,
  naoExecutadoAplica,
  preencherAutoNA,
  CAMPO_TEXTO_PREFIX
} from "@/data/grupos-ffr";

const itensDe = (id: string) => gruposFfr.find((g) => g.id === id)?.itens ?? [];
const item = (grupoId: string, itemId: string) =>
  itensDe(grupoId).find((i) => i.id === itemId);

describe("naoExecutadoAplica", () => {
  it("é true só quando todos os Itens Gerais pontuados são Não conforme", () => {
    expect(naoExecutadoAplica({ gerais_q1: "0", gerais_q2: "0", gerais_q3: "0" })).toBe(true);
  });

  it("é false quando algum Item Geral pontuado é Conforme", () => {
    expect(naoExecutadoAplica({ gerais_q1: "0", gerais_q2: "1", gerais_q3: "0" })).toBe(false);
  });

  it("é false quando algum Item Geral pontuado é N/A ou vazio", () => {
    expect(naoExecutadoAplica({ gerais_q1: "0", gerais_q2: "X", gerais_q3: "0" })).toBe(false);
    expect(naoExecutadoAplica({ gerais_q1: "0", gerais_q2: "0" })).toBe(false);
    expect(naoExecutadoAplica({})).toBe(false);
  });

  it("ignora o item informativo gerais_q4 (peso 0)", () => {
    expect(
      naoExecutadoAplica({ gerais_q1: "0", gerais_q2: "0", gerais_q3: "0", gerais_q4: "1" })
    ).toBe(true);
  });
});

describe("itens com campoTexto (revelar caixa de texto)", () => {
  it("danos de terceiros vira 3-estados (peso 0) com caixa em Conforme e Não conforme", () => {
    const danos = item("gerais", "gerais_q4");
    expect(danos?.peso).toBe(0);
    expect(danos?.tipo).not.toBe("texto");
    expect(danos?.campoTexto?.revelarEm).toEqual(["1", "0"]);
  });

  it("a leitura do hidrômetro é anexada à pergunta de foto e revelada só em Conforme", () => {
    const foto = item("ramal_agua", "ramal_agua_q4");
    expect(foto?.peso).toBe(3);
    expect(foto?.campoTexto?.revelarEm).toEqual(["1"]);
    // chave reaproveita o id do antigo item "INFORME..." para preservar dados salvos
    expect(foto?.campoTexto?.chave).toBe("ramal_agua_q5");
    // o item "INFORME A LEITURA" separado não existe mais
    expect(item("ramal_agua", "ramal_agua_q5")).toBeUndefined();
  });

  it("não restam mais itens tipo 'texto' nos grupos", () => {
    const textos = gruposFfr.flatMap((g) => g.itens).filter((i) => i.tipo === "texto");
    expect(textos).toEqual([]);
  });

  it("chaveCampoTexto usa o prefixo dedicado", () => {
    expect(chaveCampoTexto("x")).toBe(`${CAMPO_TEXTO_PREFIX}x`);
  });
});

describe("preencherAutoNA", () => {
  const ctx = { tipoServico: "RamalAgua" as const };

  it("Itens Gerais todos N/A → OS inteira N/A (grupo do serviço + não executado)", () => {
    const out = preencherAutoNA(ctx, { gerais_q1: "X", gerais_q2: "X", gerais_q3: "X" });
    // grupo do serviço
    expect(out.ramal_agua_q1).toBe("X");
    expect(out.ramal_agua_q4).toBe("X");
    // serviço não executado
    expect(out.nao_executado_q1).toBe("X");
    expect(out.nao_executado_q3).toBe("X");
    // os Itens Gerais não são alterados
    expect(out.gerais_q1).toBe("X");
  });

  it("Itens Gerais Conforme → não executado (oculto) vira N/A, sem tocar no grupo do serviço", () => {
    const out = preencherAutoNA(ctx, { gerais_q1: "1", gerais_q2: "1", gerais_q3: "1" });
    expect(out.nao_executado_q1).toBe("X");
    expect(out.nao_executado_q3).toBe("X");
    // grupo do serviço continua a cargo do fiscal (não preenchido)
    expect(out.ramal_agua_q1).toBeUndefined();
  });

  it("Itens Gerais todos Não conforme → não executado aparece e NÃO é forçado a N/A", () => {
    const out = preencherAutoNA(ctx, {
      gerais_q1: "0",
      gerais_q2: "0",
      gerais_q3: "0",
      nao_executado_q1: "1"
    });
    expect(out.nao_executado_q1).toBe("1");
    // grupo do serviço também não é forçado
    expect(out.ramal_agua_q1).toBeUndefined();
  });

  it("é idempotente (mesma referência quando nada muda)", () => {
    const base = preencherAutoNA(ctx, { gerais_q1: "X", gerais_q2: "X", gerais_q3: "X" });
    expect(preencherAutoNA(ctx, base)).toBe(base);
  });
});
