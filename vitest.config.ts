import { defineConfig } from "vitest/config";

// The workspace's own unit tests, in two projects: the app and packages, and the backend (amplify/vitest.config.ts),
// which synthesizes the backend once for the tests that read its templates. The Playwright specs under e2e/ are not
// Vitest's.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "web",
          include: ["packages/**/*.test.ts", "apps/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/.next/**", "**/out/**"],
        },
      },
      "./amplify/vitest.config.ts",
    ],
  },
});
