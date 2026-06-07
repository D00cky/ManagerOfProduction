import { describe, expect, it, vi } from "vitest";
import type { Perfil } from "@prisma/client";
import { listEquipe, type EquipeRepository, type MembroEquipe } from "@/server/equipe-service";

function membro(overrides: Partial<MembroEquipe> = {}): MembroEquipe {
  return {
    id: "u1",
    name: "Fulano",
    matricula: "F0001",
    perfil: "fiscal" as Perfil,
    status: "ativo",
    poloId: "p1",
    lastSeenAt: null,
    ...overrides
  };
}

function repo(): EquipeRepository {
  return {
    list: vi.fn(async () => [membro()])
  };
}

describe("listEquipe", () => {
  it("denies users without the equipe:read capability", async () => {
    const repository = repo();

    await expect(
      listEquipe(repository, { id: "f1", perfil: "fiscal", poloId: "p1" })
    ).rejects.toThrow("Sem permissao para ver a equipe");
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("lists the whole team for a supervisor", async () => {
    const repository = repo();

    await listEquipe(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(repository.list).toHaveBeenCalledWith(undefined);
  });

  it("scopes a monitor to their authorized polos", async () => {
    const repository = repo();

    await listEquipe(repository, {
      id: "m1",
      perfil: "monitor",
      poloId: "p1",
      polosPermitidos: ["p1", "p2"]
    });

    expect(repository.list).toHaveBeenCalledWith(["p1", "p2"]);
  });

  it("returns the members with presence info", async () => {
    const seen = new Date("2026-06-07T09:00:00.000Z");
    const repository: EquipeRepository = {
      list: vi.fn(async () => [membro({ lastSeenAt: seen })])
    };

    const result = await listEquipe(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(result).toEqual([expect.objectContaining({ id: "u1", lastSeenAt: seen })]);
  });
});
