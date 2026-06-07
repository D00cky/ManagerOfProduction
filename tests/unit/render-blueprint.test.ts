import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("render.yaml", () => {
  const blueprint = readFileSync("render.yaml", "utf8");

  it("deploys the app as a Render Node web service", () => {
    expect(blueprint).toContain("type: web");
    expect(blueprint).toContain("runtime: node");
    expect(blueprint).toContain("buildCommand: npm ci && npm run build");
    expect(blueprint).toContain("startCommand: npm start");
  });

  it("uses an unauthenticated API health check", () => {
    expect(blueprint).toContain("healthCheckPath: /api/health");
  });

  it("declares the required runtime environment variables", () => {
    expect(blueprint).toContain("key: DATABASE_URL");
    expect(blueprint).toContain("key: NEXTAUTH_SECRET");
    expect(blueprint).toContain("key: NEXTAUTH_URL");
  });
});
