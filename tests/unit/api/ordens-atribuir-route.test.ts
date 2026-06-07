import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const atribuirOrdem = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/os-service", () => ({ atribuirOrdem }));
vi.mock("@/server/prisma-os-repository", () => ({ prismaOrdemRepository: { name: "repo" } }));

function request(body?: unknown) {
  return new Request("http://localhost/api/ordens/os1/atribuir", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe("POST /api/ordens/[id]/atribuir", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/ordens/[id]/atribuir/route");

    const response = await POST(request({ fiscalId: "f2" }), {
      params: Promise.resolve({ id: "os1" })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Nao autenticado" });
  });

  it("returns 400 when fiscalId is missing", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor", poloId: "p1" });
    const { POST } = await import("@/app/api/ordens/[id]/atribuir/route");

    const response = await POST(request({}), { params: Promise.resolve({ id: "os1" }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Fiscal invalido" });
    expect(atribuirOrdem).not.toHaveBeenCalled();
  });

  it("assigns the OS through the service", async () => {
    const user = { id: "m1", perfil: "monitor", poloId: "p1" };
    const updated = { id: "os1", fiscalId: "f2" };
    getCurrentUser.mockResolvedValue(user);
    atribuirOrdem.mockResolvedValue(updated);
    const { POST } = await import("@/app/api/ordens/[id]/atribuir/route");

    const response = await POST(request({ fiscalId: "f2" }), {
      params: Promise.resolve({ id: "os1" })
    });

    expect(response.status).toBe(200);
    expect(atribuirOrdem).toHaveBeenCalledWith({ name: "repo" }, user, "os1", "f2");
    await expect(response.json()).resolves.toEqual({ data: updated });
  });

  it("returns 403 when the service denies the assignment", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal", poloId: "p1" });
    atribuirOrdem.mockRejectedValue(new Error("Sem permissao para atribuir OS"));
    const { POST } = await import("@/app/api/ordens/[id]/atribuir/route");

    const response = await POST(request({ fiscalId: "f2" }), {
      params: Promise.resolve({ id: "os1" })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Sem permissao para atribuir OS" });
  });

  it("returns 400 for other assignment errors", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor", poloId: "p1" });
    atribuirOrdem.mockRejectedValue(new Error("Fiscal invalido"));
    const { POST } = await import("@/app/api/ordens/[id]/atribuir/route");

    const response = await POST(request({ fiscalId: "f2" }), {
      params: Promise.resolve({ id: "os1" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Fiscal invalido" });
  });
});
