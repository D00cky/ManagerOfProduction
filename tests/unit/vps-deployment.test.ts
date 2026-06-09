import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("VPS deployment files", () => {
  it("defines a Docker image build for the app", () => {
    const dockerfile = readFileSync("Dockerfile", "utf8");

    expect(dockerfile).toContain("npm ci");
    expect(dockerfile).toContain("npm run build");
    expect(dockerfile).toContain('"npm", "run", "start:vps"');
  });

  it("runs the container as a non-root user", () => {
    const dockerfile = readFileSync("Dockerfile", "utf8");

    expect(dockerfile).toContain("USER node");
  });

  it("runs the app behind Caddy with PostgreSQL and Redis", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    const caddyfile = readFileSync("Caddyfile", "utf8");

    expect(compose).toContain("manager-of-production-app");
    expect(compose).toContain("manager-of-production-caddy");
    expect(compose).toContain("manager-of-production-postgres");
    expect(compose).toContain("manager-of-production-redis");
    expect(compose).toContain('"80:80"');
    expect(compose).toContain("mop_postgres_data");
    expect(compose).toContain("mop_redis_data");
    expect(compose).toContain("mop_backups");
    expect(caddyfile).toContain("reverse_proxy manager-of-production-app:3000");
  });

  it("documents required VPS environment variables without leaking host details", () => {
    const env = readFileSync(".env.vps.example", "utf8");

    expect(env).toContain("POSTGRES_PASSWORD=");
    expect(env).toContain("DATABASE_URL=postgresql://");
    expect(env).toContain("REDIS_URL=redis://");
    expect(env).toContain("NEXTAUTH_URL=");
    expect(env).toContain("NEXTAUTH_SECRET=");
    expect(env).toContain("DEMO_AUTH_ENABLED=false");
    // No concrete public host/IP should be committed to the repo.
    expect(env).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });
});
