/**
 * Draws Coral Reef Ventures' social profile images into `packages/brand/social/`: the profile picture every network
 * uses, the banner X and Bluesky share (3:1), and the LinkedIn company page's cover.
 *
 *   pnpm run social-profiles
 *
 * Drawn the way `scripts/social-card.ts` draws the social card, and for the same reason: nothing invented. The mark
 * is `packages/brand/icon.svg`, the headline is the home page's (`CARD_HEADLINE`), the ground and text are the card's
 * (`CARD_COLORS`), and the four names and their accents are the product table's and `door.css`'s dark variants.
 * Each image is drawn at twice its size so it stays sharp where a network shows it larger. Redraw them when any of
 * those change; `scripts/social-profiles.test.ts` holds the files to their sizes and the colors to `door.css`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { PRODUCTS } from "../apps/web/lib/product-facts.ts";
import { CARD_COLORS, CARD_HEADLINE } from "../apps/web/lib/social-card.ts";
import { markTile } from "../packages/brand/tokens.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = join(root, "packages", "brand");
export const socialDir = join(brandDir, "social");

/** The scale each image is drawn at: twice the size each network asks for. */
export const SCALE = 2;

/** Each product's accent on the dark ground: `door.css`'s dark half of `--crv-<slug>`. */
export const ACCENTS = {
  markset: "#ab97d1",
  intentset: "#5aa88c",
  streamlane: "#d3ad5f",
  driftline: "#7ba5d6",
} as const satisfies Record<(typeof PRODUCTS)[number]["slug"], string>;

export type ProfileImage = { file: string; width: number; height: number; use: string };

/** The images, at the size each network asks for (the file is `SCALE` times larger). */
export const PROFILE_IMAGES = [
  { file: "avatar.png", width: 400, height: 400, use: "Profile picture: LinkedIn, X, Bluesky and Threads" },
  { file: "banner-3x1.png", width: 1500, height: 500, use: "X header and Bluesky banner" },
  { file: "linkedin-cover.png", width: 1128, height: 191, use: "LinkedIn company page cover" },
] as const satisfies readonly ProfileImage[];

const FONT = `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

function page(width: number, height: number, css: string, body: string): string {
  const { background, text, accent } = CARD_COLORS;
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    background: ${background};
    color: ${text};
    font-family: ${FONT};
    -webkit-font-smoothing: antialiased;
  }
  .products { display: flex; gap: 1.4em; font-weight: 600; }
  .products span { display: inline-flex; align-items: center; gap: 0.5em; }
  .products i { width: 0.62em; height: 0.62em; border-radius: 50%; }
  .host { color: ${accent}; font-weight: 600; }
  ${css}
</style>
<body>${body}</body>
</html>
`;
}

const products = PRODUCTS.map((p) => `<span><i style="background:${ACCENTS[p.slug]}"></i>${p.name}</span>`).join("");

/** Each image's markup. The networks lay the profile picture over a banner's lower left, so the words sit right. */
export function profileHtml(file: ProfileImage["file"], glyph: string): string {
  switch (file) {
    case "avatar.png":
      // Full bleed, without the tile's rounded corners: every network crops the picture to a circle.
      return page(
        400,
        400,
        `body { background: ${markTile}; display: grid; place-items: center; } img { width: 330px; height: 330px; }`,
        `<img src="${glyph}" alt="">`,
      );
    case "banner-3x1.png":
      return page(
        1500,
        500,
        `body { display: flex; align-items: center; justify-content: flex-end; padding: 0 110px; }
  .wrap { display: flex; flex-direction: column; gap: 26px; align-items: flex-end; text-align: right; }
  h1 { font-size: 60px; line-height: 1.08; font-weight: 700; letter-spacing: -0.03em; max-width: 15ch; }
  .products { font-size: 28px; } .host { font-size: 24px; }`,
        `<div class="wrap"><h1>${CARD_HEADLINE}</h1><div class="products">${products}</div><div class="host">coralreefventures.com</div></div>`,
      );
    case "linkedin-cover.png":
      return page(
        1128,
        191,
        `body { display: flex; align-items: center; justify-content: flex-end; padding: 0 56px; }
  .wrap { display: flex; flex-direction: column; gap: 14px; align-items: flex-end; }
  h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.025em; } .products { font-size: 17px; }`,
        `<div class="wrap"><h1>${CARD_HEADLINE}</h1><div class="products">${products}</div></div>`,
      );
    default:
      throw new Error(`no drawing for ${file}`);
  }
}

/** Draws every image into packages/brand/social/. */
export async function drawProfiles(to: string = socialDir): Promise<string[]> {
  const svg = await readFile(join(brandDir, "icon.svg"), "utf8");
  // The mark's glyph without its tile and title, for the full-bleed avatar.
  const bare = svg.replace(/<title>.*<\/title>/, "").replace(/<rect[^>]*\/>/, "");
  const glyph = `data:image/svg+xml;base64,${Buffer.from(bare).toString("base64")}`;
  await mkdir(to, { recursive: true });
  const browser = await chromium.launch();
  const written: string[] = [];
  try {
    for (const image of PROFILE_IMAGES) {
      const tab = await browser.newPage({
        viewport: { width: image.width, height: image.height },
        deviceScaleFactor: SCALE,
      });
      await tab.setContent(profileHtml(image.file, glyph), { waitUntil: "load" });
      const file = join(to, image.file);
      await writeFile(file, await tab.screenshot({ type: "png" }));
      await tab.close();
      written.push(file);
    }
    return written;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const file of await drawProfiles()) console.log(`social profile: ${file}`);
}
