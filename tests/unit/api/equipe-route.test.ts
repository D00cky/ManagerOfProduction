import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const listEquipe = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/equipe-service", () => ({ listEquipe }));
vi.mock("@/server/prisma-equipe-repository", () => ({ prismaEquipeRepository: { name: "repo" } }));

describe("GET /api/equipe", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/equipe/route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lists the team through the service", async () => {
    const user = { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] };
    getCurrentUser.mockResolvedValue(user);
    listEquipe.mockResolvedValue([{ id: "u1" }]);
    const { GET } = await import("@/app/api/equipe/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listEquipe).toHaveBeenCalledWith({ name: "repo" }, user);
    await expect(response.json()).resolves.toEqual({ data: [{ id: "u1" }] });
  });

  it("returns 403 when the service denies access", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal", poloId: "p1" });
    listEquipe.mockRejectedValue(new Error("Sem permissao para ver a equipe"));
    const { GET } = await import("@/app/api/equipe/route");

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Sem permissao para ver a equipe" });
  });
});
