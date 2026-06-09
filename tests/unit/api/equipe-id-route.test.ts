import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const atualizarPoloMembro = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/equipe-service", () => ({ atualizarPoloMembro }));
vi.mock("@/server/prisma-equipe-repository", () => ({ prismaEquipeRepository: { name: "repo" } }));

function patch(body: unknown, id = "u1") {
  return import("@/app/api/equipe/[id]/route").then(({ PATCH }) =>
    PATCH(
      new Request(`http://localhost/api/equipe/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
      { params: Promise.resolve({ id }) }
    )
  );
}

describe("PATCH /api/equipe/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await patch({ poloId: "p2" });

    expect(response.status).toBe(401);
  });

  it("updates the member polo through the service", async () => {
    const user = { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1", "p2"] };
    getCurrentUser.mockResolvedValue(user);
    atualizarPoloMembro.mockResolvedValue({ id: "u1", poloId: "p2" });

    const response = await patch({ poloId: "p2" });

    expect(response.status).toBe(200);
    expect(atualizarPoloMembro).toHaveBeenCalledWith({ name: "repo" }, user, "u1", "p2");
    await expect(response.json()).resolves.toEqual({ data: { id: "u1", poloId: "p2" } });
  });

  it("passes null when poloId is empty", async () => {
    getCurrentUser.mockResolvedValue({ id: "sup", perfil: "supervisor", poloId: null });
    atualizarPoloMembro.mockResolvedValue({ id: "u1", poloId: null });

    await patch({ poloId: "" });

    expect(atualizarPoloMembro).toHaveBeenCalledWith(expect.anything(), expect.anything(), "u1", null);
  });

  it("returns 403 when the service denies the change", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal", poloId: "p1" });
    atualizarPoloMembro.mockRejectedValue(new Error("Sem permissao para alterar polo da equipe"));

    const response = await patch({ poloId: "p2" });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Sem permissao para alterar polo da equipe" });
  });
});
