import { describe, expect, it, vi } from "vitest";
import {
  atualizarConfiguracao,
  getConfiguracao,
  type ConfiguracaoRepository,
  type ConfiguracaoResumo
} from "@/server/configuracao-service";

function config(overrides: Partial<ConfiguracaoResumo> = {}): ConfiguracaoResumo {
  return {
    caminhoRede: null,
    intervaloMin: 60,
    formato: "ambos",
    autoBackup: true,
    updatedById: null,
    ...overrides
  };
}

function repo(stored: ConfiguracaoResumo | null = null): ConfiguracaoRepository {
  return {
    get: vi.fn(async () => stored),
    upsert: vi.fn(async (data) => config(data))
  };
}

const supervisor = { id: "sup", perfil: "supervisor" as const, poloId: null };
const monitor = { id: "m1", perfil: "monitor" as const, poloId: "p1" };

describe("getConfiguracao", () => {
  it("denies users without the configuracoes:write capability", async () => {
    const repository = repo();

    await expect(getConfiguracao(repository, monitor)).rejects.toThrow(
      "Sem permissao para gerenciar configuracoes"
    );
  });

  it("returns defaults when nothing is stored", async () => {
    const repository = repo(null);

    const result = await getConfiguracao(repository, supervisor);

    expect(result).toEqual({
      caminhoRede: null,
      intervaloMin: 60,
      formato: "ambos",
      autoBackup: true,
      updatedById: null
    });
  });

  it("returns the stored configuration", async () => {
    const repository = repo(config({ caminhoRede: "//rede/os", intervaloMin: 30, updatedById: "sup" }));

    const result = await getConfiguracao(repository, supervisor);

    expect(result.caminhoRede).toBe("//rede/os");
    expect(result.intervaloMin).toBe(30);
  });
});

describe("atualizarConfiguracao", () => {
  it("denies users without the configuracoes:write capability", async () => {
    const repository = repo();

    await expect(atualizarConfiguracao(repository, monitor, { intervaloMin: 30 })).rejects.toThrow(
      "Sem permissao para gerenciar configuracoes"
    );
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid interval", async () => {
    const repository = repo();

    await expect(atualizarConfiguracao(repository, supervisor, { intervaloMin: 0 })).rejects.toThrow(
      "Configuracao invalida"
    );
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown format", async () => {
    const repository = repo();

    await expect(
      atualizarConfiguracao(repository, supervisor, { formato: "docx" })
    ).rejects.toThrow("Configuracao invalida");
  });

  it("upserts the configuration stamped with the editor", async () => {
    const repository = repo();

    const result = await atualizarConfiguracao(repository, supervisor, {
      caminhoRede: "//rede/os",
      intervaloMin: 30,
      formato: "excel",
      autoBackup: false
    });

    expect(repository.upsert).toHaveBeenCalledWith({
      caminhoRede: "//rede/os",
      intervaloMin: 30,
      formato: "excel",
      autoBackup: false,
      updatedById: "sup"
    });
    expect(result.intervaloMin).toBe(30);
  });
});
