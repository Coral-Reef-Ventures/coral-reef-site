import { defineConfig } from "vitest/config";

// The workspace's own unit tests. The old page's tests stay on node --test (test/), and the Playwright specs under
// e2e/ are not Vitest's.
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/out/**"],
  },
});
