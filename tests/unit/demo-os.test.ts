import { describe, expect, it } from "vitest";
import { demoOrdensServico } from "@/data/demo-os";

describe("demoOrdensServico", () => {
  it("contains demonstration OS across different service types", () => {
    expect(demoOrdensServico).toHaveLength(8);
    expect(new Set(demoOrdensServico.map((ordem) => ordem.numero)).size).toBe(demoOrdensServico.length);
    expect(demoOrdensServico.map((ordem) => ordem.tipoServico)).toEqual(
      expect.arrayContaining(["RedeRamalAgua", "CavaleteHidrometro", "RedeRamalEsgoto", "Outros"])
    );
  });

  it("keeps demo OS in the seeded polo and blank status fields", () => {
    expect(demoOrdensServico.every((ordem) => ordem.poloCodigo === "POLO-01")).toBe(true);
    expect(demoOrdensServico.every((ordem) => ordem.status === "NaFila")).toBe(true);
  });

  it("does not seed more than one open OS for the same fiscal", () => {
    const assignedByFiscal = demoOrdensServico.reduce<Record<string, number>>((counts, ordem) => {
      if (ordem.fiscalMatricula) {
        counts[ordem.fiscalMatricula] = (counts[ordem.fiscalMatricula] ?? 0) + 1;
      }
      return counts;
    }, {});

    expect(Object.values(assignedByFiscal).every((count) => count <= 1)).toBe(true);
  });
});
