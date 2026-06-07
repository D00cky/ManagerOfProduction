import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const saveTabulacao = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/tabulacao-service", () => ({ saveTabulacao }));
vi.mock("@/server/prisma-tabulacao-repository", () => ({ prismaTabulacaoRepository: { name: "tab-repo" } }));

describe("PUT /api/ordens/[id]/tabulacao", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/ordens/[id]/tabulacao/route");

    const response = await PUT(new Request("http://localhost/api/ordens/os1/tabulacao", { method: "PUT" }), {
      params: Promise.resolve({ id: "os1" })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Nao autenticado" });
  });

  it("saves tabulation through the service", async () => {
    const user = { id: "f1", perfil: "fiscal", poloId: "p1" };
    const tabulacao = { id: "tab1", conceito: "A" };
    getCurrentUser.mockResolvedValue(user);
    saveTabulacao.mockResolvedValue(tabulacao);
    const { PUT } = await import("@/app/api/ordens/[id]/tabulacao/route");

    const response = await PUT(
      new Request("http://localhost/api/ordens/os1/tabulacao", {
        method: "PUT",
        body: JSON.stringify({ respostas: { gerais_identificacao: "1" }, observacoes: "ok" })
      }),
      { params: Promise.resolve({ id: "os1" }) }
    );

    expect(response.status).toBe(200);
    expect(saveTabulacao).toHaveBeenCalledWith({ name: "tab-repo" }, user, {
      ordemServicoId: "os1",
      respostas: { gerais_identificacao: "1" },
      observacoes: "ok"
    });
    await expect(response.json()).resolves.toEqual({ data: tabulacao });
  });

  it("returns 400 when respostas is missing", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal", poloId: "p1" });
    const { PUT } = await import("@/app/api/ordens/[id]/tabulacao/route");

    const response = await PUT(
      new Request("http://localhost/api/ordens/os1/tabulacao", {
        method: "PUT",
        body: JSON.stringify({ observacoes: "sem respostas" })
      }),
      { params: Promise.resolve({ id: "os1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Respostas invalidas" });
  });
});
