import { describe, expect, it, vi } from "vitest";
import { confirmarImportacao, type ImportacaoRepository } from "@/server/importacao-service";
import type { NormalizedImportRow } from "@/lib/importacao";

const rows: NormalizedImportRow[] = [
  {
    numero: "1001",
    enderecoCompleto: "Rua A, 10",
    tipoServico: "LigacaoAgua",
    polo: "Norte",
    fiscal: "2001"
  },
  {
    numero: "1002",
    enderecoCompleto: "Rua B, 20",
    tipoServico: "Vistoria",
    polo: "Norte",
    fiscal: "Maria Fiscal"
  },
  {
    numero: "",
    enderecoCompleto: "Rua C, 30",
    tipoServico: "Outros",
    polo: "Norte"
  },
  {
    numero: "1003",
    enderecoCompleto: "",
    tipoServico: "Outros",
    polo: "Norte"
  }
];

function repository(existingNumbers: string[] = []): ImportacaoRepository {
  const existing = new Set(existingNumbers);
  return {
    findPoloByNameOrCode: vi.fn(async (value: string) =>
      value.toLowerCase() === "norte" ? { id: "p1", nome: "Norte", codigo: "NRT" } : null
    ),
    ensurePolo: vi.fn(async (value: string) => ({
      id: `polo-${value}`,
      nome: value,
      codigo: (value.split(" - ")[0] ?? value).trim()
    })),
    findFiscalByNameOrMatricula: vi.fn(async (value: string) => {
      if (value === "2001") return { id: "f1", name: "Joao Fiscal", matricula: "2001" };
      if (value === "Maria Fiscal") return { id: "f2", name: "Maria Fiscal", matricula: "2002" };
      return null;
    }),
    hasOpenWork: vi.fn(async () => false),
    findOrdemByNumero: vi.fn(async (numero: string) => (existing.has(numero) ? { id: `os-${numero}`, numero } : null)),
    createOrdem: vi.fn(async (input) => ({ id: `new-${input.numero}`, ...input })),
    updateOrdem: vi.fn(async (id, input) => ({ id, ...input })),
    log: vi.fn(async () => undefined)
  };
}

describe("confirmarImportacao", () => {
  it("rejects users without the importacao:write capability", async () => {
    const repo = repository();

    await expect(
      confirmarImportacao(repo, { id: "f1", perfil: "fiscal", poloId: "p1" }, rows, "ignorar")
    ).rejects.toThrow("Sem permissao para importar OS");

    expect(repo.createOrdem).not.toHaveBeenCalled();
    expect(repo.updateOrdem).not.toHaveBeenCalled();
    expect(repo.log).not.toHaveBeenCalled();
  });

  it("creates valid OS and reports invalid rows", async () => {
    const repo = repository();

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, rows, "ignorar");

    expect(result).toMatchObject({ criadas: 2, atualizadas: 0, ignoradas: 0, invalidas: 2 });
    expect(result.erros).toEqual([
      { linha: 3, erros: ["numero_os obrigatorio"] },
      { linha: 4, erros: ["endereco_completo obrigatorio"] }
    ]);
    expect(repo.createOrdem).toHaveBeenCalledWith(expect.objectContaining({
      numero: "1001",
      poloId: "p1",
      fiscalId: "f1",
      status: "NaFila"
    }));
    expect(repo.createOrdem).toHaveBeenCalledWith(expect.objectContaining({ numero: "1002", fiscalId: "f2" }));
  });

  it("auto-creates a polo from the unidade executante when none matches", async () => {
    const repo = repository();

    const result = await confirmarImportacao(
      repo,
      { id: "m1", perfil: "monitor", poloId: "p1" },
      [
        {
          numero: "5001",
          enderecoCompleto: "Rua X, 1",
          tipoServico: "Outros",
          polo: "ORMR - DIV MANUT SERV OPE REGISTRO",
          unidadeExecutante: "ORMR - DIV MANUT SERV OPE REGISTRO"
        }
      ],
      "ignorar"
    );

    expect(repo.ensurePolo).toHaveBeenCalledWith("ORMR - DIV MANUT SERV OPE REGISTRO");
    expect(result).toMatchObject({ criadas: 1, invalidas: 0 });
    expect(repo.createOrdem).toHaveBeenCalledWith(
      expect.objectContaining({
        poloId: "polo-ORMR - DIV MANUT SERV OPE REGISTRO",
        unidadeExecutante: "ORMR - DIV MANUT SERV OPE REGISTRO"
      })
    );
  });

  it("ignores duplicate OS when duplicate mode is ignorar", async () => {
    const repo = repository(["1001"]);

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [rows[0]], "ignorar");

    expect(result).toMatchObject({ criadas: 0, atualizadas: 0, ignoradas: 1, invalidas: 0 });
    expect(repo.createOrdem).not.toHaveBeenCalled();
    expect(repo.updateOrdem).not.toHaveBeenCalled();
  });

  it("updates duplicate OS when duplicate mode is atualizar", async () => {
    const repo = repository(["1001"]);

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [rows[0]], "atualizar");

    expect(result).toMatchObject({ criadas: 0, atualizadas: 1, ignoradas: 0, invalidas: 0 });
    expect(repo.updateOrdem).toHaveBeenCalledWith("os-1001", expect.objectContaining({ numero: "1001", fiscalId: "f1" }));
  });

  it("keeps OS unassigned when fiscal is not found", async () => {
    const repo = repository();

    await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [
      { numero: "1004", enderecoCompleto: "Rua D", tipoServico: "Outros", polo: "Norte", fiscal: "9999" }
    ], "ignorar");

    expect(repo.createOrdem).toHaveBeenCalledWith(expect.objectContaining({ fiscalId: null }));
  });

  it("keeps an imported OS unassigned when the matched fiscal already has open work", async () => {
    const repo = repository();
    vi.mocked(repo.hasOpenWork).mockResolvedValue(true);

    await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [rows[0]], "ignorar");

    expect(repo.hasOpenWork).toHaveBeenCalledWith("f1", undefined);
    expect(repo.createOrdem).toHaveBeenCalledWith(expect.objectContaining({ fiscalId: null }));
  });

  it("logs the final import summary", async () => {
    const repo = repository();

    await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [rows[0]], "ignorar");

    expect(repo.log).toHaveBeenCalledWith({
      evento: "importacao",
      descricao: "Importacao Excel concluida: 1 criadas, 0 atualizadas, 0 ignoradas, 0 invalidas",
      userId: "m1",
      metadata: { criadas: 1, atualizadas: 0, ignoradas: 0, invalidas: 0, total: 1 }
    });
  });
});
