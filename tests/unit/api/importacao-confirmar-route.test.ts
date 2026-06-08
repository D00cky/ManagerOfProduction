import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const confirmarImportacao = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser }));
vi.mock("@/server/importacao-service", () => ({ confirmarImportacao }));
vi.mock("@/server/prisma-importacao-repository", () => ({ prismaImportacaoRepository: { name: "import-repo" } }));

describe("POST /api/importacao/confirmar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/importacao/confirmar/route");

    const response = await POST(new Request("http://localhost/api/importacao/confirmar", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Nao autenticado" });
  });

  it("confirms import through the service", async () => {
    const user = { id: "m1", perfil: "monitor", poloId: "p1" };
    const rows = [{ numero: "1001", enderecoCompleto: "Rua A", tipoServico: "Vistoria", polo: "Norte" }];
    const resumo = { total: 1, criadas: 1, atualizadas: 0, ignoradas: 0, invalidas: 0, erros: [] };
    getCurrentUser.mockResolvedValue(user);
    confirmarImportacao.mockResolvedValue(resumo);
    const { POST } = await import("@/app/api/importacao/confirmar/route");

    const response = await POST(new Request("http://localhost/api/importacao/confirmar", {
      method: "POST",
      body: JSON.stringify({ rows, duplicateMode: "atualizar" })
    }));

    expect(response.status).toBe(200);
    expect(confirmarImportacao).toHaveBeenCalledWith({ name: "import-repo" }, user, rows, "atualizar");
    await expect(response.json()).resolves.toEqual({ data: resumo });
  });

  it("returns 403 when the service rejects for missing permission", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal", poloId: "p1" });
    confirmarImportacao.mockRejectedValue(new Error("Sem permissao para importar OS"));
    const { POST } = await import("@/app/api/importacao/confirmar/route");

    const response = await POST(new Request("http://localhost/api/importacao/confirmar", {
      method: "POST",
      body: JSON.stringify({ rows: [{ numero: "1" }], duplicateMode: "ignorar" })
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Sem permissao para importar OS" });
  });

  it("returns 400 for invalid payload", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor", poloId: "p1" });
    const { POST } = await import("@/app/api/importacao/confirmar/route");

    const response = await POST(new Request("http://localhost/api/importacao/confirmar", {
      method: "POST",
      body: JSON.stringify({ rows: {}, duplicateMode: "remover" })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Payload de importacao invalido" });
  });
});
