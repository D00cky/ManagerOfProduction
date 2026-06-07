import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./e2e.db",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "e2e-secret",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? `http://127.0.0.1:${port}`,
      PORT: String(port)
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
