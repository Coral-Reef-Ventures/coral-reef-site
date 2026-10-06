import process from "node:process";

import { defineConfig, devices } from "@playwright/test";

/**
 * Screen tests against the app's static export, at the two widths CRV-005
 * names and in both color schemes. global-setup.ts builds and serves it with
 * the stub backends.
 *
 *   pnpm exec playwright install chromium   # once
 *   pnpm run e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
