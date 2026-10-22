import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PRODUCTS } from "../apps/web/lib/product-facts.ts";
import { CARD_HEADLINE } from "../apps/web/lib/social-card.ts";
import { ACCENTS, PROFILE_IMAGES, profileHtml, SCALE, socialDir } from "./social-profiles.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The profile images are committed pictures (scripts/social-profiles.ts), like the social card, so nothing fails at
 * build time when one is missing or the wrong shape. These hold them: each file is there at the size its network asks
 * for, and its words and colors are the ones the site already uses.
 */
describe("the social profile images", () => {
  it.each(PROFILE_IMAGES)("$file is committed, a PNG, and $width×$height at the drawing's scale", async (image) => {
    const png = await readFile(join(socialDir, image.file));
    // A PNG declares its size in the IHDR chunk, the first after the eight-byte signature.
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(image.width * SCALE);
    expect(png.readUInt32BE(20)).toBe(image.height * SCALE);
  });

  it("colors each product with door.css's dark accent", async () => {
    const css = await readFile(join(root, "apps", "web", "app", "door.css"), "utf8");
    for (const [slug, color] of Object.entries(ACCENTS)) {
      expect(css).toMatch(new RegExp(`--crv-${slug}: light-dark\\(#[0-9a-f]{6}, ${color}\\);`));
    }
  });

  it("says what the home page says and names the four from the product table", () => {
    const banner = profileHtml("banner-3x1.png", "");
    expect(banner).toContain(CARD_HEADLINE);
    for (const product of PRODUCTS) expect(banner).toContain(product.name);
  });
});
