import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("saved tabulation allows finalizing an OS", async ({ page }) => {
  await login(page, "supervisor@example.com");
  await page.getByRole("link", { name: "Fila de OS" }).click();

  const row = page.getByRole("row").filter({ hasText: "OS-1002" });
  await row.getByRole("link", { name: "Tabular" }).click();

  await expect(page.getByRole("heading", { name: /Tabulacao .* OS OS-1002/ })).toBeVisible();
  await page.getByRole("button", { name: "Conforme" }).first().click();
  await page.getByLabel("Observacoes").fill("E2E tabulacao salva");
  await page.getByRole("button", { name: "Salvar tabulacao" }).click();
  await expect(page.getByText("Tabulacao salva.")).toBeVisible();

  await page.getByRole("link", { name: "Fila de OS" }).click();
  await row.getByRole("button", { name: "Iniciar" }).click();
  await expect(row).toContainText("Em execucao");

  await row.getByRole("button", { name: "Concluir" }).click();
  await expect(row).toContainText("Concluida");
});
