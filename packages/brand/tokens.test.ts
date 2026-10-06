import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { border, coral, ink, inkMuted, lightDark, markTile, paper, surface } from "./tokens.ts";

const css = readFileSync(join(import.meta.dirname, "..", "..", "apps", "web", "app", "door.css"), "utf8");
const icon = readFileSync(join(import.meta.dirname, "icon.svg"), "utf8");

describe("brand tokens", () => {
  it("formats a pair the way door.css writes one", () => {
    expect(lightDark(coral)).toBe("light-dark(#b8461f, #f29a74)");
  });

  it.each([
    ["--ms-fg", ink],
    ["--ms-fg-muted", inkMuted],
    ["--ms-bg", paper],
    ["--ms-surface", surface],
    ["--ms-border", border],
    ["--crv-focus", coral],
  ] as const)("matches %s in door.css", (name, pair) => {
    expect(css).toContain(`${name}: ${lightDark(pair)};`);
  });

  it("draws the mark on the coral tile", () => {
    expect(icon.toLowerCase()).toContain(markTile);
  });
});
