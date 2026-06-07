import { describe, expect, it, vi } from "vitest";
import type { AvaliacaoRepository } from "@/server/avaliacao-service";
import { criarAvaliacao } from "@/server/avaliacao-service";

function repo(options: { tabulacaoExists?: boolean } = {}): AvaliacaoRepository {
  return {
    findTabulacaoById: vi.fn(async () => (options.tabulacaoExists === false ? null : { id: "tab1" })),
    create: vi.fn(async (input) => ({ id: "av1", ...input }))
  };
}

const supervisor = { id: "sup", perfil: "supervisor" as const, poloId: null };
const monitor = { id: "m1", perfil: "monitor" as const, poloId: "p1" };

describe("criarAvaliacao", () => {
  it("denies users without the avaliacoes:write capability", async () => {
    const repository = repo();

    await expect(criarAvaliacao(repository, monitor, "tab1", { nota: 4 })).rejects.toThrow(
      "Sem permissao para avaliar tabulacoes"
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects notes outside the review scale", async () => {
    const repository = repo();

    await expect(criarAvaliacao(repository, supervisor, "tab1", { nota: 6 })).rejects.toThrow(
      "Avaliacao invalida"
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("throws when the tabulation does not exist", async () => {
    const repository = repo({ tabulacaoExists: false });

    await expect(criarAvaliacao(repository, supervisor, "missing", { nota: 4 })).rejects.toThrow(
      "Tabulacao nao encontrada"
    );
  });

  it("creates a supervisor review with a trimmed comment", async () => {
    const repository = repo();

    const result = await criarAvaliacao(repository, supervisor, "tab1", {
      nota: 5,
      comentario: "  Revisado  "
    });

    expect(repository.create).toHaveBeenCalledWith({
      tabulacaoId: "tab1",
      avaliadorId: "sup",
      nota: 5,
      comentario: "Revisado"
    });
    expect(result.id).toBe("av1");
  });
});
