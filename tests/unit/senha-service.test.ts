import { describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { alterarSenhaPropria, type SenhaRepository } from "@/server/senha-service";

function repo(hash: string | null): SenhaRepository {
  return {
    findCredencialPorLogin: vi.fn(async () => (hash ? { id: "u1", passwordHash: hash } : null)),
    atualizarSenha: vi.fn(async () => undefined)
  };
}

const hashAtual = bcrypt.hashSync("senhaAtual1", 10);

describe("alterarSenhaPropria", () => {
  it("changes the password when the current one matches", async () => {
    const repository = repo(hashAtual);

    await alterarSenhaPropria(repository, {
      login: "F0001",
      senhaAtual: "senhaAtual1",
      novaSenha: "novaSenha2"
    });

    expect(repository.atualizarSenha).toHaveBeenCalledWith("u1", "novaSenha2");
  });

  it("rejects when the current password is wrong (generic message)", async () => {
    const repository = repo(hashAtual);

    await expect(
      alterarSenhaPropria(repository, { login: "F0001", senhaAtual: "errada", novaSenha: "novaSenha2" })
    ).rejects.toThrow("invalidos");
    expect(repository.atualizarSenha).not.toHaveBeenCalled();
  });

  it("rejects an unknown login with the same generic message", async () => {
    const repository = repo(null);

    await expect(
      alterarSenhaPropria(repository, { login: "ghost", senhaAtual: "x", novaSenha: "novaSenha2" })
    ).rejects.toThrow("invalidos");
    expect(repository.atualizarSenha).not.toHaveBeenCalled();
  });

  it("rejects a new password shorter than the minimum before any lookup", async () => {
    const repository = repo(hashAtual);

    await expect(
      alterarSenhaPropria(repository, { login: "F0001", senhaAtual: "senhaAtual1", novaSenha: "123" })
    ).rejects.toThrow("ao menos");
    expect(repository.findCredencialPorLogin).not.toHaveBeenCalled();
  });

  it("rejects when the new password equals the current one", async () => {
    const repository = repo(hashAtual);

    await expect(
      alterarSenhaPropria(repository, {
        login: "F0001",
        senhaAtual: "senhaAtual1",
        novaSenha: "senhaAtual1"
      })
    ).rejects.toThrow("diferente");
  });
});
