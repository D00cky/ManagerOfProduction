import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const criarAvaliacao = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/avaliacao-service", () => ({ criarAvaliacao }));
vi.mock("@/server/prisma-avaliacao-repository", () => ({ prismaAvaliacaoRepository: { name: "repo" } }));

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/tabulacoes/tab1/avaliacoes", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe("POST /api/tabulacoes/[id]/avaliacoes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/tabulacoes/[id]/avaliacoes/route");

    const response = await POST(jsonRequest({ nota: 5 }), { params: Promise.resolve({ id: "tab1" }) });

    expect(response.status).toBe(401);
  });

  it("creates a review through the service", async () => {
    const user = { id: "sup", perfil: "supervisor" };
    getCurrentUser.mockResolvedValue(user);
    criarAvaliacao.mockResolvedValue({ id: "av1", nota: 5 });
    const { POST } = await import("@/app/api/tabulacoes/[id]/avaliacoes/route");

    const response = await POST(jsonRequest({ nota: 5, comentario: "ok" }), {
      params: Promise.resolve({ id: "tab1" })
    });

    expect(response.status).toBe(201);
    expect(criarAvaliacao).toHaveBeenCalledWith({ name: "repo" }, user, "tab1", {
      nota: 5,
      comentario: "ok"
    });
    await expect(response.json()).resolves.toEqual({ data: { id: "av1", nota: 5 } });
  });

  it("returns 403 when the service denies access", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor" });
    criarAvaliacao.mockRejectedValue(new Error("Sem permissao para avaliar tabulacoes"));
    const { POST } = await import("@/app/api/tabulacoes/[id]/avaliacoes/route");

    const response = await POST(jsonRequest({ nota: 4 }), { params: Promise.resolve({ id: "tab1" }) });

    expect(response.status).toBe(403);
  });
});
