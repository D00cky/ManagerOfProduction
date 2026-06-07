import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const getConfiguracao = vi.fn();
const atualizarConfiguracao = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/configuracao-service", () => ({ getConfiguracao, atualizarConfiguracao }));
vi.mock("@/server/prisma-configuracao-repository", () => ({ prismaConfiguracaoRepository: { name: "repo" } }));

function putRequest(body?: unknown) {
  return new Request("http://localhost/api/configuracoes", {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe("GET /api/configuracoes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/configuracoes/route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns 403 when the service denies access", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor" });
    getConfiguracao.mockRejectedValue(new Error("Sem permissao para gerenciar configuracoes"));
    const { GET } = await import("@/app/api/configuracoes/route");

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("returns the configuration through the service", async () => {
    const user = { id: "sup", perfil: "supervisor" };
    getCurrentUser.mockResolvedValue(user);
    getConfiguracao.mockResolvedValue({ intervaloMin: 60 });
    const { GET } = await import("@/app/api/configuracoes/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getConfiguracao).toHaveBeenCalledWith({ name: "repo" }, user);
    await expect(response.json()).resolves.toEqual({ data: { intervaloMin: 60 } });
  });
});

describe("PUT /api/configuracoes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates the configuration through the service", async () => {
    const user = { id: "sup", perfil: "supervisor" };
    getCurrentUser.mockResolvedValue(user);
    atualizarConfiguracao.mockResolvedValue({ intervaloMin: 30 });
    const { PUT } = await import("@/app/api/configuracoes/route");

    const response = await PUT(putRequest({ intervaloMin: 30 }));

    expect(response.status).toBe(200);
    expect(atualizarConfiguracao).toHaveBeenCalledWith({ name: "repo" }, user, { intervaloMin: 30 });
    await expect(response.json()).resolves.toEqual({ data: { intervaloMin: 30 } });
  });

  it("returns 400 when the service rejects the payload", async () => {
    getCurrentUser.mockResolvedValue({ id: "sup", perfil: "supervisor" });
    atualizarConfiguracao.mockRejectedValue(new Error("Configuracao invalida"));
    const { PUT } = await import("@/app/api/configuracoes/route");

    const response = await PUT(putRequest({ intervaloMin: 0 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Configuracao invalida" });
  });
});
