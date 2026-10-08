import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CARD, CARD_ALT, CARD_COLORS, CARD_HEADLINE, socialCardImages } from "./social-card.ts";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");

/**
 * The card is a committed picture, not a built one (scripts/social-card.ts), so nothing fails at build time when it
 * is missing or the wrong shape. These hold it instead: the file is there, it is the size every page tells a client
 * to lay out before it has the bytes, and its words and colors are the ones the site already uses.
 */
describe("the social card", () => {
  it("is committed, a PNG, and the size the pages claim", async () => {
    const png = await readFile(join(publicDir, CARD.file));
    // A PNG declares its size in the IHDR chunk, the first after the eight-byte signature.
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    const ratio = png.readUInt32BE(16) / CARD.width;
    expect(Number.isInteger(ratio) && ratio >= 1).toBe(true);
    expect(png.readUInt32BE(20)).toBe(CARD.height * ratio);
  });

  it("is named by the pages at that size, from the site's root", () => {
    expect(socialCardImages).toHaveLength(1);
    const [image] = socialCardImages;
    expect(image.url).toBe(`/${CARD.file}`);
    expect(image.width).toBe(CARD.width);
    expect(image.height).toBe(CARD.height);
    expect(image.type).toBe("image/png");
    expect(image.alt).toBe(CARD_ALT);
  });

  it("says what the home page says, in colors the shell shares", () => {
    expect(CARD_ALT).toContain(CARD_HEADLINE);
    // lib/site.tsx spreads these into the shell's socialCard, so the drawing script and the shell cannot drift.
    for (const value of Object.values(CARD_COLORS)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("invents no brand asset: the mark on it is the one in public/", async () => {
    const mark = await readFile(join(publicDir, "icon.svg"), "utf8");
    expect(mark).toContain("<svg");
  });
});
