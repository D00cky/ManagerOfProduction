import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

function sqlitePath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) return null;
  const filePath = databaseUrl.slice("file:".length);
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), "prisma", filePath);
}

function resetSqliteDatabase() {
  if (process.env.RESET_DEMO_DB_ON_START !== "true") return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const dbPath = sqlitePath(databaseUrl);
  if (!dbPath) return;

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${dbPath}${suffix}`, { force: true });
  }
}

async function main() {
  resetSqliteDatabase();
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], { stdio: "inherit", env: process.env });
  execFileSync("npx", ["prisma", "db", "seed"], { stdio: "inherit", env: process.env });
  await import("../server");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
