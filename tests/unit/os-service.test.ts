import { describe, expect, it, vi } from "vitest";
import type { OrdemServico, StatusOS } from "@prisma/client";
import {
  atribuirOrdem,
  buildListWhere,
  listOrdens,
  updateOrdemStatus,
  type FiscalRef,
  type OrdemRepository
} from "@/server/os-service";

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
    tipoServico: "LigacaoAgua",
    status: "NaFila",
    poloId: "p1",
    fiscalId: "f1",
    observacao: null,
    dataProgramada: null,
    iniciadaEm: null,
    concluidaEm: null,
    canceladaEm: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function repo(
  record: OrdemServico,
  hasTabulacao = false,
  fiscal: FiscalRef | null = { id: "f2", perfil: "fiscal", poloId: "p1" },
  claimed: OrdemServico | null = null,
  hasOpenWork = false
): OrdemRepository {
  return {
    findPage: vi.fn(async () => ({ rows: [record], total: 1 })),
    claimNextAvailable: vi.fn(async () => claimed),
    findById: vi.fn(async () => record),
    hasTabulacao: vi.fn(async () => hasTabulacao),
    updateStatus: vi.fn(async (_id, data) => ({ ...record, ...data })),
    findFiscalById: vi.fn(async () => fiscal),
    hasOpenWork: vi.fn(async () => hasOpenWork),
    updateFiscal: vi.fn(async (_id, fiscalId) => ({ ...record, fiscalId })),
    log: vi.fn(async () => undefined)
  };
}

describe("listOrdens", () => {
  it("claims the next OS from the fiscal's polo before listing assigned OS", async () => {
    const claimed = os({ fiscalId: "f1", poloId: "p1" });
    const repository = repo(claimed, false, undefined, claimed);

    await listOrdens(repository, { id: "f1", perfil: "fiscal", poloId: "p1" });

    expect(repository.claimNextAvailable).toHaveBeenCalledWith("p1", "f1");
    expect(repository.findPage).toHaveBeenCalledWith({ fiscalId: "f1" }, { skip: 0, take: 20 });
  });

  it("logs an automatic assignment when an OS is claimed", async () => {
    const claimed = os({ fiscalId: "f1", poloId: "p1" });
    const repository = repo(claimed, false, undefined, claimed);

    await listOrdens(repository, { id: "f1", perfil: "fiscal", poloId: "p1" });

    expect(repository.log).toHaveBeenCalledWith({
      evento: "atribuicao",
      descricao: "OS 1001 atribuida automaticamente ao fiscal f1",
      userId: "f1",
      ordemServicoId: "os1",
      metadata: { fiscalId: "f1", poloId: "p1", ordemServicoId: "os1" }
    });
  });

  it("does not log when the fiscal already has open work or no OS is available", async () => {
    const repository = repo(os());

    await listOrdens(repository, { id: "f1", perfil: "fiscal", poloId: "p1" });

    expect(repository.claimNextAvailable).toHaveBeenCalledWith("p1", "f1");
    expect(repository.log).not.toHaveBeenCalled();
  });

  it("does not claim an OS for a fiscal without a polo", async () => {
    const repository = repo(os());

    await listOrdens(repository, { id: "f1", perfil: "fiscal", poloId: null });

    expect(repository.claimNextAvailable).not.toHaveBeenCalled();
  });

  it("scopes monitor users to their whole região", async () => {
    const repository = repo(os());

    await listOrdens(repository, {
      id: "m1",
      perfil: "monitor",
      regiao: "Campinas"
    });

    expect(repository.findPage).toHaveBeenCalledWith(
      { regiaoAdministrativa: { in: ["Campinas"] } },
      { skip: 0, take: 20 }
    );
    expect(repository.claimNextAvailable).not.toHaveBeenCalled();
  });

  it("paginates and only auto-claims on the first page", async () => {
    const repository = repo(os(), false, undefined, os());

    const result = await listOrdens(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, { page: 2 });

    expect(repository.claimNextAvailable).not.toHaveBeenCalled();
    expect(repository.findPage).toHaveBeenCalledWith({ fiscalId: "f1" }, { skip: 20, take: 20 });
    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 20 });
  });

  it("applies queue filters to the scoped where", async () => {
    const repository = repo(os());

    await listOrdens(
      repository,
      { id: "s1", perfil: "supervisor" },
      { filters: { status: "Pendente", poloId: "p9", fiscalId: null } }
    );

    expect(repository.findPage).toHaveBeenCalledWith(
      { status: "Pendente", poloId: "p9", fiscalId: null },
      { skip: 0, take: 20 }
    );
  });
});

describe("buildListWhere", () => {
  it("merges scope with filters and maps the SEM_FISCAL sentinel (null) and busca", () => {
    expect(
      buildListWhere(
        { regiaoAdministrativa: { in: ["Campinas"] } },
        { fiscalId: null, status: "NaFila", busca: "1001" }
      )
    ).toEqual({
      regiaoAdministrativa: { in: ["Campinas"] },
      fiscalId: null,
      status: "NaFila",
      OR: [
        { numero: { contains: "1001", mode: "insensitive" } },
        { enderecoCompleto: { contains: "1001", mode: "insensitive" } }
      ]
    });
  });
});

describe("updateOrdemStatus", () => {
  it("blocks access to OS outside the requester scope", async () => {
    const repository = repo(os({ fiscalId: "other" }));

    await expect(
      updateOrdemStatus(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, "os1", "EmExecucao")
    ).rejects.toThrow("OS fora do escopo do usuario");
  });

  it("blocks finishing an OS without saved tabulation", async () => {
    const repository = repo(os({ status: "EmExecucao" }), false);

    await expect(
      updateOrdemStatus(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, "os1", "Concluida")
    ).rejects.toThrow("Finalizacao exige tabulacao salva");
  });

  it("sets completion metadata when finishing with a saved tabulation", async () => {
    const repository = repo(os({ status: "EmExecucao" }), true);

    const updated = await updateOrdemStatus(
      repository,
      { id: "f1", perfil: "fiscal", poloId: "p1" },
      "os1",
      "Concluida",
      new Date("2026-06-07T12:00:00.000Z")
    );

    expect(updated.status).toBe("Concluida");
    expect(updated.concluidaEm?.toISOString()).toBe("2026-06-07T12:00:00.000Z");
    expect(repository.log).toHaveBeenCalledWith({
      evento: "status",
      descricao: "OS 1001 alterada para Concluida",
      userId: "f1",
      ordemServicoId: "os1",
      metadata: { from: "EmExecucao", to: "Concluida" }
    });
  });

  it("uses logical cancellation and preserves the record", async () => {
    const repository = repo(os({ status: "Pendente" }), false);

    const updated = await updateOrdemStatus(
      repository,
      { id: "m1", perfil: "monitor", poloId: "p1" },
      "os1",
      "Cancelada",
      new Date("2026-06-07T13:00:00.000Z")
    );

    expect(updated.status).toBe("Cancelada");
    expect(updated.canceladaEm?.toISOString()).toBe("2026-06-07T13:00:00.000Z");
    expect(repository.updateStatus).toHaveBeenCalledWith("os1", expect.objectContaining({ status: "Cancelada" }));
  });

  it("rejects invalid transitions", async () => {
    const repository = repo(os({ status: "NaFila" }), false);

    await expect(
      updateOrdemStatus(repository, { id: "m1", perfil: "monitor", poloId: "p1" }, "os1", "Concluida")
    ).rejects.toThrow("Finalizacao exige tabulacao salva");
  });
});

describe("atribuirOrdem", () => {
  it("denies users without the os:write capability", async () => {
    const repository = repo(os());

    await expect(
      atribuirOrdem(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, "os1", "f2")
    ).rejects.toThrow("Sem permissao para atribuir OS");
    expect(repository.updateFiscal).not.toHaveBeenCalled();
  });

  it("blocks assigning an OS outside the requester scope", async () => {
    const repository = repo(os({ poloId: "p9", fiscalId: null }));

    await expect(
      atribuirOrdem(repository, { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] }, "os1", "f2")
    ).rejects.toThrow("OS fora do escopo do usuario");
  });

  it("rejects a target that is not a fiscal", async () => {
    const repository = repo(os({ fiscalId: null }), false, { id: "m2", perfil: "monitor", poloId: "p1" });

    await expect(
      atribuirOrdem(repository, { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] }, "os1", "m2")
    ).rejects.toThrow("Fiscal invalido");
  });

  it("rejects an unknown fiscal", async () => {
    const repository = repo(os({ fiscalId: null }), false, null);

    await expect(
      atribuirOrdem(repository, { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] }, "os1", "ghost")
    ).rejects.toThrow("Fiscal invalido");
  });

  it("blocks a monitor from assigning a fiscal outside their polos", async () => {
    const repository = repo(os({ fiscalId: null }), false, { id: "f2", perfil: "fiscal", poloId: "p2" });

    await expect(
      atribuirOrdem(repository, { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] }, "os1", "f2")
    ).rejects.toThrow("Fiscal fora do escopo do usuario");
    expect(repository.updateFiscal).not.toHaveBeenCalled();
  });

  it("blocks assigning a second open OS to the same fiscal", async () => {
    const repository = repo(
      os({ fiscalId: null }),
      false,
      { id: "f2", perfil: "fiscal", poloId: "p1" },
      null,
      true
    );

    await expect(
      atribuirOrdem(
        repository,
        { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] },
        "os1",
        "f2"
      )
    ).rejects.toThrow("Fiscal ja possui OS aberta");
    expect(repository.hasOpenWork).toHaveBeenCalledWith("f2", "os1");
    expect(repository.updateFiscal).not.toHaveBeenCalled();
  });

  it("lets a supervisor assign a fiscal from any polo", async () => {
    const repository = repo(os({ fiscalId: null }), false, { id: "f2", perfil: "fiscal", poloId: "p9" });

    const updated = await atribuirOrdem(
      repository,
      { id: "sup", perfil: "supervisor", poloId: "p1" },
      "os1",
      "f2"
    );

    expect(updated.fiscalId).toBe("f2");
  });

  it("assigns a fiscal and logs an atribuicao when previously unassigned", async () => {
    const repository = repo(os({ fiscalId: null }));

    const updated = await atribuirOrdem(
      repository,
      { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] },
      "os1",
      "f2"
    );

    expect(updated.fiscalId).toBe("f2");
    expect(repository.updateFiscal).toHaveBeenCalledWith("os1", "f2");
    expect(repository.log).toHaveBeenCalledWith({
      evento: "atribuicao",
      descricao: "OS 1001 atribuida ao fiscal f2",
      userId: "m1",
      ordemServicoId: "os1",
      metadata: { from: null, to: "f2" }
    });
  });

  it("logs a reatribuicao when the OS already had a fiscal", async () => {
    const repository = repo(os({ fiscalId: "f1" }));

    await atribuirOrdem(
      repository,
      { id: "sup", perfil: "supervisor", poloId: "p1" },
      "os1",
      "f2"
    );

    expect(repository.log).toHaveBeenCalledWith({
      evento: "reatribuicao",
      descricao: "OS 1001 atribuida ao fiscal f2",
      userId: "sup",
      ordemServicoId: "os1",
      metadata: { from: "f1", to: "f2" }
    });
  });
});
