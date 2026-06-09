import { describe, expect, it } from "vitest";
import {
  FILTROS_VAZIOS,
  SEM_FISCAL,
  filtrarOrdens,
  paginar,
  type FilaFiltravel,
  type FilaFiltros
} from "@/lib/fila-filtros";

function row(over: Partial<FilaFiltravel>): FilaFiltravel {
  return {
    poloId: "polo-1",
    fiscalId: "fiscal-1",
    tipoServico: "LigacaoAgua",
    status: "NaFila",
    ...over
  };
}

function filtros(over: Partial<FilaFiltros>): FilaFiltros {
  return { ...FILTROS_VAZIOS, ...over };
}

describe("filtrarOrdens", () => {
  it("returns everything when no filter is set", () => {
    const rows = [row({}), row({ poloId: "polo-2" })];
    expect(filtrarOrdens(rows, FILTROS_VAZIOS)).toHaveLength(2);
  });

  it("filters by polo", () => {
    const rows = [row({ poloId: "polo-1" }), row({ poloId: "polo-2" })];
    const out = filtrarOrdens(rows, filtros({ poloId: "polo-2" }));
    expect(out).toHaveLength(1);
    expect(out[0].poloId).toBe("polo-2");
  });

  it("filters by tipo de servico and status together (AND)", () => {
    const rows = [
      row({ tipoServico: "CorteAgua", status: "Concluida" }),
      row({ tipoServico: "CorteAgua", status: "Pendente" }),
      row({ tipoServico: "Vistoria", status: "Concluida" })
    ];
    const out = filtrarOrdens(rows, filtros({ tipoServico: "CorteAgua", status: "Concluida" }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ tipoServico: "CorteAgua", status: "Concluida" });
  });

  it("filters by a specific fiscal", () => {
    const rows = [row({ fiscalId: "f1" }), row({ fiscalId: "f2" }), row({ fiscalId: null })];
    const out = filtrarOrdens(rows, filtros({ fiscalId: "f2" }));
    expect(out).toHaveLength(1);
    expect(out[0].fiscalId).toBe("f2");
  });

  it("matches only unassigned OS with the SEM_FISCAL sentinel", () => {
    const rows = [row({ fiscalId: "f1" }), row({ fiscalId: null }), row({ fiscalId: null })];
    const out = filtrarOrdens(rows, filtros({ fiscalId: SEM_FISCAL }));
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.fiscalId === null)).toBe(true);
  });
});

describe("paginar", () => {
  const rows = Array.from({ length: 45 }, (_, i) => i);

  it("returns the requested page slice", () => {
    const page2 = paginar(rows, 2, 20);
    expect(page2.itens).toEqual(rows.slice(20, 40));
    expect(page2).toMatchObject({ paginaAtual: 2, totalPaginas: 3, total: 45 });
  });

  it("clamps an out-of-range page to the last available page", () => {
    const page = paginar(rows, 99, 20);
    expect(page.paginaAtual).toBe(3);
    expect(page.itens).toEqual(rows.slice(40, 45));
  });

  it("reports at least one page for an empty list", () => {
    const page = paginar([], 1, 20);
    expect(page).toMatchObject({ paginaAtual: 1, totalPaginas: 1, total: 0 });
    expect(page.itens).toEqual([]);
  });
});
