import { describe, expect, it, vi } from "vitest";
import type { OrdemServico, StatusOS } from "@prisma/client";
import {
  atribuirOrdem,
  atribuirOrdensLote,
  buildListWhere,
  excluirOrdens,
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
    tipoServico: "RedeRamalAgua",
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
  fiscal: FiscalRef | null = { id: "f2", perfil: "fiscal", poloId: "p1", regiao: "Campinas" },
  claimed: OrdemServico | null = null
): OrdemRepository {
  return {
    findPage: vi.fn(async () => ({ rows: [record], total: 1 })),
    claimNextAvailable: vi.fn(async () => claimed),
    findById: vi.fn(async () => record),
    hasTabulacao: vi.fn(async () => hasTabulacao),
    updateStatus: vi.fn(async (_id, data) => ({ ...record, ...data })),
    findFiscalById: vi.fn(async () => fiscal),
    updateFiscal: vi.fn(async (_id, fiscalId) => ({ ...record, fiscalId })),
    assignManyToFiscal: vi.fn(async (ids: string[]) => ids.length),
    deleteOrdens: vi.fn(async () => 2),
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

  it("maps a fim-execução range to a dataFimExecucao gte/lte clause", () => {
    const fimDe = new Date(2026, 5, 1, 0, 0, 0, 0);
    const fimAte = new Date(2026, 5, 30, 23, 59, 59, 999);
    expect(buildListWhere({}, { fimDe, fimAte })).toEqual({
      dataFimExecucao: { gte: fimDe, lte: fimAte }
    });
    expect(buildListWhere({}, { fimDe })).toEqual({ dataFimExecucao: { gte: fimDe } });
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
    const repository = repo(os({ status: "Pendente", regiaoAdministrativa: "Campinas" }), false);

    const updated = await updateOrdemStatus(
      repository,
      { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" },
      "os1",
      "Cancelada",
      new Date("2026-06-07T13:00:00.000Z")
    );

    expect(updated.status).toBe("Cancelada");
    expect(updated.canceladaEm?.toISOString()).toBe("2026-06-07T13:00:00.000Z");
    expect(repository.updateStatus).toHaveBeenCalledWith("os1", expect.objectContaining({ status: "Cancelada" }));
  });

  it("lets a monitor change status of a região-matching OS in a different polo", async () => {
    // OS importada: polo auto-criado diferente, mas mesma região do monitor.
    const repository = repo(
      os({ status: "EmExecucao", poloId: "polo-importado", regiaoAdministrativa: "Campinas" }),
      false
    );

    const updated = await updateOrdemStatus(
      repository,
      { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" },
      "os1",
      "Pendente"
    );

    expect(updated.status).toBe("Pendente");
  });

  it("blocks a monitor from a status change on an OS in another região", async () => {
    const repository = repo(os({ status: "NaFila", regiaoAdministrativa: "Santos" }), false);

    await expect(
      updateOrdemStatus(
        repository,
        { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" },
        "os1",
        "EmExecucao"
      )
    ).rejects.toThrow("OS fora do escopo do usuario");
  });

  it("rejects invalid transitions", async () => {
    const repository = repo(os({ status: "NaFila", regiaoAdministrativa: "Campinas" }), false);

    await expect(
      updateOrdemStatus(
        repository,
        { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" },
        "os1",
        "Concluida"
      )
    ).rejects.toThrow("Finalizacao exige tabulacao salva");
  });

  it("self-assigns an unassigned OS to a monitor when they start it", async () => {
    const repository = repo(
      os({ status: "NaFila", fiscalId: null, regiaoAdministrativa: "Campinas" }),
      false
    );

    const updated = await updateOrdemStatus(
      repository,
      { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" },
      "os1",
      "EmExecucao"
    );

    expect(updated.fiscalId).toBe("m1");
    expect(repository.updateStatus).toHaveBeenCalledWith(
      "os1",
      expect.objectContaining({ status: "EmExecucao", fiscalId: "m1" })
    );
    expect(repository.log).toHaveBeenCalledWith({
      evento: "atribuicao",
      descricao: "OS 1001 atribuida automaticamente ao monitor m1",
      userId: "m1",
      ordemServicoId: "os1",
      metadata: { fiscalId: "m1", ordemServicoId: "os1" }
    });
  });

  it("does not steal an OS already owned by a fiscal when a monitor starts it", async () => {
    const repository = repo(
      os({ status: "NaFila", fiscalId: "f1", regiaoAdministrativa: "Campinas" }),
      false
    );

    await updateOrdemStatus(
      repository,
      { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" },
      "os1",
      "EmExecucao"
    );

    expect(repository.updateStatus).toHaveBeenCalledWith(
      "os1",
      expect.not.objectContaining({ fiscalId: expect.anything() })
    );
    expect(repository.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ evento: "atribuicao" })
    );
  });

  it("does not self-assign when a fiscal starts their own OS", async () => {
    const repository = repo(os({ status: "NaFila", fiscalId: "f1" }), false);

    await updateOrdemStatus(
      repository,
      { id: "f1", perfil: "fiscal", poloId: "p1" },
      "os1",
      "EmExecucao"
    );

    expect(repository.updateStatus).toHaveBeenCalledWith(
      "os1",
      expect.not.objectContaining({ fiscalId: expect.anything() })
    );
    expect(repository.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ evento: "atribuicao" })
    );
  });
});

describe("atribuirOrdem", () => {
  // Monitor de Campinas e OS na mesma região (o polo pode ser qualquer um, ex.: polo
  // auto-criado de uma importação) — o escopo do monitor é por região, não por polo.
  const monitorCampinas = { id: "m1", perfil: "monitor" as const, poloId: "p1", regiao: "Campinas" };
  const osCampinas = (overrides: Partial<OrdemServico> = {}) =>
    os({ regiaoAdministrativa: "Campinas", fiscalId: null, ...overrides });

  it("denies users without the os:write capability", async () => {
    const repository = repo(os());

    await expect(
      atribuirOrdem(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, "os1", "f2")
    ).rejects.toThrow("Sem permissao para atribuir OS");
    expect(repository.updateFiscal).not.toHaveBeenCalled();
  });

  it("blocks assigning an OS in another região", async () => {
    const repository = repo(osCampinas({ regiaoAdministrativa: "Santos" }));

    await expect(atribuirOrdem(repository, monitorCampinas, "os1", "f2")).rejects.toThrow(
      "OS fora do escopo do usuario"
    );
  });

  it("blocks a monitor when the OS has no regiaoAdministrativa", async () => {
    const repository = repo(osCampinas({ regiaoAdministrativa: null }));

    await expect(atribuirOrdem(repository, monitorCampinas, "os1", "f2")).rejects.toThrow(
      "OS fora do escopo do usuario"
    );
  });

  it("rejects a target that is neither fiscal nor monitor (e.g. supervisor)", async () => {
    const repository = repo(osCampinas(), false, { id: "s9", perfil: "supervisor", poloId: "p1", regiao: null });

    await expect(atribuirOrdem(repository, monitorCampinas, "os1", "s9")).rejects.toThrow("Fiscal invalido");
  });

  it("allows a monitor to assign an OS to another monitor in the same região", async () => {
    const repository = repo(osCampinas(), false, { id: "m2", perfil: "monitor", poloId: null, regiao: "Campinas" });

    const updated = await atribuirOrdem(repository, monitorCampinas, "os1", "m2");

    expect(updated.fiscalId).toBe("m2");
    expect(repository.updateFiscal).toHaveBeenCalledWith("os1", "m2");
  });

  it("blocks a monitor from assigning to a monitor in another região", async () => {
    const repository = repo(osCampinas(), false, { id: "m2", perfil: "monitor", poloId: null, regiao: "Santos" });

    await expect(atribuirOrdem(repository, monitorCampinas, "os1", "m2")).rejects.toThrow(
      "Fiscal fora do escopo do usuario"
    );
    expect(repository.updateFiscal).not.toHaveBeenCalled();
  });

  it("allows a monitor to assign an OS to themselves", async () => {
    const repository = repo(osCampinas(), false, { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" });

    const updated = await atribuirOrdem(repository, monitorCampinas, "os1", "m1");

    expect(updated.fiscalId).toBe("m1");
    expect(repository.updateFiscal).toHaveBeenCalledWith("os1", "m1");
  });

  it("allows a monitor to self-assign even if their own polo has no região", async () => {
    // Self-assign é sempre permitido, independentemente da região efetiva do responsável.
    const repository = repo(osCampinas(), false, { id: "m1", perfil: "monitor", poloId: "px", regiao: null });

    const updated = await atribuirOrdem(repository, monitorCampinas, "os1", "m1");

    expect(updated.fiscalId).toBe("m1");
  });

  it("allows a monitor to assign an imported OS (região match, different polo) to a região fiscal", async () => {
    const repository = repo(
      osCampinas({ poloId: "polo-importado" }),
      false,
      { id: "f2", perfil: "fiscal", poloId: "polo-campinas", regiao: "Campinas" }
    );

    const updated = await atribuirOrdem(repository, monitorCampinas, "os1", "f2");

    expect(updated.fiscalId).toBe("f2");
    expect(repository.updateFiscal).toHaveBeenCalledWith("os1", "f2");
  });

  it("rejects an unknown fiscal", async () => {
    const repository = repo(osCampinas(), false, null);

    await expect(atribuirOrdem(repository, monitorCampinas, "os1", "ghost")).rejects.toThrow("Fiscal invalido");
  });

  it("blocks a monitor from assigning a fiscal outside their região", async () => {
    const repository = repo(osCampinas(), false, { id: "f2", perfil: "fiscal", poloId: "p2", regiao: "Santos" });

    await expect(atribuirOrdem(repository, monitorCampinas, "os1", "f2")).rejects.toThrow(
      "Fiscal fora do escopo do usuario"
    );
    expect(repository.updateFiscal).not.toHaveBeenCalled();
  });

  it("allows assigning even when the fiscal already holds open work (backlog)", async () => {
    const repository = repo(osCampinas(), false, { id: "f2", perfil: "fiscal", poloId: "p1", regiao: "Campinas" });

    const updated = await atribuirOrdem(repository, monitorCampinas, "os1", "f2");

    expect(updated.fiscalId).toBe("f2");
    expect(repository.updateFiscal).toHaveBeenCalledWith("os1", "f2");
  });

  it("lets a supervisor assign a fiscal from any região", async () => {
    const repository = repo(os({ fiscalId: null }), false, { id: "f2", perfil: "fiscal", poloId: "p9", regiao: "Santos" });

    const updated = await atribuirOrdem(
      repository,
      { id: "sup", perfil: "supervisor", poloId: "p1" },
      "os1",
      "f2"
    );

    expect(updated.fiscalId).toBe("f2");
  });

  it("assigns a fiscal and logs an atribuicao when previously unassigned", async () => {
    const repository = repo(osCampinas({ fiscalId: null }));

    const updated = await atribuirOrdem(repository, monitorCampinas, "os1", "f2");

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

describe("atribuirOrdensLote", () => {
  it("rejects users without os:write", async () => {
    const repository = repo(os());
    await expect(
      atribuirOrdensLote(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, ["os1"], "f2")
    ).rejects.toThrow("Sem permissao");
    expect(repository.assignManyToFiscal).not.toHaveBeenCalled();
  });

  it("rejects a responsável outside the caller's região", async () => {
    const repository = repo(os(), false, { id: "f2", perfil: "fiscal", poloId: "p9", regiao: "Santos" });
    await expect(
      atribuirOrdensLote(
        repository,
        { id: "m1", perfil: "monitor", poloId: "p1", regiao: "Campinas" },
        ["os1", "os2"],
        "f2"
      )
    ).rejects.toThrow("Fiscal fora do escopo do usuario");
  });

  it("assigns every in-scope OS to the fiscal and logs the batch", async () => {
    const repository = repo(os(), false, { id: "f2", perfil: "fiscal", poloId: "p1", regiao: "Campinas" });

    const result = await atribuirOrdensLote(
      repository,
      { id: "m1", perfil: "monitor", regiao: "Campinas", polosPermitidos: ["p1"] },
      ["os1", "os2"],
      "f2"
    );

    expect(result).toEqual({ atribuidas: 2 });
    expect(repository.assignManyToFiscal).toHaveBeenCalledWith(["os1", "os2"], "f2", {
      regiaoAdministrativa: { in: ["Campinas"] }
    });
    expect(repository.log).toHaveBeenCalledWith(
      expect.objectContaining({ evento: "atribuicao", metadata: { fiscalId: "f2", total: 2 } })
    );
  });
});

describe("excluirOrdens", () => {
  it("rejects users without os:delete", async () => {
    const repository = repo(os());
    await expect(
      excluirOrdens(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, { ids: ["os1"] })
    ).rejects.toThrow("Sem permissao");
    expect(repository.deleteOrdens).not.toHaveBeenCalled();
  });

  it("hard-deletes the selected OS intersected with the caller scope", async () => {
    const repository = repo(os());

    const result = await excluirOrdens(
      repository,
      { id: "m1", perfil: "monitor", regiao: "Campinas", polosPermitidos: ["p1"] },
      { ids: ["os1", "os2"] }
    );

    expect(result).toEqual({ excluidas: 2 });
    expect(repository.deleteOrdens).toHaveBeenCalledWith({
      AND: [{ regiaoAdministrativa: { in: ["Campinas"] } }, { id: { in: ["os1", "os2"] } }]
    });
    expect(repository.log).toHaveBeenCalledWith(
      expect.objectContaining({ evento: "exclusao", metadata: { total: 2, todas: false } })
    );
  });

  it("deletes the whole filtered scope when todas is set", async () => {
    const repository = repo(os());

    await excluirOrdens(
      repository,
      { id: "sup", perfil: "supervisor", poloId: null },
      { todas: true, filters: { status: "Cancelada" } }
    );

    expect(repository.deleteOrdens).toHaveBeenCalledWith({ status: "Cancelada" });
  });

  it("is a no-op when nothing is selected and todas is not set", async () => {
    const repository = repo(os());

    const result = await excluirOrdens(repository, { id: "sup", perfil: "supervisor", poloId: null }, { ids: [] });

    expect(result).toEqual({ excluidas: 0 });
    expect(repository.deleteOrdens).not.toHaveBeenCalled();
  });
});
