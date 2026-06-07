import { expect, test } from "@playwright/test";

test("supervisor assigns an unassigned OS from the fila", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Matricula ou e-mail").fill("supervisor@example.com");
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "Fila" }).click();

  const row = page.getByRole("row").filter({ hasText: "OS-1001" });
  await expect(row).toContainText("Sem fiscal");

  await row.getByLabel(/Fiscal para OS/).selectOption({ label: "Fiscal Teste" });
  await row.getByRole("button", { name: "Atribuir" }).click();

  await expect(row).toContainText("Fiscal Teste");
});
