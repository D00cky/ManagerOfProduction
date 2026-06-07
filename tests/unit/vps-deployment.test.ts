import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("VPS deployment files", () => {
  it("defines a Docker image build for the app", () => {
    const dockerfile = readFileSync("Dockerfile", "utf8");

    expect(dockerfile).toContain("npm ci");
    expect(dockerfile).toContain("npm run build");
    expect(dockerfile).toContain('"npm", "run", "start:vps"');
  });

  it("runs the app behind Caddy with persistent volumes", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    const caddyfile = readFileSync("Caddyfile", "utf8");

    expect(compose).toContain("manager-of-production-app");
    expect(compose).toContain("manager-of-production-caddy");
    expect(compose).toContain('"80:80"');
    expect(compose).toContain("mop_sqlite_data");
    expect(compose).toContain("mop_backups");
    expect(caddyfile).toContain("reverse_proxy manager-of-production-app:3000");
  });

  it("documents required VPS environment variables", () => {
    const env = readFileSync(".env.vps.example", "utf8");

    expect(env).toContain("DATABASE_URL=file:/data/prod.db");
    expect(env).toContain("NEXTAUTH_URL=http://13.140.148.134");
    expect(env).toContain("NEXTAUTH_SECRET=");
    expect(env).toContain("DEMO_AUTH_ENABLED=false");
  });
});
