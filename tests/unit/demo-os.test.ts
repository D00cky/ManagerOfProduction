import { describe, expect, it } from "vitest";
import { demoOrdensServico } from "@/data/demo-os";

describe("demoOrdensServico", () => {
  it("contains demonstration OS across different service types", () => {
    expect(demoOrdensServico).toHaveLength(8);
    expect(new Set(demoOrdensServico.map((ordem) => ordem.numero)).size).toBe(demoOrdensServico.length);
    expect(demoOrdensServico.map((ordem) => ordem.tipoServico)).toEqual(
      expect.arrayContaining(["LigacaoAgua", "Vistoria", "ReparoRede", "TrocaHidrometro"])
    );
  });

  it("keeps demo OS in the seeded polo and blank status fields", () => {
    expect(demoOrdensServico.every((ordem) => ordem.poloCodigo === "POLO-01")).toBe(true);
    expect(demoOrdensServico.every((ordem) => ordem.status === "NaFila")).toBe(true);
  });
});
