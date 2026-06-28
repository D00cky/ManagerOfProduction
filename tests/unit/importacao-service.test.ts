import { describe, expect, it, vi } from "vitest";
import type { StatusOS } from "@prisma/client";
import { confirmarImportacao, type ImportacaoRepository } from "@/server/importacao-service";
import type { NormalizedImportRow } from "@/lib/importacao";

const rows: NormalizedImportRow[] = [
  {
    numero: "1001",
    enderecoCompleto: "Rua A, 10",
    tipoServico: "RedeAgua", foraDeEscopo: false,
    polo: "Norte",
    fiscal: "2001",
    codigoContrato: "9999999999"
  },
  {
    numero: "1002",
    enderecoCompleto: "Rua B, 20",
    tipoServico: "RedeAgua", foraDeEscopo: false,
    polo: "Norte",
    fiscal: "Maria Fiscal",
    codigoContrato: "9999999999"
  },
  {
    numero: "",
    enderecoCompleto: "Rua C, 30",
    tipoServico: "RedeAgua", foraDeEscopo: false,
    polo: "Norte",
    codigoContrato: "9999999999"
  },
  {
    numero: "1003",
    enderecoCompleto: "",
    tipoServico: "RedeAgua", foraDeEscopo: false,
    polo: "Norte",
    codigoContrato: "9999999999"
  }
];

type ExistingOrdem = {
  numero: string;
  codigoTss?: string | null;
  codigoTse?: string | null;
  status?: StatusOS;
  fiscalId?: string | null;
  dataFimExecucao?: Date | null;
};

function repository(existingNumbers: Array<string | ExistingOrdem> = []): ImportacaoRepository {
  const existing = existingNumbers.map((entry) =>
    typeof entry === "string" ? { numero: entry } : entry
  );
  return {
    listPolos: vi.fn(async () => [{ id: "p1", nome: "Norte", codigo: "NRT", regiao: "São Paulo" }]),
    ensurePolos: vi.fn(async (values: string[]) =>
      values.map((value) => ({
        id: `polo-${value}`,
        nome: value,
        codigo: (value.split(" - ")[0] ?? value).trim(),
        regiao: null
      }))
    ),
    listFiscaisAtivos: vi.fn(async () => [
      { id: "f1", name: "Joao Fiscal", matricula: "2001" },
      { id: "f2", name: "Maria Fiscal", matricula: "2002" }
    ]),
    findOrdensByNumero: vi.fn(async (numeros: string[]) => {
      const wanted = new Set(numeros);
      return existing
        .filter((ordem) => wanted.has(ordem.numero))
        .map((ordem) => ({
          id: `os-${ordem.numero}`,
          numero: ordem.numero,
          codigoTss: ordem.codigoTss ?? null,
          codigoTse: ordem.codigoTse ?? null,
          status: ordem.status ?? ("NaFila" as StatusOS),
          fiscalId: ordem.fiscalId ?? null,
          dataFimExecucao: ordem.dataFimExecucao ?? null
        }));
    }),
    openWorkByFiscal: vi.fn(async () => []),
    createOrdens: vi.fn(async () => undefined),
    updateOrdem: vi.fn(async () => undefined),
    log: vi.fn(async () => undefined)
  };
}

describe("confirmarImportacao", () => {
  it("rejects users without the importacao:write capability", async () => {
    const repo = repository();

    await expect(
      confirmarImportacao(repo, { id: "f1", perfil: "fiscal", poloId: "p1" }, rows, "ignorar")
    ).rejects.toThrow("Sem permissao para importar OS");

    expect(repo.createOrdens).not.toHaveBeenCalled();
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
    expect(repo.createOrdens).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          numero: "1001",
          poloId: "p1",
          fiscalId: "f1",
          status: "NaFila",
          // Região is denormalized from the polo.
          regiaoAdministrativa: "São Paulo"
        }),
        expect.objectContaining({ numero: "1002", fiscalId: "f2" })
      ])
    );
  });

  it("rejeita linha sem contrato/empresa (invalida, não cria)", async () => {
    const repo = repository();
    const semContrato: NormalizedImportRow[] = [
      { numero: "8001", enderecoCompleto: "Rua Sem Contrato, 1", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte" }
    ];

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, semContrato, "ignorar");

    expect(result).toMatchObject({ criadas: 0, invalidas: 1 });
    expect(result.erros).toEqual([{ linha: 1, erros: ["contrato obrigatorio"] }]);
    expect(repo.createOrdens).not.toHaveBeenCalled();
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
          tipoServico: "RedeAgua", foraDeEscopo: false,
          polo: "ORMR - DIV MANUT SERV OPE REGISTRO",
          unidadeExecutante: "ORMR - DIV MANUT SERV OPE REGISTRO",
          codigoContrato: "9999999999"
        }
      ],
      "ignorar"
    );

    expect(repo.ensurePolos).toHaveBeenCalledWith(["ORMR - DIV MANUT SERV OPE REGISTRO"]);
    expect(result).toMatchObject({ criadas: 1, invalidas: 0 });
    expect(repo.createOrdens).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          poloId: "polo-ORMR - DIV MANUT SERV OPE REGISTRO",
          unidadeExecutante: "ORMR - DIV MANUT SERV OPE REGISTRO"
        })
      ])
    );
  });

  it("ignores duplicate OS when duplicate mode is ignorar", async () => {
    const repo = repository(["1001"]);

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [rows[0]], "ignorar");

    expect(result).toMatchObject({ criadas: 0, atualizadas: 0, ignoradas: 1, invalidas: 0 });
    expect(repo.createOrdens).not.toHaveBeenCalled();
    expect(repo.updateOrdem).not.toHaveBeenCalled();
  });

  it("updates duplicate OS when duplicate mode is atualizar", async () => {
    const repo = repository(["1001"]);

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [rows[0]], "atualizar");

    expect(result).toMatchObject({ criadas: 0, atualizadas: 1, ignoradas: 0, invalidas: 0 });
    expect(repo.updateOrdem).toHaveBeenCalledWith("os-1001", expect.objectContaining({ numero: "1001", fiscalId: "f1" }));
  });

  it("atualizar NÃO rebaixa OS concluída: preserva status, fiscal e dataFimExecucao", async () => {
    const fim = new Date("2026-06-20T12:00:00.000Z");
    const repo = repository([
      { numero: "1001", status: "Concluida", fiscalId: "f1", dataFimExecucao: fim }
    ]);
    // Reimport de uma planilha diária: a OS reaparece sem fiscal e sem data de fim.
    const reimport: NormalizedImportRow[] = [
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoContrato: "9999999999" }
    ];

    await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, reimport, "atualizar");

    expect(repo.updateOrdem).toHaveBeenCalledTimes(1);
    const [, input] = vi.mocked(repo.updateOrdem).mock.calls[0];
    expect(input.status).toBe("Concluida"); // não volta para NaFila
    expect(input.fiscalId).toBe("f1"); // não desatribui o fiscal
    expect(input.dataFimExecucao).toEqual(fim); // não apaga a data de execução
  });

  it("atualizar preenche dataFimExecucao quando a OS existente não tinha e a planilha traz", async () => {
    const fim = new Date("2026-06-22T08:00:00.000Z");
    const repo = repository([{ numero: "1001", status: "Pendente", fiscalId: "f1", dataFimExecucao: null }]);
    const baixa: NormalizedImportRow[] = [
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", dataFimExecucao: fim, codigoContrato: "9999999999" }
    ];

    await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, baixa, "atualizar");

    const [, input] = vi.mocked(repo.updateOrdem).mock.calls[0];
    expect(input.dataFimExecucao).toEqual(fim);
    expect(input.status).toBe("Pendente");
    expect(input.fiscalId).toBe("f1");
  });

  it("keeps OS unassigned when fiscal is not found", async () => {
    const repo = repository();

    await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [
      { numero: "1004", enderecoCompleto: "Rua D", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", fiscal: "9999", codigoContrato: "9999999999" }
    ], "ignorar");

    expect(repo.createOrdens).toHaveBeenCalledWith([expect.objectContaining({ fiscalId: null })]);
  });

  it("keeps an imported OS unassigned when the matched fiscal already has open work", async () => {
    const repo = repository();
    vi.mocked(repo.openWorkByFiscal).mockResolvedValue([{ fiscalId: "f1", ordemIds: ["os-outra"] }]);

    await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [rows[0]], "ignorar");

    expect(repo.openWorkByFiscal).toHaveBeenCalledWith(["f1"]);
    expect(repo.createOrdens).toHaveBeenCalledWith([expect.objectContaining({ fiscalId: null })]);
  });

  it("assigns a fiscal to at most one OS within a single batch", async () => {
    const repo = repository();
    const mesmoFiscal: NormalizedImportRow[] = [
      { numero: "7001", enderecoCompleto: "Rua A", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", fiscal: "2001", codigoContrato: "9999999999" },
      { numero: "7002", enderecoCompleto: "Rua B", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", fiscal: "2001", codigoContrato: "9999999999" }
    ];

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, mesmoFiscal, "ignorar");

    expect(result).toMatchObject({ criadas: 2 });
    const fiscalIds = vi.mocked(repo.createOrdens).mock.calls[0][0].map((ordem) => ordem.fiscalId);
    expect(fiscalIds.filter((id) => id === "f1")).toHaveLength(1);
    expect(fiscalIds.filter((id) => id === null)).toHaveLength(1);
  });

  it("still assigns the fiscal when updating their own only open OS (exclude-self)", async () => {
    const repo = repository(["1001"]);
    // The fiscal's single open OS is exactly the one being updated.
    vi.mocked(repo.openWorkByFiscal).mockResolvedValue([{ fiscalId: "f1", ordemIds: ["os-1001"] }]);

    await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [rows[0]], "atualizar");

    expect(repo.updateOrdem).toHaveBeenCalledWith("os-1001", expect.objectContaining({ fiscalId: "f1" }));
  });

  it("collapses an in-file duplicate numero into a single create (atualizar, last wins)", async () => {
    const repo = repository();
    const duplicadas: NormalizedImportRow[] = [
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoContrato: "9999999999" },
      { numero: "1001", enderecoCompleto: "Rua A, 99 (baixa)", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoContrato: "9999999999" }
    ];

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, duplicadas, "atualizar");

    expect(result).toMatchObject({ criadas: 1, atualizadas: 0, ignoradas: 1, invalidas: 0 });
    const created = vi.mocked(repo.createOrdens).mock.calls[0][0];
    expect(created).toHaveLength(1);
    // Last occurrence wins on atualizar.
    expect(created[0]).toMatchObject({ numero: "1001", enderecoCompleto: "Rua A, 99 (baixa)" });
  });

  it("collapses an in-file duplicate numero into a single create (ignorar, first wins)", async () => {
    const repo = repository();
    const duplicadas: NormalizedImportRow[] = [
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoContrato: "9999999999" },
      { numero: "1001", enderecoCompleto: "Rua A, 99 (baixa)", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoContrato: "9999999999" }
    ];

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, duplicadas, "ignorar");

    expect(result).toMatchObject({ criadas: 1, atualizadas: 0, ignoradas: 1, invalidas: 0 });
    const created = vi.mocked(repo.createOrdens).mock.calls[0][0];
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ numero: "1001", enderecoCompleto: "Rua A, 10" });
  });

  it("updates an existing numero only once when the file repeats it (atualizar)", async () => {
    const repo = repository(["1001"]);
    const duplicadas: NormalizedImportRow[] = [
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoContrato: "9999999999" },
      { numero: "1001", enderecoCompleto: "Rua A, 99 (baixa)", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoContrato: "9999999999" }
    ];

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, duplicadas, "atualizar");

    expect(result).toMatchObject({ criadas: 0, atualizadas: 1, ignoradas: 1, invalidas: 0 });
    expect(repo.createOrdens).not.toHaveBeenCalled();
    expect(repo.updateOrdem).toHaveBeenCalledTimes(1);
    expect(repo.updateOrdem).toHaveBeenCalledWith("os-1001", expect.objectContaining({ enderecoCompleto: "Rua A, 99 (baixa)" }));
  });

  it("treats same numero with different TSS/TSE as distinct OS (creates both)", async () => {
    const repo = repository();
    const mesmaOs: NormalizedImportRow[] = [
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoTss: "100", codigoTse: "A", codigoContrato: "9999999999" },
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoTss: "200", codigoTse: "B", codigoContrato: "9999999999" }
    ];

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, mesmaOs, "ignorar");

    expect(result).toMatchObject({ criadas: 2, atualizadas: 0, ignoradas: 0, invalidas: 0 });
    expect(vi.mocked(repo.createOrdens).mock.calls[0][0]).toHaveLength(2);
  });

  it("does not treat a same-numero row as duplicate of an existing OS with a different TSS/TSE", async () => {
    const repo = repository([{ numero: "1001", codigoTss: "100", codigoTse: "A" }]);
    const novaServico: NormalizedImportRow[] = [
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoTss: "200", codigoTse: "B", codigoContrato: "9999999999" }
    ];

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, novaServico, "ignorar");

    expect(result).toMatchObject({ criadas: 1, atualizadas: 0, ignoradas: 0, invalidas: 0 });
    expect(repo.updateOrdem).not.toHaveBeenCalled();
  });

  it("treats a same numero + same TSS + same TSE row as a duplicate of an existing OS", async () => {
    const repo = repository([{ numero: "1001", codigoTss: "100", codigoTse: "A" }]);
    const mesmoServico: NormalizedImportRow[] = [
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoTss: "100", codigoTse: "A", codigoContrato: "9999999999" }
    ];

    const result = await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, mesmoServico, "ignorar");

    expect(result).toMatchObject({ criadas: 0, atualizadas: 0, ignoradas: 1, invalidas: 0 });
    expect(repo.createOrdens).not.toHaveBeenCalled();
  });

  it("logs the final import summary", async () => {
    const repo = repository();

    await confirmarImportacao(repo, { id: "m1", perfil: "monitor", poloId: "p1" }, [rows[0]], "ignorar");

    expect(repo.log).toHaveBeenCalledWith({
      evento: "importacao",
      descricao: "Importacao Excel concluida: 1 criadas, 0 atualizadas, 0 ignoradas, 0 invalidas, 0 descartadas",
      userId: "m1",
      metadata: { criadas: 1, atualizadas: 0, ignoradas: 0, invalidas: 0, descartadas: 0, total: 1 }
    });
  });

  it("descarta linhas fora de escopo sem criar OS e as contabiliza", async () => {
    const repo = repository();
    const comForaDeEscopo: NormalizedImportRow[] = [
      { numero: "1001", enderecoCompleto: "Rua A, 10", tipoServico: "RedeAgua", foraDeEscopo: false, polo: "Norte", codigoContrato: "9999999999" },
      { numero: "9001", enderecoCompleto: "Rua Fora, 1", tipoServico: null, foraDeEscopo: true, polo: "Norte" }
    ];

    const result = await confirmarImportacao(
      repo,
      { id: "m1", perfil: "monitor", poloId: "p1" },
      comForaDeEscopo,
      "ignorar"
    );

    expect(result).toMatchObject({ criadas: 1, descartadas: 1, invalidas: 0, total: 2 });
    expect(vi.mocked(repo.createOrdens).mock.calls[0][0]).toHaveLength(1);
    expect(vi.mocked(repo.createOrdens).mock.calls[0][0][0]).toMatchObject({ numero: "1001" });
  });
});
