import { describe, expect, it, vi } from "vitest";
import type { OrdemServico, StatusOS } from "@prisma/client";
import {
  atribuirOrdem,
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
    bairro: null,
    cidade: null,
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
  fiscal: FiscalRef | null = { id: "f2", perfil: "fiscal", poloId: "p1" }
): OrdemRepository {
  return {
    findMany: vi.fn(async () => [record]),
    findById: vi.fn(async () => record),
    hasTabulacao: vi.fn(async () => hasTabulacao),
    updateStatus: vi.fn(async (_id, data) => ({ ...record, ...data })),
    findFiscalById: vi.fn(async () => fiscal),
    updateFiscal: vi.fn(async (_id, fiscalId) => ({ ...record, fiscalId })),
    log: vi.fn(async () => undefined)
  };
}

describe("listOrdens", () => {
  it("scopes fiscal users to their own assigned OS", async () => {
    const repository = repo(os());

    await listOrdens(repository, { id: "f1", perfil: "fiscal", poloId: "p1" });

    expect(repository.findMany).toHaveBeenCalledWith({ fiscalId: "f1" });
  });

  it("scopes monitor users to authorized polos", async () => {
    const repository = repo(os());

    await listOrdens(repository, {
      id: "m1",
      perfil: "monitor",
      poloId: "p1",
      polosPermitidos: ["p2", "p3"]
    });

    expect(repository.findMany).toHaveBeenCalledWith({ poloId: { in: ["p2", "p3"] } });
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
