import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const listPolos = vi.fn();
const criarPolo = vi.fn();
const atualizarPolo = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/polo-service", () => ({ listPolos, criarPolo, atualizarPolo }));
vi.mock("@/server/prisma-polo-repository", () => ({ prismaPoloRepository: { name: "repo" } }));

function jsonRequest(body?: unknown, method = "POST") {
  return new Request("http://localhost/api/polos", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe("GET /api/polos", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/polos/route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lists polos through the service", async () => {
    const user = { id: "f1", perfil: "fiscal" };
    getCurrentUser.mockResolvedValue(user);
    listPolos.mockResolvedValue([{ id: "p1" }]);
    const { GET } = await import("@/app/api/polos/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listPolos).toHaveBeenCalledWith({ name: "repo" }, user);
    await expect(response.json()).resolves.toEqual({ data: [{ id: "p1" }] });
  });
});

describe("POST /api/polos", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a polo through the service", async () => {
    const user = { id: "sup", perfil: "supervisor" };
    getCurrentUser.mockResolvedValue(user);
    criarPolo.mockResolvedValue({ id: "new" });
    const { POST } = await import("@/app/api/polos/route");

    const response = await POST(jsonRequest({ nome: "Polo Sul", codigo: "POLO-02" }));

    expect(response.status).toBe(201);
    expect(criarPolo).toHaveBeenCalledWith({ name: "repo" }, user, { nome: "Polo Sul", codigo: "POLO-02" });
    await expect(response.json()).resolves.toEqual({ data: { id: "new" } });
  });

  it("returns 403 when the service denies access", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor" });
    criarPolo.mockRejectedValue(new Error("Sem permissao para gerenciar polos"));
    const { POST } = await import("@/app/api/polos/route");

    const response = await POST(jsonRequest({ nome: "x", codigo: "y" }));

    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/polos/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates a polo through the service", async () => {
    const user = { id: "sup", perfil: "supervisor" };
    getCurrentUser.mockResolvedValue(user);
    atualizarPolo.mockResolvedValue({ id: "p1", ativo: false });
    const { PATCH } = await import("@/app/api/polos/[id]/route");

    const response = await PATCH(jsonRequest({ ativo: false }, "PATCH"), {
      params: Promise.resolve({ id: "p1" })
    });

    expect(response.status).toBe(200);
    expect(atualizarPolo).toHaveBeenCalledWith({ name: "repo" }, user, "p1", { ativo: false });
    await expect(response.json()).resolves.toEqual({ data: { id: "p1", ativo: false } });
  });
});
