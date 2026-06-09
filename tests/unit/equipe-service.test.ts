import { describe, expect, it, vi } from "vitest";
import type { Perfil } from "@prisma/client";
import {
  atualizarPoloMembro,
  listEquipe,
  type EquipeRepository,
  type MembroEquipe
} from "@/server/equipe-service";

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

function repo(found: MembroEquipe | null = membro()): EquipeRepository {
  return {
    list: vi.fn(async () => [membro()]),
    findMembro: vi.fn(async () => found),
    updatePolo: vi.fn(async (id: string, poloId: string | null) => membro({ id, poloId })),
    log: vi.fn(async () => undefined)
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
    const repository = repo(membro({ lastSeenAt: seen }));
    repository.list = vi.fn(async () => [membro({ lastSeenAt: seen })]);

    const result = await listEquipe(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(result).toEqual([expect.objectContaining({ id: "u1", lastSeenAt: seen })]);
  });
});

describe("atualizarPoloMembro", () => {
  it("denies a fiscal (no equipe:write)", async () => {
    const repository = repo();

    await expect(
      atualizarPoloMembro(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, "u1", "p2")
    ).rejects.toThrow("Sem permissao para alterar polo da equipe");
    expect(repository.updatePolo).not.toHaveBeenCalled();
  });

  it("lets a supervisor reassign any member to any polo and logs it", async () => {
    const repository = repo(membro({ poloId: "p1" }));

    const updated = await atualizarPoloMembro(
      repository,
      { id: "sup", perfil: "supervisor", poloId: null },
      "u1",
      "p9"
    );

    expect(repository.updatePolo).toHaveBeenCalledWith("u1", "p9");
    expect(updated.poloId).toBe("p9");
    expect(repository.log).toHaveBeenCalledWith(
      expect.objectContaining({ evento: "usuario", userId: "sup" })
    );
  });

  it("lets a monitor reassign within their own polos", async () => {
    const repository = repo(membro({ poloId: "p1" }));

    await atualizarPoloMembro(
      repository,
      { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1", "p2"] },
      "u1",
      "p2"
    );

    expect(repository.updatePolo).toHaveBeenCalledWith("u1", "p2");
  });

  it("denies a monitor when the destination polo is out of scope", async () => {
    const repository = repo(membro({ poloId: "p1" }));

    await expect(
      atualizarPoloMembro(
        repository,
        { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] },
        "u1",
        "p2"
      )
    ).rejects.toThrow("Sem permissao para alterar polo deste membro");
    expect(repository.updatePolo).not.toHaveBeenCalled();
  });

  it("denies a monitor when the member is outside their scope", async () => {
    const repository = repo(membro({ poloId: "p3" }));

    await expect(
      atualizarPoloMembro(
        repository,
        { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] },
        "u1",
        "p1"
      )
    ).rejects.toThrow("Sem permissao para alterar polo deste membro");
    expect(repository.updatePolo).not.toHaveBeenCalled();
  });

  it("errors when the member does not exist", async () => {
    const repository = repo(null);

    await expect(
      atualizarPoloMembro(repository, { id: "sup", perfil: "supervisor", poloId: null }, "x", "p1")
    ).rejects.toThrow("Membro nao encontrado");
  });
});
