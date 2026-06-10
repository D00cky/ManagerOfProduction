import { describe, expect, it } from "vitest";
import { SEM_FISCAL, parseFilaFilters } from "@/lib/fila-filtros";

describe("parseFilaFilters", () => {
  it("returns an empty filter object when nothing is set", () => {
    expect(parseFilaFilters({})).toEqual({});
    expect(parseFilaFilters({ poloId: "", fiscalId: "  ", status: null })).toEqual({});
  });

  it("maps populated query values to typed filters", () => {
    expect(
      parseFilaFilters({
        poloId: "polo-2",
        tipoServico: "CavaleteHidrometro",
        status: "Concluida",
        busca: " 1001 "
      })
    ).toEqual({
      poloId: "polo-2",
      tipoServico: "CavaleteHidrometro",
      status: "Concluida",
      busca: "1001"
    });
  });

  it("maps a specific fiscal id through", () => {
    expect(parseFilaFilters({ fiscalId: "f2" })).toEqual({ fiscalId: "f2" });
  });

  it("maps the SEM_FISCAL sentinel to a null fiscal (unassigned)", () => {
    expect(parseFilaFilters({ fiscalId: SEM_FISCAL })).toEqual({ fiscalId: null });
  });
});
