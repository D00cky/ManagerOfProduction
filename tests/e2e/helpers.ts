import type { Page } from "@playwright/test";

export async function login(page: Page, login: string, password = "senha123") {
  await page.goto("/login");
  await page.getByLabel("Matricula ou e-mail").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}
