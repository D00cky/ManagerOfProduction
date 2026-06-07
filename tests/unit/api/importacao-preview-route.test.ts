import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

describe("POST /api/importacao/preview", () => {
  it("returns detected mapping, preview rows, and validation errors", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      { "Número OS": "1001", "Endereço Completo": "Rua A", Serviço: "Vistoria", Polo: "Norte" },
      { "Número OS": "", "Endereço Completo": "", Serviço: "Outros", Polo: "Norte" }
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "OS");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const form = new FormData();
    form.set("file", new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "os.xlsx");
    const { POST } = await import("@/app/api/importacao/preview/route");

    const response = await POST(new Request("http://localhost/api/importacao/preview", { method: "POST", body: form }));

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
    const { POST } = await import("@/app/api/importacao/preview/route");

    const response = await POST(new Request("http://localhost/api/importacao/preview", { method: "POST", body: new FormData() }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Arquivo XLSX obrigatorio" });
  });
});
