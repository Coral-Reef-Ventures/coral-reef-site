import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import sitemap from "../app/sitemap.ts";
import { ARTICLES, articleCard, articleFile, articleList, articlePath, feedPath, longDate } from "./articles.ts";
import { articlesFeed, rfc822 } from "./feed.ts";
import { segments } from "./markset.ts";
import { CARD } from "./social-card.ts";
import { site } from "./site.tsx";

const html = (file: string) =>
  segments(file)
    .map((s) => ("html" in s ? s.html : ""))
    .join("\n");

const publicDir = join(import.meta.dirname, "..", "public");

/**
 * The articles (CRV-016). Each lives in the one table and in a Markset file, and appears on the index, in the feed, in
 * the sitemap and with its own drawn card; the copy keeps the claims the rest of the site keeps.
 */
describe("the articles", () => {
  it("each have a unique slug, a real date, and newest come first", () => {
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length);
    for (const a of ARTICLES) {
      expect(a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(a.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(a.published))).toBe(false);
    }
    const dates = ARTICLES.map((a) => a.published);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it.each(ARTICLES)("$slug parses as Markset, with its title as its one h1 and its date in its eyebrow", (a) => {
    const body = html(articleFile(a));
    expect(body.match(/<h1\b/g)).toHaveLength(1);
    expect(body).toContain(`>${a.title}</h1>`);
    expect(body).toContain(`Article · ${longDate(a.published)}`);
  });

  it.each(ARTICLES)("$slug keeps the site's claims", (a) => {
    const body = html(articleFile(a));
    // Streamlane and Driftline are open to invited guests: named, never linked (CRV-003).
    expect(body).not.toMatch(/href="https?:\/\/(www\.)?(streamlane|driftline)\.app/);
    // Markset and Intentset are open foundations, not products (Gary, 2026-10-06).
    expect(body).not.toMatch(/\b(four|the) products\b/i);
    // The only outside links are the open foundations' sites.
    for (const [, href] of body.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
      expect(href).toMatch(/^https:\/\/(markset|intentset)\.org(\/|$)/);
    }
  });

  it.each(ARTICLES)("$slug has its own card, committed at the size its page claims", (a) => {
    const png = readFileSync(join(publicDir, ...articleCard(a).split("/").filter(Boolean)));
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    const ratio = png.readUInt32BE(16) / CARD.width;
    expect(Number.isInteger(ratio) && ratio >= 1).toBe(true);
    expect(png.readUInt32BE(20)).toBe(CARD.height * ratio);
  });

  it("are listed on the index, newest first, each linking its page", () => {
    const index = html("articles.md");
    expect(index.match(/<h1\b/g)).toHaveLength(1);
    expect(index).toContain(`href="${feedPath}"`);
    let at = 0;
    for (const a of ARTICLES) {
      const found = index.indexOf(`href="${articlePath(a)}"`, at);
      expect(found, a.slug).toBeGreaterThan(-1);
      at = found;
    }
    expect(articleList([])).toBe("");
  });

  it("are in the feed, as RSS 2.0 with each article's link, summary and day", () => {
    const feed = articlesFeed();
    expect(feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"')).toBe(true);
    expect(feed).toContain(`<atom:link href="https://coralreefventures.com${feedPath}" rel="self"`);
    for (const a of ARTICLES) {
      expect(feed).toContain(`<link>https://coralreefventures.com${articlePath(a)}</link>`);
      expect(feed).toContain(`<pubDate>${rfc822(a.published)}</pubDate>`);
    }
    expect(rfc822("2026-10-28")).toBe("Wed, 28 Oct 2026 12:00:00 GMT");
    expect(articlesFeed([{ slug: "x", title: "A & <b>", summary: '"q"', published: "2026-01-01" }])).toContain(
      "<title>A &amp; &lt;b&gt;</title>",
    );
  });

  it("are in the sitemap, with the index, and reached from the header", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://coralreefventures.com/articles/");
    for (const a of ARTICLES) expect(urls).toContain(`https://coralreefventures.com${articlePath(a)}`);
    expect(site.config.nav.map((n) => n.href)).toEqual(["/whitepaper/", "/articles/", "/get-involved/"]);
  });
});
