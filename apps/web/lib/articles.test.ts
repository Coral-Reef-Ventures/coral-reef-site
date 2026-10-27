import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "../app/sitemap.ts";
import {
  type Article,
  ARTICLES,
  articleCard,
  articleFile,
  articleList,
  articlePath,
  feedPath,
  longDate,
  publishDay,
  publishedBy,
} from "./articles.ts";
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
    // An article may cite its sources, over https; it never links a locked site (above).
    for (const [, href] of body.matchAll(/href="(https?:\/\/[^"]+)"/g)) expect(href).toMatch(/^https:\/\//);
  });

  it.each(ARTICLES)("$slug shows only committed pictures, each described and captioned", (a) => {
    const body = html(articleFile(a));
    for (const [img, src = ""] of body.matchAll(/<img src="([^"]+)"[^>]*>/g)) {
      expect(src, src).toMatch(new RegExp(`^/pictures/${a.slug}/[a-z0-9-]+\\.png$`));
      expect(
        readFileSync(join(publicDir, ...src.split("/").filter(Boolean)))
          .subarray(1, 4)
          .toString("ascii"),
      ).toBe("PNG");
      expect(img).toMatch(/alt="[^"]{40,}"/);
    }
    expect(body.match(/<img\b/g)?.length ?? 0).toBe(body.match(/<figcaption>/g)?.length ?? 0);
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
    for (const a of publishedBy()) {
      const found = index.indexOf(`href="${articlePath(a)}"`, at);
      expect(found, a.slug).toBeGreaterThan(-1);
      at = found;
    }
    expect(articleList([])).toBe("");
  });

  it("wait for their day: a build before an article's date leaves it off the index, the feed and the sitemap", () => {
    const [later, ...rest] = ARTICLES as [Article, ...Article[]];
    const dayBefore = new Date(Date.parse(`${later.published}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    expect(publishedBy(later.published)).toContain(later);
    expect(publishedBy(dayBefore)).toEqual(rest.filter((a) => a.published <= dayBefore));
    expect(articleList(publishedBy(dayBefore))).not.toContain(articlePath(later));
    expect(articlesFeed(publishedBy(dayBefore))).not.toContain(articlePath(later));
    vi.stubEnv("CRV_PUBLISH_DAY", dayBefore);
    expect(publishDay()).toBe(dayBefore);
    expect(sitemap().map((entry) => entry.url)).not.toContain(`https://coralreefventures.com${articlePath(later)}`);
    vi.stubEnv("CRV_PUBLISH_DAY", "");
    expect(publishDay()).toBe(new Date().toISOString().slice(0, 10));
  });

  it.each(ARTICLES)("$slug links only articles published by its own day", (a) => {
    for (const [, slug] of html(articleFile(a)).matchAll(/href="\/articles\/([^/"]+)\/"/g)) {
      const linked = ARTICLES.find((b) => b.slug === slug)?.published ?? "";
      expect(linked, `${a.slug} links ${slug}, which is not in the table`).not.toBe("");
      expect(linked <= a.published, `${a.slug} links ${slug}, published later`).toBe(true);
    }
  });

  it("are in the feed, as RSS 2.0 with each article's link, summary and day", () => {
    const feed = articlesFeed(ARTICLES);
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
    for (const a of publishedBy()) expect(urls).toContain(`https://coralreefventures.com${articlePath(a)}`);
    expect(site.config.nav.map((n) => n.href)).toEqual(["/articles/", "/get-involved/"]);
  });
});
