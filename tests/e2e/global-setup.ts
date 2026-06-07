import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const databaseUrl = process.env.DATABASE_URL ?? "file:./e2e.db";

export default async function globalSetup() {
  if (databaseUrl === "file:./e2e.db") {
    rmSync("prisma/e2e.db", { force: true });
    rmSync("prisma/e2e.db-journal", { force: true });
  }

  const env = { ...process.env, DATABASE_URL: databaseUrl };
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], { stdio: "inherit", env });
  execFileSync("npm", ["run", "db:seed"], { stdio: "inherit", env });
}
