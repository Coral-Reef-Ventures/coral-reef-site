import process from "node:process";

import { defineConfig, devices } from "@playwright/test";

// The app's own specs, run against a build of apps/web served from out/ (see e2e/deployed.spec.ts). The Pages page
// has its own config at the repository root; this one has no global setup because the app is built by the caller.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "retain-on-failure", ...devices["Desktop Chrome"] },
});
