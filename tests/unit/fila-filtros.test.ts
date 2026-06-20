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
        regiao: "Campinas",
        poloId: "polo-2",
        municipio: " Sumare ",
        tipoServico: "CavaleteHidrometro",
        status: "Concluida",
        busca: " 1001 "
      })
    ).toEqual({
      regiao: "Campinas",
      poloId: "polo-2",
      municipio: "Sumare",
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

  it("parses a fim-execução date range into inclusive local day bounds", () => {
    const filters = parseFilaFilters({ fimDe: "2026-06-01", fimAte: "2026-06-30" });
    expect(filters.fimDe).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0));
    expect(filters.fimAte).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
  });

  it("ignores blank or malformed dates", () => {
    expect(parseFilaFilters({ fimDe: "", fimAte: "not-a-date" })).toEqual({});
  });
});
