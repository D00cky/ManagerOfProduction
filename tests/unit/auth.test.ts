import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst, update }
  }
}));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async () => true) }
}));

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.DEMO_AUTH_ENABLED;
  });

  it("returns a database user when credentials match", async () => {
    findFirst.mockResolvedValue({
      id: "u1",
      name: "Monitor Teste",
      email: "monitor@example.com",
      matricula: "M0001",
      perfil: "monitor",
      poloId: "p1",
      passwordHash: "hash",
      acessosPolo: [{ poloId: "p1" }]
    });
    const { authorizeCredentials } = await import("@/lib/auth");

    const user = await authorizeCredentials({ login: "M0001", password: "senha123" });

    expect(user).toMatchObject({ id: "u1", perfil: "monitor", polosPermitidos: ["p1"] });
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
