import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const atribuirOrdensLote = vi.fn();
const excluirOrdens = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/os-service", () => ({ atribuirOrdensLote, excluirOrdens }));
vi.mock("@/server/prisma-os-repository", () => ({ prismaOrdemRepository: { name: "repo" } }));

function post(url: string, body: unknown) {
  return new Request(url, { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/ordens/atribuir-lote", () => {
  beforeEach(() => vi.resetAllMocks());

  it("401 without a user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/ordens/atribuir-lote/route");
    const res = await POST(post("http://localhost/api/ordens/atribuir-lote", {}));
    expect(res.status).toBe(401);
  });

  it("400 when the payload is invalid", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor" });
    const { POST } = await import("@/app/api/ordens/atribuir-lote/route");
    const res = await POST(post("http://localhost/api/ordens/atribuir-lote", { fiscalId: "f1", ordemIds: "nope" }));
    expect(res.status).toBe(400);
    expect(atribuirOrdensLote).not.toHaveBeenCalled();
  });

  it("assigns in bulk through the service", async () => {
    const user = { id: "m1", perfil: "monitor" };
    getCurrentUser.mockResolvedValue(user);
    atribuirOrdensLote.mockResolvedValue({ atribuidas: 2 });
    const { POST } = await import("@/app/api/ordens/atribuir-lote/route");

    const res = await POST(post("http://localhost/api/ordens/atribuir-lote", { fiscalId: "f1", ordemIds: ["a", "b"] }));

    expect(res.status).toBe(200);
    expect(atribuirOrdensLote).toHaveBeenCalledWith({ name: "repo" }, user, ["a", "b"], "f1");
    await expect(res.json()).resolves.toEqual({ data: { atribuidas: 2 } });
  });
});

describe("POST /api/ordens/excluir-lote", () => {
  beforeEach(() => vi.resetAllMocks());

  it("403 maps a permission error from the service", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal" });
    excluirOrdens.mockRejectedValue(new Error("Sem permissao para excluir OS"));
    const { POST } = await import("@/app/api/ordens/excluir-lote/route");

    const res = await POST(post("http://localhost/api/ordens/excluir-lote", { ordemIds: ["a"] }));

    expect(res.status).toBe(403);
  });

  it("400 when nothing is selected and todas is not set", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor" });
    const { POST } = await import("@/app/api/ordens/excluir-lote/route");
    const res = await POST(post("http://localhost/api/ordens/excluir-lote", { ordemIds: [] }));
    expect(res.status).toBe(400);
    expect(excluirOrdens).not.toHaveBeenCalled();
  });

  it("deletes the selected OS through the service", async () => {
    const user = { id: "m1", perfil: "monitor" };
    getCurrentUser.mockResolvedValue(user);
    excluirOrdens.mockResolvedValue({ excluidas: 1 });
    const { POST } = await import("@/app/api/ordens/excluir-lote/route");

    const res = await POST(post("http://localhost/api/ordens/excluir-lote", { ordemIds: ["a"] }));

    expect(res.status).toBe(200);
    expect(excluirOrdens).toHaveBeenCalledWith(
      { name: "repo" },
      user,
      expect.objectContaining({ ids: ["a"], todas: false })
    );
    await expect(res.json()).resolves.toEqual({ data: { excluidas: 1 } });
  });
});
