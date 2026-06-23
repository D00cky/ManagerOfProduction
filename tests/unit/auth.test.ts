import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const update = vi.fn();
const userUpsert = vi.fn();
const poloUpsert = vi.fn();
const poloFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst, update, upsert: userUpsert },
    polo: { upsert: poloUpsert, findMany: poloFindMany }
  }
}));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async () => true), hashSync: vi.fn(() => "demo-hash") }
}));

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.DEMO_AUTH_ENABLED;
  });

  it("returns a database user with only their explicitly assigned polos", async () => {
    findFirst.mockResolvedValue({
      id: "u1",
      name: "Monitor Teste",
      email: "monitor@example.com",
      matricula: "M0001",
      perfil: "monitor",
      poloId: "p1",
      // Has a região, but scope must come from explicit UserPoloAccess rows, not
      // from every polo in the região (regression for the removed override).
      regiao: "Campinas",
      passwordHash: "hash",
      acessosPolo: [{ poloId: "pa" }, { poloId: "pb" }]
    });
    const { authorizeCredentials } = await import("@/lib/auth");

    const user = await authorizeCredentials({ login: "M0001", password: "senha123" });

    expect(user).toMatchObject({ id: "u1", perfil: "monitor", polosPermitidos: ["pa", "pb"] });
    // The região → polos expansion must be gone.
    expect(poloFindMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { lastSeenAt: expect.any(Date) } });
  });

  it("returns a demo user when enabled and no database user exists", async () => {
    process.env.DEMO_AUTH_ENABLED = "true";
    findFirst.mockResolvedValue(null);
    const { authorizeCredentials } = await import("@/lib/auth");

    const user = await authorizeCredentials({ login: "monitor@example.com", password: "senha123" });

    expect(user).toMatchObject({
      id: "demo-monitor",
      email: "monitor@example.com",
      matricula: "M0001",
      perfil: "monitor",
      poloId: "demo-polo"
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("materializes the demo account and its polo so persisted writes satisfy FKs", async () => {
    process.env.DEMO_AUTH_ENABLED = "true";
    findFirst.mockResolvedValue(null);
    const { authorizeCredentials } = await import("@/lib/auth");

    await authorizeCredentials({ login: "fiscal@example.com", password: "senha123" });

    // The demo polo is ensured before the user (User.poloId references it).
    expect(poloUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "demo-polo" } })
    );
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "demo-fiscal" },
        create: expect.objectContaining({
          id: "demo-fiscal",
          email: "fiscal@example.com",
          matricula: "F0001",
          perfil: "fiscal",
          poloId: "demo-polo"
        })
      })
    );
  });

  it("does not return demo users unless demo auth is enabled", async () => {
    findFirst.mockResolvedValue(null);
    const { authorizeCredentials } = await import("@/lib/auth");

    await expect(authorizeCredentials({ login: "M0001", password: "senha123" })).resolves.toBeNull();
  });

  it("rejects an invalid demo password", async () => {
    process.env.DEMO_AUTH_ENABLED = "true";
    findFirst.mockResolvedValue(null);
    const { authorizeCredentials } = await import("@/lib/auth");

    await expect(authorizeCredentials({ login: "M0001", password: "wrong" })).resolves.toBeNull();
  });
});
