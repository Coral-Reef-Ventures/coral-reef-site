/**
 * The social card: what a link to coralreefventures.com previews as in a chat client, a feed or a search result.
 *
 * The picture is `apps/web/public/social-card.png`, drawn by `scripts/social-card.ts` (`pnpm run social-card`) and
 * committed, not built: reef's own card builder fetches a web font from Google at build time, and this site puts no
 * other origin in the browser or in the build. The pages name it through `socialCardImages`.
 *
 * Plain data, with no JSX and no React, so the drawing script can read it without loading the app.
 */

/** What every platform that reads og:image expects, and the size the test holds the file to. */
export const CARD = { width: 1200, height: 630, file: "social-card.png" } as const;

/** The home page's headline, which is what the company is for in one line. */
export const CARD_HEADLINE = "Keep control as agents build your software";

/** The line under the rule, beside the domain. */
export const CARD_FOOT = "Open foundations and focused tools";

/** What the card says, for a reader given its alternative text instead of the picture. */
export const CARD_ALT = `Coral Reef Ventures: ${CARD_HEADLINE}`;

/** The card's four colors: the door's ground and ink, kept here so the drawing script and the shell agree. */
export const CARD_COLORS = {
  background: "#191310",
  text: "#ece7dc",
  muted: "#a9ab9f",
  accent: "#f29a74",
} as const;

/**
 * The card as a page's metadata names it, for `openGraph.images` and `twitter.images`. A page that writes its own
 * `openGraph` replaces the root layout's rather than merging with it, so every page that does repeats this.
 */
export const socialCardImages = [
  { url: `/${CARD.file}`, width: CARD.width, height: CARD.height, type: "image/png", alt: CARD_ALT },
];
