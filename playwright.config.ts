import process from "node:process";

import { defineConfig, devices } from "@playwright/test";

/**
 * Screen tests against the built page, at the two widths CRV-005 names and in
 * both color schemes. global-setup.ts builds the site into e2e/.build, so the
 * run never races dist/ against site:watch.
 *
 *   npx playwright install chromium   # once
 *   npm run e2e
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
