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
    polosPermitidos: [],
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
      regiao: null,
      polosPermitidos: []
    });
    expect(created.email).toBe("novo@example.com");
    expect(repository.log).toHaveBeenCalledWith(
      expect.objectContaining({ evento: "usuario", userId: "sup" })
    );
  });

  it("stores a região for monitors and fiscais but ignores it for supervisors", async () => {
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

    // Fiscais agora carregam região (é o que torna o fiscal visível ao monitor
    // da mesma região na Equipe / atribuição da Fila).
    await criarUsuario(repository, supervisor, {
      ...validInput,
      perfil: "fiscal",
      matricula: "F0009",
      email: "fis@example.com",
      regiao: "Campinas"
    });
    expect(repository.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ perfil: "fiscal", regiao: "Campinas" })
    );

    // Supervisores enxergam tudo; nunca recebem região.
    await criarUsuario(repository, supervisor, {
      ...validInput,
      perfil: "supervisor",
      matricula: "S0009",
      email: "sup9@example.com",
      regiao: "Campinas"
    });
    expect(repository.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ perfil: "supervisor", regiao: null })
    );
  });

  it("forwards a monitor's assigned polos (deduped, falsy filtered)", async () => {
    const repository = repo({ existing: null });

    await criarUsuario(repository, supervisor, {
      ...validInput,
      perfil: "monitor",
      matricula: "M0010",
      email: "mon10@example.com",
      polosPermitidos: ["p1", "", "p2", "p1"]
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ perfil: "monitor", polosPermitidos: ["p1", "p2"] })
    );
  });

  it("never assigns polos to a supervisor", async () => {
    const repository = repo({ existing: null });

    await criarUsuario(repository, supervisor, {
      ...validInput,
      perfil: "supervisor",
      matricula: "S0010",
      email: "sup10@example.com",
      polosPermitidos: ["p1", "p2"]
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ perfil: "supervisor", polosPermitidos: [] })
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

  it("persists a região when updating a fiscal", async () => {
    const repository = repo();

    await atualizarUsuario(repository, supervisor, "u1", { perfil: "fiscal", regiao: "Campinas" });

    expect(repository.update).toHaveBeenCalledWith("u1", { perfil: "fiscal", regiao: "Campinas" });
  });

  it("clears any região when the user becomes a supervisor", async () => {
    const repository = repo();

    await atualizarUsuario(repository, supervisor, "u1", { perfil: "supervisor", regiao: "Campinas" });

    expect(repository.update).toHaveBeenCalledWith("u1", { perfil: "supervisor", regiao: null });
  });

  it("forwards updated monitor polos (deduped, falsy filtered)", async () => {
    const repository = repo({ byId: usuario({ perfil: "monitor" }) });

    await atualizarUsuario(repository, supervisor, "u1", {
      polosPermitidos: ["p1", "", "p2", "p2"]
    });

    expect(repository.update).toHaveBeenCalledWith("u1", { polosPermitidos: ["p1", "p2"] });
  });

  it("clears assigned polos when the user becomes a supervisor", async () => {
    const repository = repo({ byId: usuario({ perfil: "monitor" }) });

    await atualizarUsuario(repository, supervisor, "u1", {
      perfil: "supervisor",
      polosPermitidos: ["p1", "p2"]
    });

    expect(repository.update).toHaveBeenCalledWith("u1", {
      perfil: "supervisor",
      regiao: null,
      polosPermitidos: []
    });
  });

  it("resets the password when provided and keeps it out of the log", async () => {
    const repository = repo();

    await atualizarUsuario(repository, supervisor, "u1", { password: "novaSenha1" });

    expect(repository.update).toHaveBeenCalledWith("u1", { password: "novaSenha1" });
    expect(repository.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ senhaAlterada: true, changes: {} })
      })
    );
  });

  it("rejects a password shorter than 6 characters", async () => {
    const repository = repo();

    await expect(
      atualizarUsuario(repository, supervisor, "u1", { password: "123" })
    ).rejects.toThrow("ao menos 6");
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects an email or matricula already used by another user", async () => {
    const repository = repo({ existing: usuario({ id: "other" }) });

    await expect(
      atualizarUsuario(repository, supervisor, "u1", { email: "Other@Example.com" })
    ).rejects.toThrow("ja cadastrado");
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("allows changing identifiers when the only match is the same user", async () => {
    const repository = repo({ existing: usuario({ id: "u1" }) });

    const updated = await atualizarUsuario(repository, supervisor, "u1", { email: "New@Example.com" });

    expect(updated.email).toBe("new@example.com");
    expect(repository.update).toHaveBeenCalledWith("u1", { email: "new@example.com" });
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
