import { describe, expect, it, vi } from "vitest";
import type { OrdemServico, StatusOS } from "@prisma/client";
import { listOrdens, updateOrdemStatus, type OrdemRepository } from "@/server/os-service";

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

function repo(record: OrdemServico, hasTabulacao = false): OrdemRepository {
  return {
    findMany: vi.fn(async () => [record]),
    findById: vi.fn(async () => record),
    hasTabulacao: vi.fn(async () => hasTabulacao),
    updateStatus: vi.fn(async (_id, data) => ({ ...record, ...data })),
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
