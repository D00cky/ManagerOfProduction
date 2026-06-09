import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("render.yaml", () => {
  const blueprint = readFileSync("render.yaml", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };

  it("deploys the app from the production Docker image", () => {
    expect(blueprint).toContain("type: web");
    expect(blueprint).toContain("runtime: docker");
    expect(blueprint).toContain("preDeployCommand: npx prisma migrate deploy");
    expect(blueprint).toContain("dockerCommand: npm start");
    expect(blueprint).toContain("DEMO_AUTH_ENABLED");
  });

  it("uses an unauthenticated API health check", () => {
    expect(blueprint).toContain("healthCheckPath: /api/health");
  });

  it("declares the required runtime environment variables", () => {
    expect(blueprint).toContain("key: DATABASE_URL");
    expect(blueprint).toContain("fromDatabase:");
    expect(blueprint).toContain("key: REDIS_URL");
    expect(blueprint).toContain("type: keyvalue");
    expect(blueprint).toContain("key: NEXTAUTH_SECRET");
    expect(blueprint).toContain("key: NEXTAUTH_URL");
  });

  it("provisions private PostgreSQL and Redis-compatible services", () => {
    expect(blueprint).toContain("databases:");
    expect(blueprint).toContain("postgresMajorVersion:");
    expect(blueprint).toContain("maxmemoryPolicy: allkeys-lru");
    expect(blueprint).toContain("ipAllowList: []");
  });

  it("keeps the legacy Render start command compatible with PostgreSQL", () => {
    expect(packageJson.scripts?.["start:render"]).toBe(
      "npx prisma migrate deploy && npm start"
    );
  });
});
