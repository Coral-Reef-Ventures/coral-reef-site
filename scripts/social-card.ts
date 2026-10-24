/**
 * Draws `apps/web/public/social-card.png`, the image a link to coralreefventures.com previews as in a chat client, a
 * feed or a search result. Without one the preview is text, which is what every link to the door has been.
 *
 *   pnpm run social-card
 *
 * Drawn by hand and committed, not built. reef ships a card builder (`socialCard` in `lib/site.tsx`), and this site
 * does not use it because it fetches a web font from Google at build time: that would put another origin in the
 * build and a font this site does not otherwise load. Drawing the card here instead keeps the rule intact — the
 * browser still loads nothing but this origin's bytes — and keeps the deploy free of a browser and a network call.
 *
 * Nothing here is invented: the mark is `apps/web/public/icon.svg`, approved 2026-10-03, the words are the home
 * page's own title and the colors are the four already written in `lib/site.tsx`'s `socialCard`. Redraw it when any
 * of those change. `apps/web/lib/social-card.test.ts` holds the committed file to the size the pages claim.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { ARTICLES, articleCard, longDate } from "../apps/web/lib/articles.ts";
import { CARD, CARD_COLORS, CARD_FOOT, CARD_HEADLINE } from "../apps/web/lib/social-card.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "apps", "web", "public");

/**
 * The card's markup: the door's ground, its mark, a headline and the domain in the accent. The site's card carries the
 * home page's headline; an article's (CRV-016) carries its title, with "Article" and its date beside the domain.
 */
export function cardHtml(mark: string, headline: string = CARD_HEADLINE, foot: string = CARD_FOOT): string {
  const { background, text, muted, accent } = CARD_COLORS;
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${CARD.width}px;
    height: ${CARD.height}px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 76px 84px;
    background: ${background};
    color: ${text};
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .brand { display: flex; align-items: center; gap: 20px; font-size: 36px; font-weight: 700; letter-spacing: -0.02em; }
  .brand img { width: 64px; height: 64px; border-radius: 13px; }
  h1 { font-size: 72px; line-height: 1.08; font-weight: 700; letter-spacing: -0.035em; max-width: 16ch; }
  .foot { display: flex; align-items: baseline; gap: 18px; font-size: 26px; color: ${muted}; }
  .foot .host { color: ${accent}; font-weight: 600; }
  .rule { height: 1px; background: ${muted}; opacity: 0.3; margin-bottom: 30px; }
</style>
<body>
  <div class="brand"><img src="${mark}" alt="">Coral Reef Ventures</div>
  <h1>${headline}</h1>
  <div>
    <div class="rule"></div>
    <div class="foot"><span class="host">coralreefventures.com</span><span>${foot}</span></div>
  </div>
</body>
</html>
`;
}

/** Draws one card, from its markup, at twice the size the pages claim. */
async function draw(html: string, to: string): Promise<string> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: CARD.width, height: CARD.height },
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: "load" });
    await writeFile(to, await page.screenshot({ type: "png" }));
    return to;
  } finally {
    await browser.close();
  }
}

const markUri = async (): Promise<string> => {
  const svg = await readFile(join(publicDir, "icon.svg"), "utf8");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

/** Draws the card into apps/web/public/, where the export serves it from the site's root. */
export async function drawCard(to: string = join(publicDir, CARD.file)): Promise<string> {
  return draw(cardHtml(await markUri()), to);
}

/** Draws each article's card into apps/web/public/cards/, one per entry in the article table. */
export async function drawArticleCards(): Promise<string[]> {
  const mark = await markUri();
  await mkdir(join(publicDir, "cards"), { recursive: true });
  const written: string[] = [];
  for (const article of ARTICLES) {
    const to = join(publicDir, ...articleCard(article).split("/").filter(Boolean));
    written.push(await draw(cardHtml(mark, article.title, `Article · ${longDate(article.published)}`), to));
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`social card: ${await drawCard()}`);
  for (const file of await drawArticleCards()) console.log(`article card: ${file}`);
}
