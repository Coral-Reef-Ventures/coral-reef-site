import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { themeCss } from "@coralreefventures/theme";
import { expect, test } from "vitest";

import { theme } from "./theme.ts";

const file = join(import.meta.dirname, "..", "app", "theme.css");
const generatedBy = "apps/web/lib/theme.test.ts (CRV_WRITE_THEME=1 pnpm exec vitest run apps/web/lib/theme.test.ts)";

// The stylesheet MantineProvider would inject is generated, not computed in a page: Mantine's resolver is a client
// function, and a page that renders as server components has no provider. The file is committed, and this test is
// what notices it has gone stale; with CRV_WRITE_THEME=1 it writes the file instead.
test("app/theme.css is what the theme generates", () => {
  const css = themeCss(theme, { generatedBy });
  if (process.env.CRV_WRITE_THEME === "1") writeFileSync(file, css);
  expect(readFileSync(file, "utf8")).toBe(css);
});

test("the theme's primary color is the brand coral at its fixed points", () => {
  const css = readFileSync(file, "utf8");
  expect(css.toLowerCase()).toContain("#b8461f");
  expect(css.toLowerCase()).toContain("#f29a74");
});
