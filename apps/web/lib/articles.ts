/**
 * The articles (CRV-016): the one place their slugs, titles, summaries and dates are written down. The index page, each
 * article's page and metadata, the feed, the sitemap and the drawing script all read this table, so an article exists
 * in all of them or in none. Its body is `content/articles/<slug>.md`, in Markset; its link preview is
 * `public/cards/<slug>.png`, drawn by `scripts/social-card.ts` (`pnpm run social-card`).
 *
 * Plain data, with no JSX and no React, so the drawing script can read it without loading the app.
 */

export interface Article {
  /** The address under /articles/ and the name of its content file and card. */
  slug: string;
  /** The article's h1, its card's headline and its title in the feed. */
  title: string;
  /** One or two sentences: the page's description, the feed item's and the line under it on the index. */
  summary: string;
  /** The day it was published, as YYYY-MM-DD. */
  published: string;
}

/** Newest first, which is the order the index and the feed show; on the same day, the order to read them in. */
export const ARTICLES: readonly Article[] = [
  {
    slug: "code-outruns-review",
    title: "Code outruns review",
    summary:
      "An agent can open more pull requests in an afternoon than a team can review in a week. When the diff can no longer be where the product is decided, something else has to be.",
    published: "2026-10-28",
  },
  {
    slug: "we-build-streamlane-in-streamlane",
    title: "We build Streamlane in Streamlane",
    summary:
      "How an agent takes a piece of work from an item to a merged change, and why every change still traces back to a decision a person made.",
    published: "2026-10-28",
  },
  {
    slug: "intent-is-the-work",
    title: "Intent is the work: building software when agents write the code",
    summary:
      "When agents write the code, the work that remains is deciding what the product should do, proving it still does, and learning whether it should. Why products drift when code outruns review, and what Coral Reef Ventures is building for it.",
    published: "2026-10-15",
  },
];

export const articlePath = (a: Article): string => `/articles/${a.slug}/`;
export const articleFile = (a: Article): string => `articles/${a.slug}.md`;
export const articleCard = (a: Article): string => `/cards/${a.slug}.png`;
export const feedPath = "/articles/feed.xml";

/** A publication date as the pages show it: "28 October 2026". */
export function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${day} ${months[(month ?? 1) - 1]} ${year}`;
}

/**
 * The index's list as Markset source, one entry per article, so the index stays one Markset document and the renderer
 * is the only thing writing its markup (as the product cards are, product-facts.ts).
 */
export function articleList(articles: readonly Article[] = ARTICLES): string {
  return articles
    .map((a) =>
      ["{.eyebrow}", longDate(a.published), "", `### [${a.title}](${articlePath(a)})`, "", a.summary].join("\n"),
    )
    .join("\n\n");
}
