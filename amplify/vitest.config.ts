import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "amplify",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    // Synthesizes the backend once, as a sandbox and as the branch, for the tests that read the templates.
    globalSetup: ["./test/global-synth.ts"],
    // The settings a synth needs (auth/settings.ts); a unit test that imports a resource file reads them too.
    env: { CRV_AUTH_DOMAIN_PREFIX: "crv-door-test" },
    testTimeout: 20_000,
  },
});
