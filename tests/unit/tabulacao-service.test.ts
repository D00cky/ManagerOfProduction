import { describe, expect, it, vi } from "vitest";
import type { OrdemServico, Tabulacao } from "@prisma/client";
import { getTabulacaoEdicao, saveTabulacao, type TabulacaoRepository } from "@/server/tabulacao-service";

function os(overrides: Partial<OrdemServico> = {}): OrdemServico {
  const now = new Date("2026-06-07T10:00:00.000Z");
  return {
    id: "os1",
    numero: "1001",
    enderecoCompleto: "Rua A, 10",
    numeroImovel: null,
    complemento: null,
    bairro: null,
    cidade: null,
    regiaoAdministrativa: null,
    unidadeExecutante: null,
    codigoContrato: null,
    descricaoContrato: null,
    codigoTss: null,
    descricaoTss: null,
    codigoTse: null,
    descricaoTse: null,
    pde: null,
    equipe: null,
    dataInicioExecucao: null,
    dataFimExecucao: null,
    tipoServico: "RedeRamalAgua",
    status: "EmExecucao",
    poloId: "p1",
    fiscalId: "f1",
    observacao: null,
    dataProgramada: null,
    iniciadaEm: now,
    concluidaEm: null,
    canceladaEm: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function tabulacao(overrides: Partial<Tabulacao> = {}): Tabulacao {
  const now = new Date("2026-06-07T10:00:00.000Z");
  return {
    id: "tab1",
    ordemServicoId: "os1",
    fiscalId: "f1",
    tabuladoPorId: "f1",
    respostas: {},
    somaObtida: 0,
    somaPossivel: 0,
    percentual: 0,
    conceito: "NaoAvaliado",
    observacoes: null,
    bloqueada: false,
    alterada: false,
    alteradoPorId: null,
    motivoAlteracao: null,
    alteradaEm: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function repo(record: OrdemServico, existing: Tabulacao | null = null): TabulacaoRepository {
  return {
    findOrdemById: vi.fn(async () => record),
    findTabulacaoByOrdem: vi.fn(async () => existing),
    findFiscalNome: vi.fn(async () => "Fiscal Teste"),
    findUsuarioBasico: vi.fn(async () => ({ name: "Fiscal Teste", matricula: "F0001" })),
    upsertTabulacao: vi.fn(async ({ alteracao, ...base }) =>
      tabulacao({
        ...base,
        alterada: Boolean(alteracao),
        alteradoPorId: alteracao?.alteradoPorId ?? null,
        motivoAlteracao: alteracao?.motivoAlteracao ?? null,
        alteradaEm: alteracao?.alteradaEm ?? null
      })
    ),
    log: vi.fn(async () => undefined)
  };
}

describe("saveTabulacao", () => {
  it("calculates and persists the FFR result for the OS service type", async () => {
    const repository = repo(os());

    const result = await saveTabulacao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, {
      ordemServicoId: "os1",
      respostas: {
        gerais_q1: "1", // peso 3
        gerais_q2: "0", // peso 2
        ramal_agua_q1: "1" // peso 3
      },
      observacoes: "ok"
    });

    expect(repository.upsertTabulacao).toHaveBeenCalledWith(expect.objectContaining({
      ordemServicoId: "os1",
      fiscalId: "f1",
      somaObtida: 6,
      somaPossivel: 8,
      conceito: "B",
      observacoes: "ok"
    }));
    expect(result.percentual).toBeCloseTo(6 / 8);
  });

  it("blocks tabulation for OS outside the requester scope", async () => {
    const repository = repo(os({ fiscalId: "other" }));

    await expect(saveTabulacao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, {
      ordemServicoId: "os1",
      respostas: {}
    })).rejects.toThrow("OS fora do escopo do usuario");
  });

  it("blocks editing tabulation after OS is completed", async () => {
    const repository = repo(os({ status: "Concluida" }));

    await expect(saveTabulacao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, {
      ordemServicoId: "os1",
      respostas: {}
    })).rejects.toThrow("Tabulacao bloqueada para OS concluida");
  });

  it("logs tabulation changes", async () => {
    const repository = repo(os());

    await saveTabulacao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, {
      ordemServicoId: "os1",
      respostas: { gerais_identificacao: "1" }
    });

    expect(repository.log).toHaveBeenCalledWith({
      evento: "tabulacao",
      descricao: "Tabulacao salva para OS 1001",
      userId: "f1",
      ordemServicoId: "os1",
      metadata: expect.objectContaining({ conceito: expect.any(String) })
    });
  });

  it("records who tabulated and keeps the OS fiscal as the report key", async () => {
    const repository = repo(os({ fiscalId: "f1", regiaoAdministrativa: "Campinas" }));

    // A monitor in scope tabulates an OS assigned to fiscal f1.
    await saveTabulacao(repository, { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" }, {
      ordemServicoId: "os1",
      respostas: { gerais_q1: "1" }
    });

    expect(repository.upsertTabulacao).toHaveBeenCalledWith(
      expect.objectContaining({ fiscalId: "f1", tabuladoPorId: "m1", alteracao: null })
    );
  });

  it("lets a monitor tabulate an imported OS in one of their assigned polos", async () => {
    // OS importada num polo auto-criado, explicitamente atribuído ao monitor.
    const repository = repo(os({ fiscalId: "f1", poloId: "polo-importado" }));

    await saveTabulacao(repository, { id: "m1", perfil: "monitor", polosPermitidos: ["polo-importado"] }, {
      ordemServicoId: "os1",
      respostas: { gerais_q1: "1" }
    });

    expect(repository.upsertTabulacao).toHaveBeenCalled();
  });

  it("blocks a monitor from tabulating an OS in a polo not assigned to them", async () => {
    const repository = repo(os({ fiscalId: "f1", poloId: "p2" }));

    await expect(
      saveTabulacao(repository, { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] }, {
        ordemServicoId: "os1",
        respostas: { gerais_q1: "1" }
      })
    ).rejects.toThrow("OS fora do escopo do usuario");
  });

  it("requires a reason when a monitor alters someone else's tabulation", async () => {
    const existing = tabulacao({ tabuladoPorId: "f1" });
    const repository = repo(os({ fiscalId: "f1", regiaoAdministrativa: "Campinas" }), existing);

    await expect(
      saveTabulacao(repository, { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" }, {
        ordemServicoId: "os1",
        respostas: { gerais_q1: "1" }
      })
    ).rejects.toThrow("Informe o motivo da alteracao");
  });

  it("records the alteration (who + reason) when reason is provided", async () => {
    const existing = tabulacao({ tabuladoPorId: "f1" });
    const repository = repo(os({ fiscalId: "f1", regiaoAdministrativa: "Campinas" }), existing);

    await saveTabulacao(
      repository,
      { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" },
      { ordemServicoId: "os1", respostas: { gerais_q1: "1" }, motivoAlteracao: "correcao de peso" },
      new Date("2026-06-10T12:00:00.000Z")
    );

    expect(repository.upsertTabulacao).toHaveBeenCalledWith(
      expect.objectContaining({
        tabuladoPorId: "f1",
        alteracao: {
          alteradoPorId: "m1",
          motivoAlteracao: "correcao de peso",
          alteradaEm: new Date("2026-06-10T12:00:00.000Z")
        }
      })
    );
  });

  it("forbids a fiscal from altering a tabulation created by someone else", async () => {
    // OS belongs to fiscal f2 (in scope), but the tabulation was created by f1.
    const existing = tabulacao({ tabuladoPorId: "f1" });
    const repository = repo(os({ fiscalId: "f2" }), existing);

    await expect(
      saveTabulacao(repository, { id: "f2", perfil: "fiscal", poloId: "p1" }, {
        ordemServicoId: "os1",
        respostas: {}
      })
    ).rejects.toThrow("Apenas monitor ou supervisor podem alterar");
  });
});

describe("getTabulacaoEdicao", () => {
  it("throws when the OS does not exist", async () => {
    const repository: TabulacaoRepository = {
      findOrdemById: vi.fn(async () => null),
      findTabulacaoByOrdem: vi.fn(async () => null),
      findFiscalNome: vi.fn(async () => null),
      findUsuarioBasico: vi.fn(async () => null),
      upsertTabulacao: vi.fn(),
      log: vi.fn()
    };

    await expect(
      getTabulacaoEdicao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, "os1")
    ).rejects.toThrow("OS nao encontrada");
  });

  it("blocks access to an OS outside the requester scope", async () => {
    const repository = repo(os({ fiscalId: "other" }));

    await expect(
      getTabulacaoEdicao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, "os1")
    ).rejects.toThrow("OS fora do escopo do usuario");
    expect(repository.findTabulacaoByOrdem).not.toHaveBeenCalled();
  });

  it("returns the OS and any existing tabulation in scope", async () => {
    const existing = tabulacao({ observacoes: "anterior" });
    const repository = repo(os(), existing);

    const result = await getTabulacaoEdicao(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, "os1");

    expect(result.ordem.id).toBe("os1");
    expect(result.tabulacao?.observacoes).toBe("anterior");
    expect(result.fiscalNome).toBe("Fiscal Teste");
    expect(repository.findTabulacaoByOrdem).toHaveBeenCalledWith("os1");
  });
});
