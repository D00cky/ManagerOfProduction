import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const getCurrentUser = vi.fn();
vi.mock("@/server/session", () => ({ getCurrentUser }));

function previewRequest() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    { "Número OS": "1001", "Endereço Completo": "Rua A", Serviço: "Vistoria", Polo: "Norte" },
    { "Número OS": "", "Endereço Completo": "", Serviço: "Outros", Polo: "Norte" }
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "OS");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const form = new FormData();
  form.set("file", new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "os.xlsx");
  return new Request("http://localhost/api/importacao/preview", { method: "POST", body: form });
}

describe("POST /api/importacao/preview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/importacao/preview/route");

    const response = await POST(previewRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Nao autenticado" });
  });

  it("returns 403 when the user lacks the importacao:write capability", async () => {
    getCurrentUser.mockResolvedValue({ id: "f1", perfil: "fiscal", poloId: "p1" });
    const { POST } = await import("@/app/api/importacao/preview/route");

    const response = await POST(previewRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Sem permissao para importar OS" });
  });

  it("returns detected mapping, preview rows, and validation errors for authorized users", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor", poloId: "p1" });
    const { POST } = await import("@/app/api/importacao/preview/route");

    const response = await POST(previewRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mapping: {
        numero: "Número OS",
        enderecoCompleto: "Endereço Completo",
        tipoServico: "Serviço",
        polo: "Polo"
      },
      total: 2,
      validas: 1,
      invalidas: 1,
      erros: [{ linha: 2, erros: ["numero_os obrigatorio", "endereco_completo obrigatorio"] }]
    });
  });

  it("returns 400 when file is missing", async () => {
    getCurrentUser.mockResolvedValue({ id: "m1", perfil: "monitor", poloId: "p1" });
    const { POST } = await import("@/app/api/importacao/preview/route");

    const response = await POST(new Request("http://localhost/api/importacao/preview", { method: "POST", body: new FormData() }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Arquivo XLSX obrigatorio" });
  });
});
