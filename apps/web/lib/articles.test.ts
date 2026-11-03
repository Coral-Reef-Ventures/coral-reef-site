import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import sitemap from "../app/sitemap.ts";
import {
  ARTICLES,
  articleCard,
  articleEnd,
  articleFile,
  articleList,
  articleOf,
  articlePath,
  dateline,
  feedPath,
  longDate,
  readingMinutes,
} from "./articles.ts";
import { articlesFeed, rfc822 } from "./feed.ts";
import { renderSource, segments } from "./markset.ts";
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
    expect(body).toContain(`Article · ${longDate(a.published)} · `);
    expect(body).toMatch(/ · \d+ min read</);
  });

  it("each give their reading time from their prose, at 230 words a minute", () => {
    expect(readingMinutes("---\nmarkset: 0\n---\n\nOne two three.")).toBe(1);
    const words = Array.from({ length: 460 }, () => "word").join(" ");
    expect(readingMinutes(`{.lead}\n${words}\n\n:::figure[A caption]{.shot}\n![a long description](/x.png)\n:::`)).toBe(
      2,
    );
    expect(readingMinutes(`${words} one more`)).toBe(3);
    const [first] = ARTICLES;
    if (first === undefined) throw new Error("no articles");
    expect(dateline(first, words)).toBe(`Article · ${longDate(first.published)} · 2 min read`);
  });

  it("give a dateline only to an article's own file", () => {
    for (const a of ARTICLES) expect(articleOf(articleFile(a))).toBe(a);
    expect(articleOf("articles.md")).toBeUndefined();
    expect(articleOf("door.md")).toBeUndefined();
  });

  it.each(ARTICLES)("$slug ends with its series, or the article to read next, then the index and the feed", (a) => {
    const end = renderSource(articleEnd(a), "end");
    expect(end).toContain('href="/articles/"');
    expect(end).toContain(`href="${feedPath}"`);
    expect(end).not.toContain(`href="${articlePath(a)}"`);
    if (a.series === undefined) expect(end).toContain("Read next");
    else {
      const parts = [...ARTICLES].reverse().filter((p) => p.series === a.series);
      expect(end).toContain(`${a.series} · Part ${parts.indexOf(a) + 1} of ${parts.length}`);
      for (const p of parts) if (p !== a) expect(end).toContain(`href="${articlePath(p)}"`);
      expect(end).toContain(`<span class="ms-span current">${a.title}</span>`);
    }
  });

  it("read in order: each article not in a series points at the next one published, the newest at the one before", () => {
    const list = [
      { slug: "c", title: "C", summary: "", published: "2026-03-01" },
      { slug: "b", title: "B", summary: "", published: "2026-02-01" },
      { slug: "a", title: "A", summary: "", published: "2026-01-01" },
    ];
    const [c, b, a] = list as [(typeof list)[0], (typeof list)[0], (typeof list)[0]];
    expect(articleEnd(a, list)).toContain("](/articles/b/)");
    expect(articleEnd(b, list)).toContain("](/articles/c/)");
    expect(articleEnd(c, list)).toContain("](/articles/b/)");
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
    expect(site.config.nav.map((n) => n.href)).toEqual(["/articles/", "/get-involved/"]);
  });
});
