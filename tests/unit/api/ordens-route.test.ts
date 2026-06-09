import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const listOrdens = vi.fn();
const updateOrdemStatus = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/os-service", () => ({ listOrdens, updateOrdemStatus }));
vi.mock("@/server/prisma-os-repository", () => ({ prismaOrdemRepository: { name: "repo" } }));

describe("GET /api/ordens", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/ordens/route");

    const response = await GET(new Request("http://localhost/api/ordens"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Nao autenticado" });
  });

  it("lists a paginated, filtered page using the authenticated user scope", async () => {
    const user = { id: "m1", perfil: "monitor", regiao: "Campinas" };
    const rows = [{ id: "os1", numero: "1001" }];
    getCurrentUser.mockResolvedValue(user);
    listOrdens.mockResolvedValue({ rows, total: 1, page: 2, pageSize: 20 });
    const { GET } = await import("@/app/api/ordens/route");

    const response = await GET(
      new Request("http://localhost/api/ordens?page=2&status=Pendente&fiscalId=__sem_fiscal__")
    );

    expect(response.status).toBe(200);
    expect(listOrdens).toHaveBeenCalledWith(
      { name: "repo" },
      user,
      { filters: { status: "Pendente", fiscalId: null }, page: 2 }
    );
    await expect(response.json()).resolves.toEqual({ data: rows, total: 1, page: 2, pageSize: 20 });
  });
});

describe("PATCH /api/ordens/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/ordens/[id]/route");

    const response = await PATCH(new Request("http://localhost/api/ordens/os1", { method: "PATCH" }), {
      params: Promise.resolve({ id: "os1" })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Nao autenticado" });
  });

  it("updates OS status through the service", async () => {
    const user = { id: "f1", perfil: "fiscal", poloId: "p1" };
    const updated = { id: "os1", status: "EmExecucao" };
    getCurrentUser.mockResolvedValue(user);
    updateOrdemStatus.mockResolvedValue(updated);
    const { PATCH } = await import("@/app/api/ordens/[id]/route");

    const response = await PATCH(
      new Request("http://localhost/api/ordens/os1", {
        method: "PATCH",
        body: JSON.stringify({ status: "EmExecucao" })
      }),
      { params: Promise.resolve({ id: "os1" }) }
    );

    expect(response.status).toBe(200);
    expect(updateOrdemStatus).toHaveBeenCalledWith({ name: "repo" }, user, "os1", "EmExecucao");
    await expect(response.json()).resolves.toEqual({ data: updated });
  });

  it("returns 400 for invalid status payload", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor", poloId: "p1" });
    const { PATCH } = await import("@/app/api/ordens/[id]/route");

    const response = await PATCH(
      new Request("http://localhost/api/ordens/os1", {
        method: "PATCH",
        body: JSON.stringify({ status: "Excluida" })
      }),
      { params: Promise.resolve({ id: "os1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Status invalido" });
  });
});
