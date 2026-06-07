import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns an unauthenticated health response for Render", async () => {
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
