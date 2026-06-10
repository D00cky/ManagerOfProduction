import { describe, expect, it, vi } from "vitest";
import type { Perfil, StatusUsuario } from "@prisma/client";
import {
  atualizarUsuario,
  criarUsuario,
  excluirUsuario,
  listUsuarios,
  type CriarUsuarioInput,
  type UsuarioRepository,
  type UsuarioResumo
} from "@/server/usuario-service";

function usuario(overrides: Partial<UsuarioResumo> = {}): UsuarioResumo {
  return {
    id: "u1",
    name: "Fulano",
    email: "fulano@example.com",
    matricula: "F0001",
    perfil: "fiscal" as Perfil,
    status: "ativo" as StatusUsuario,
    poloId: "p1",
    regiao: null,
    ...overrides
  };
}

function repo(options: { existing?: UsuarioResumo | null; byId?: UsuarioResumo | null } = {}): UsuarioRepository {
  return {
    list: vi.fn(async () => [usuario()]),
    findByLogin: vi.fn(async () => options.existing ?? null),
    findById: vi.fn(async () => (options.byId === undefined ? usuario() : options.byId)),
    create: vi.fn(async (input: CriarUsuarioInput) => usuario({ id: "new", ...input, poloId: input.poloId ?? null })),
    update: vi.fn(async (id, data) => usuario({ id, ...data })),
    remove: vi.fn(async () => undefined),
    log: vi.fn(async () => undefined)
  };
}

const supervisor = { id: "sup", perfil: "supervisor" as Perfil, poloId: null };
const monitor = { id: "m1", perfil: "monitor" as Perfil, poloId: "p1" };

const validInput: CriarUsuarioInput = {
  name: "Novo Usuario",
  email: "Novo@Example.com",
  matricula: "N0001",
  password: "senha123",
  perfil: "fiscal",
  poloId: "p1"
};

describe("listUsuarios", () => {
  it("denies users without the usuarios:write capability", async () => {
    const repository = repo();

    await expect(listUsuarios(repository, monitor)).rejects.toThrow("Sem permissao para gerenciar usuarios");
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("lists users for a supervisor", async () => {
    const repository = repo();

    const result = await listUsuarios(repository, supervisor);

    expect(result).toHaveLength(1);
    expect(repository.list).toHaveBeenCalled();
  });
});

describe("criarUsuario", () => {
  it("denies users without the usuarios:write capability", async () => {
    const repository = repo();

    await expect(criarUsuario(repository, monitor, validInput)).rejects.toThrow(
      "Sem permissao para gerenciar usuarios"
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    const repository = repo();

    await expect(
      criarUsuario(repository, supervisor, { ...validInput, password: "123" })
    ).rejects.toThrow("Dados de usuario invalidos");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email or matricula", async () => {
    const repository = repo({ existing: usuario() });

    await expect(criarUsuario(repository, supervisor, validInput)).rejects.toThrow(
      "E-mail ou matricula ja cadastrado"
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("normalizes the email, creates the user and logs the event", async () => {
    const repository = repo({ existing: null });

    const created = await criarUsuario(repository, supervisor, validInput);

    expect(repository.findByLogin).toHaveBeenCalledWith("novo@example.com", "N0001");
    expect(repository.create).toHaveBeenCalledWith({
      name: "Novo Usuario",
      email: "novo@example.com",
      matricula: "N0001",
      password: "senha123",
      perfil: "fiscal",
      poloId: "p1",
      regiao: null
    });
    expect(created.email).toBe("novo@example.com");
    expect(repository.log).toHaveBeenCalledWith(
      expect.objectContaining({ evento: "usuario", userId: "sup" })
    );
  });

  it("stores a região for monitors and ignores it for other roles", async () => {
    const repository = repo({ existing: null });

    await criarUsuario(repository, supervisor, {
      ...validInput,
      perfil: "monitor",
      matricula: "M0009",
      email: "mon@example.com",
      regiao: "Campinas"
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ perfil: "monitor", regiao: "Campinas" })
    );

    await criarUsuario(repository, supervisor, {
      ...validInput,
      perfil: "fiscal",
      matricula: "F0009",
      email: "fis@example.com",
      regiao: "Campinas"
    });
    expect(repository.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ perfil: "fiscal", regiao: null })
    );
  });
});

describe("atualizarUsuario", () => {
  it("denies users without the usuarios:write capability", async () => {
    const repository = repo();

    await expect(atualizarUsuario(repository, monitor, "u1", { status: "inativo" })).rejects.toThrow(
      "Sem permissao para gerenciar usuarios"
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("throws when the target user does not exist", async () => {
    const repository = repo({ byId: null });

    await expect(atualizarUsuario(repository, supervisor, "ghost", { status: "inativo" })).rejects.toThrow(
      "Usuario nao encontrado"
    );
  });

  it("deactivates a user logically and logs the event", async () => {
    const repository = repo();

    const updated = await atualizarUsuario(repository, supervisor, "u1", { status: "inativo" });

    expect(updated.status).toBe("inativo");
    expect(repository.update).toHaveBeenCalledWith("u1", { status: "inativo" });
    expect(repository.log).toHaveBeenCalledWith(
      expect.objectContaining({ evento: "usuario", userId: "sup" })
    );
  });

  it("changes the perfil of any user", async () => {
    const repository = repo();

    const updated = await atualizarUsuario(repository, supervisor, "u1", { perfil: "monitor" });

    expect(updated.perfil).toBe("monitor");
    expect(repository.update).toHaveBeenCalledWith("u1", { perfil: "monitor" });
  });
});

describe("excluirUsuario", () => {
  it("denies users without the usuarios:write capability", async () => {
    const repository = repo();

    await expect(excluirUsuario(repository, monitor, "u1")).rejects.toThrow(
      "Sem permissao para gerenciar usuarios"
    );
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("refuses to delete the requester's own account", async () => {
    const repository = repo();

    await expect(excluirUsuario(repository, supervisor, "sup")).rejects.toThrow(
      "Nao e possivel excluir o proprio usuario"
    );
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("throws when the target user does not exist", async () => {
    const repository = repo({ byId: null });

    await expect(excluirUsuario(repository, supervisor, "ghost")).rejects.toThrow(
      "Usuario nao encontrado"
    );
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("removes the user and logs the event", async () => {
    const repository = repo();

    await excluirUsuario(repository, supervisor, "u1");

    expect(repository.remove).toHaveBeenCalledWith("u1");
    expect(repository.log).toHaveBeenCalledWith(
      expect.objectContaining({ evento: "usuario", userId: "sup" })
    );
  });
});
