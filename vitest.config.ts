import { defineConfig } from "vitest/config";

// Pin the timezone so date-boundary assertions are deterministic regardless of
// the developer/CI machine timezone. Tests were authored against UTC.
process.env.TZ = "UTC";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    env: { TZ: "UTC" }
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
