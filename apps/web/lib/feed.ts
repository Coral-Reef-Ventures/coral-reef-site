import { ARTICLES, type Article, articlePath, feedPath } from "./articles.ts";
import { siteUrl } from "./site.tsx";

const xml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** A publication day as RFC 822, which RSS 2.0 requires: noon UTC, so no reader's time zone moves it to another day. */
export const rfc822 = (iso: string): string => new Date(`${iso}T12:00:00Z`).toUTCString();

/** The articles as an RSS 2.0 document, newest first, each item its title, link, summary and day. */
export function articlesFeed(articles: readonly Article[] = ARTICLES): string {
  const items = articles.map((a) => {
    const link = `${siteUrl}${articlePath(a)}`;
    return [
      "    <item>",
      `      <title>${xml(a.title)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      `      <description>${xml(a.summary)}</description>`,
      `      <pubDate>${rfc822(a.published)}</pubDate>`,
      "    </item>",
    ].join("\n");
  });
  const latest = articles[0]?.published;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Coral Reef Ventures: Articles</title>",
    `    <link>${siteUrl}/articles/</link>`,
    `    <atom:link href="${siteUrl}${feedPath}" rel="self" type="application/rss+xml"/>`,
    "    <description>How we think about building software when agents write the code.</description>",
    "    <language>en-us</language>",
    ...(latest ? [`    <lastBuildDate>${rfc822(latest)}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
