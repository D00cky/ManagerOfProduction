import { execFileSync } from "node:child_process";

const localDatabaseUrl =
  "postgresql://manager:manager@127.0.0.1:55432/manager_of_production_e2e?schema=public";

export default async function globalSetup() {
  const usesManagedTestDatabase = !process.env.DATABASE_URL;
  const databaseUrl = process.env.DATABASE_URL ?? localDatabaseUrl;

  if (usesManagedTestDatabase) {
    execFileSync(
      "docker",
      ["compose", "-f", "docker-compose.test.yml", "up", "-d", "--wait"],
      { stdio: "inherit" }
    );
  }

  const env = { ...process.env, DATABASE_URL: databaseUrl };
  execFileSync("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], {
    stdio: "inherit",
    env
  });
  execFileSync("npm", ["run", "db:seed"], { stdio: "inherit", env });

  if (usesManagedTestDatabase) {
    return async () => {
      execFileSync("docker", ["compose", "-f", "docker-compose.test.yml", "stop"], {
        stdio: "inherit"
      });
    };
  }
}
