import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("fiscal navigation only exposes allowed workflow", async ({ page }) => {
  await login(page, "fiscal@example.com");

  await expect(page.getByRole("heading", { name: "Fila de OS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fila de OS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Importar Excel" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/fila$/);
});

test("monitor navigation excludes supervisor-only administration", async ({ page }) => {
  await login(page, "monitor@example.com");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Importar Excel" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Relatorios" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Configuracoes" })).toHaveCount(0);

  await page.goto("/usuarios");
  await expect(page).toHaveURL(/\/dashboard$/);
});
