import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";
import { login } from "./helpers";

const prisma = new PrismaClient({
  datasourceUrl:
    process.env.DATABASE_URL ??
    "postgresql://manager:manager@127.0.0.1:55432/manager_of_production_e2e?schema=public"
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("fiscal receives one OS at a time from the polo and gets the next after completing it", async ({ page }) => {
  const suffix = Date.now().toString();
  const polo = await prisma.polo.create({
    data: { nome: `Polo Fila ${suffix}`, codigo: `FILA-${suffix}` }
  });
  const fiscal = await prisma.user.create({
    data: {
      name: "Fiscal Fila Automatica",
      email: `fila-${suffix}@example.com`,
      matricula: `FA${suffix}`,
      passwordHash: bcrypt.hashSync("senha123", 10),
      perfil: "fiscal",
      poloId: polo.id
    }
  });
  const first = await prisma.ordemServico.create({
    data: {
      numero: `AUTO-1-${suffix}`,
      enderecoCompleto: "Rua Primeira, 1",
      tipoServico: "Outros",
      poloId: polo.id,
      dataProgramada: new Date("2026-06-01T10:00:00.000Z")
    }
  });
  const second = await prisma.ordemServico.create({
    data: {
      numero: `AUTO-2-${suffix}`,
      enderecoCompleto: "Rua Segunda, 2",
      tipoServico: "Outros",
      poloId: polo.id,
      dataProgramada: new Date("2026-06-02T10:00:00.000Z")
    }
  });

  await login(page, fiscal.email);

  const firstRow = page.getByRole("row").filter({ hasText: first.numero });
  await expect(firstRow).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: second.numero })).toHaveCount(0);

  await firstRow.getByRole("link", { name: "Tabular" }).click();
  await page.getByRole("button", { name: "Conforme" }).first().click();
  await page.getByRole("button", { name: "Salvar tabulacao" }).click();
  await expect(page.getByText("Tabulacao salva.")).toBeVisible();

  await page.getByRole("link", { name: "Fila de OS" }).click();
  await firstRow.getByRole("button", { name: "Iniciar" }).click();
  await expect(firstRow).toContainText("Em execucao");
  await firstRow.getByRole("button", { name: "Concluir" }).click();
  await expect(firstRow).toContainText("Concluida");

  const secondRow = page.getByRole("row").filter({ hasText: second.numero });
  await expect(secondRow).toBeVisible();
  await expect(secondRow).toContainText("Na fila");

  await expect(
    prisma.ordemServico.findUnique({ where: { id: second.id }, select: { fiscalId: true } })
  ).resolves.toEqual({ fiscalId: fiscal.id });
});
