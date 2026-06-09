import { describe, expect, it, vi } from "vitest";
import {
  atualizarPolo,
  criarPolo,
  listPolos,
  type PoloRepository,
  type PoloResumo
} from "@/server/polo-service";

function polo(overrides: Partial<PoloResumo> = {}): PoloResumo {
  return { id: "p1", nome: "Polo Central", codigo: "POLO-01", regiao: null, ativo: true, ...overrides };
}

function repo(options: { existing?: PoloResumo | null; byId?: PoloResumo | null } = {}): PoloRepository {
  return {
    list: vi.fn(async () => [polo()]),
    findByCodigo: vi.fn(async () => options.existing ?? null),
    findById: vi.fn(async () => (options.byId === undefined ? polo() : options.byId)),
    create: vi.fn(async (input) => polo({ id: "new", ...input })),
    update: vi.fn(async (id, data) => polo({ id, ...data }))
  };
}

const supervisor = { id: "sup", perfil: "supervisor" as const, poloId: null };
const monitor = { id: "m1", perfil: "monitor" as const, poloId: "p1" };
const fiscal = { id: "f1", perfil: "fiscal" as const, poloId: "p1" };

describe("listPolos", () => {
  it("lists polos for any authenticated user", async () => {
    const repository = repo();

    const result = await listPolos(repository, fiscal);

    expect(result).toHaveLength(1);
    expect(repository.list).toHaveBeenCalled();
  });
});

describe("criarPolo", () => {
  it("denies users without the configuracoes:write capability", async () => {
    const repository = repo();

    await expect(criarPolo(repository, monitor, { nome: "Novo", codigo: "P9" })).rejects.toThrow(
      "Sem permissao para gerenciar polos"
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects missing fields", async () => {
    const repository = repo();

    await expect(criarPolo(repository, supervisor, { nome: "", codigo: "P9" })).rejects.toThrow(
      "Dados de polo invalidos"
    );
  });

  it("rejects a duplicate codigo", async () => {
    const repository = repo({ existing: polo() });

    await expect(criarPolo(repository, supervisor, { nome: "Novo", codigo: "POLO-01" })).rejects.toThrow(
      "Codigo de polo ja cadastrado"
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("creates the polo, trimming and upper-casing the codigo", async () => {
    const repository = repo({ existing: null });

    const created = await criarPolo(repository, supervisor, { nome: "  Polo Sul ", codigo: " polo-02 " });

    expect(repository.create).toHaveBeenCalledWith({ nome: "Polo Sul", codigo: "POLO-02", regiao: null });
    expect(created.id).toBe("new");
  });

  it("stores a valid região and rejects an unknown one", async () => {
    const repository = repo({ existing: null });

    await criarPolo(repository, supervisor, { nome: "Polo SP", codigo: "P-SP", regiao: "Campinas" });
    expect(repository.create).toHaveBeenCalledWith({ nome: "Polo SP", codigo: "P-SP", regiao: "Campinas" });

    await expect(
      criarPolo(repository, supervisor, { nome: "Polo X", codigo: "P-X", regiao: "Inexistente" })
    ).rejects.toThrow("Regiao invalida");
  });
});

describe("atualizarPolo", () => {
  it("denies users without the configuracoes:write capability", async () => {
    const repository = repo();

    await expect(atualizarPolo(repository, monitor, "p1", { ativo: false })).rejects.toThrow(
      "Sem permissao para gerenciar polos"
    );
  });

  it("throws when the polo does not exist", async () => {
    const repository = repo({ byId: null });

    await expect(atualizarPolo(repository, supervisor, "ghost", { ativo: false })).rejects.toThrow(
      "Polo nao encontrado"
    );
  });

  it("deactivates a polo logically", async () => {
    const repository = repo();

    const updated = await atualizarPolo(repository, supervisor, "p1", { ativo: false });

    expect(updated.ativo).toBe(false);
    expect(repository.update).toHaveBeenCalledWith("p1", { ativo: false });
  });
});
