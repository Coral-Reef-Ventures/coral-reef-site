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
  /** The series it is a part of, by name; its parts are read in the order they were published. */
  series?: string;
}

/** Newest first, which is the order the index and the feed show; on the same day, the order to read them in. */
export const ARTICLES: readonly Article[] = [
  {
    slug: "intentset-before-launch",
    title: "Intentset before launch",
    summary:
      "A new product for teachers, a month old and not yet released, wrote down its 41 behaviors and bound every promise to the test that proves it, in one pull request.",
    published: "2026-11-25",
    series: "Adoption stories",
  },
  {
    slug: "intentset-in-a-million-lines",
    title: "Intentset in a million lines",
    summary:
      "A learning platform for schools is writing down what it promises, one area at a time. In twelve days the record found more than 500 gaps, and one modeled rule led to four authorization fixes.",
    published: "2026-11-18",
    series: "Adoption stories",
  },
  {
    slug: "intentset-before-scale",
    title: "Intentset before scale",
    summary:
      "A school assessment app wrote down what it promises before agents took on most of its work. In the twelve days after, it merged 186 pull requests, and writing it down found security gaps code review had not.",
    published: "2026-11-11",
    series: "Adoption stories",
  },
  {
    slug: "we-build-streamlane-in-streamlane",
    title: "We build Streamlane in Streamlane",
    summary:
      "How an agent takes a piece of work from an item to a merged change in seven stages, and why every change still traces back to a decision a person made.",
    published: "2026-11-05",
  },
  {
    slug: "code-outruns-review",
    title: "Code outruns review",
    summary:
      "An agent can open more pull requests in an afternoon than a team can review in a week. When the diff can no longer be where the product is decided, something else has to be.",
    published: "2026-10-29",
  },
  {
    slug: "introducing-intentset",
    title: "Introducing Intentset, in 23 slides",
    summary:
      "Why we built Intentset, who the deck is for, and how to read it: the product's promises written down and kept true while agents change the code.",
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

/** The article a content file is the body of, if it is one. */
export const articleOf = (file: string): Article | undefined => ARTICLES.find((a) => articleFile(a) === file);

/**
 * Minutes to read a Markset source, at 230 words a minute, counting the prose a reader reads: not the frontmatter,
 * a fence's own line, an attribute line or a picture's address and description, which a reader looks at rather than reads.
 */
export function readingMinutes(source: string): number {
  const prose = source
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .split("\n")
    .filter((line) => !/^\s*(:::|::col|\{[.#][^}]*\}\s*$)/.test(line))
    .join("\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\]\([^)]*\)/g, "]");
  const words = prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’,.%-]*/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(words / 230));
}

/** The line above an article's title: what it is, the day it was published and how long it takes to read. */
export const dateline = (a: Article, source: string): string =>
  `Article · ${longDate(a.published)} · ${readingMinutes(source)} min read`;

/**
 * What follows an article, as Markset source: the other parts of its series, in order, with this one marked, or else
 * the article to read next (the one published after it, or before it for the newest); then the index and the feed.
 */
export function articleEnd(a: Article, articles: readonly Article[] = ARTICLES): string {
  const oldestFirst = [...articles].reverse();
  const parts = a.series === undefined ? [] : oldestFirst.filter((p) => p.series === a.series);
  const blocks: string[] = [];
  if (parts.length > 1) {
    const at = parts.indexOf(a);
    blocks.push(
      "{.eyebrow}",
      `${a.series} · Part ${at + 1} of ${parts.length}`,
      "",
      "{.series}",
      parts
        .map(
          (p, i) =>
            `${i + 1}. ${p === a ? `[${p.title}]{.current} [(this article)]{.muted}` : `[${p.title}](${articlePath(p)})`}`,
        )
        .join("\n"),
    );
  } else {
    const at = oldestFirst.indexOf(a);
    const next = oldestFirst[at + 1] ?? oldestFirst[at - 1];
    if (next !== undefined)
      blocks.push("{.eyebrow}", "Read next", "", `### [${next.title}](${articlePath(next)})`, "", next.summary);
  }
  blocks.push("", "{.more}", `[All articles](/articles/) · [RSS feed](${feedPath})`);
  return blocks.join("\n");
}

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
