import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { login } from "./helpers";

test("supervisor imports an XLSX file parsed in the browser", async ({ page }, testInfo) => {
  const filePath = testInfo.outputPath("ordens-importacao.xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([
    {
      numero_os: "OS-2001",
      endereco_completo: "Rua E2E, 10",
      bairro: "Centro",
      cidade: "Cidade Teste",
      tipo_servico: "Vistoria",
      polo: "POLO-01",
      fiscal: "F0001",
      observacao: "Criada pelo E2E"
    }
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "OS");
  writeFileSync(filePath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  await login(page, "supervisor@example.com");
  await page.getByRole("link", { name: "Importar Excel" }).click();

  await page.getByLabel("Arquivo XLSX").setInputFiles(filePath);
  await expect(page.getByRole("heading", { name: /Pre-visualizacao .* 1 linhas, 0 com erros/ })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "OS-2001" })).toContainText("Rua E2E, 10");

  await page.getByRole("button", { name: "Confirmar importacao" }).click();
  await expect(page.getByText(/1 criadas .* 0 atualizadas .* 0 ignoradas .* 0 invalidas/)).toBeVisible();

  await page.getByRole("link", { name: "Fila de OS" }).click();
  await expect(page.getByRole("row").filter({ hasText: "OS-2001" })).toContainText("Fiscal Teste");
});
