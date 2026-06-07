import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const listUsuarios = vi.fn();
const criarUsuario = vi.fn();
const atualizarUsuario = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/usuario-service", () => ({ listUsuarios, criarUsuario, atualizarUsuario }));
vi.mock("@/server/prisma-usuario-repository", () => ({ prismaUsuarioRepository: { name: "repo" } }));

function jsonRequest(body?: unknown, method = "POST") {
  return new Request("http://localhost/api/usuarios", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe("GET /api/usuarios", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/usuarios/route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lists users through the service", async () => {
    const user = { id: "sup", perfil: "supervisor" };
    getCurrentUser.mockResolvedValue(user);
    listUsuarios.mockResolvedValue([{ id: "u1" }]);
    const { GET } = await import("@/app/api/usuarios/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listUsuarios).toHaveBeenCalledWith({ name: "repo" }, user);
    await expect(response.json()).resolves.toEqual({ data: [{ id: "u1" }] });
  });

  it("returns 403 when the service denies access", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor" });
    listUsuarios.mockRejectedValue(new Error("Sem permissao para gerenciar usuarios"));
    const { GET } = await import("@/app/api/usuarios/route");

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Sem permissao para gerenciar usuarios" });
  });
});

describe("POST /api/usuarios", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a user through the service", async () => {
    const user = { id: "sup", perfil: "supervisor" };
    const input = { name: "X", email: "x@e.com", matricula: "X1", password: "senha123", perfil: "fiscal" };
    getCurrentUser.mockResolvedValue(user);
    criarUsuario.mockResolvedValue({ id: "new" });
    const { POST } = await import("@/app/api/usuarios/route");

    const response = await POST(jsonRequest(input));

    expect(response.status).toBe(201);
    expect(criarUsuario).toHaveBeenCalledWith({ name: "repo" }, user, input);
    await expect(response.json()).resolves.toEqual({ data: { id: "new" } });
  });

  it("returns 400 when the service rejects the payload", async () => {
    getCurrentUser.mockResolvedValue({ id: "sup", perfil: "supervisor" });
    criarUsuario.mockRejectedValue(new Error("Dados de usuario invalidos"));
    const { POST } = await import("@/app/api/usuarios/route");

    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Dados de usuario invalidos" });
  });
});

describe("PATCH /api/usuarios/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/usuarios/[id]/route");

    const response = await PATCH(jsonRequest({ status: "inativo" }, "PATCH"), {
      params: Promise.resolve({ id: "u1" })
    });

    expect(response.status).toBe(401);
  });

  it("updates a user through the service", async () => {
    const user = { id: "sup", perfil: "supervisor" };
    getCurrentUser.mockResolvedValue(user);
    atualizarUsuario.mockResolvedValue({ id: "u1", status: "inativo" });
    const { PATCH } = await import("@/app/api/usuarios/[id]/route");

    const response = await PATCH(jsonRequest({ status: "inativo" }, "PATCH"), {
      params: Promise.resolve({ id: "u1" })
    });

    expect(response.status).toBe(200);
    expect(atualizarUsuario).toHaveBeenCalledWith({ name: "repo" }, user, "u1", { status: "inativo" });
    await expect(response.json()).resolves.toEqual({ data: { id: "u1", status: "inativo" } });
  });
});
