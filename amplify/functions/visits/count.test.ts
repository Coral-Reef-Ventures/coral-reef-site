import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  countPages,
  isPage,
  isPerson,
  LogFormatError,
  logText,
  maxRowsPerDay,
  pageCountId,
  parseCsv,
  referrerOf,
} from "./count.ts";

const header =
  "date,time,x-edge-location,sc-bytes,c-ip,cs-method,cs(Host),cs-uri-stem,sc-status,cs(Referer),cs(User-Agent),cs-uri-query,cs(Cookie),x-edge-result-type,x-edge-request-id,x-host-header";

const browser = "Mozilla/5.0%20(Macintosh;%20Intel%20Mac%20OS%20X%2010_15_7)%20AppleWebKit/605.1.15%20Safari/605.1.15";

type Line = {
  date?: string;
  ip?: string;
  method?: string;
  path?: string;
  status?: string;
  referrer?: string;
  agent?: string;
  host?: string;
};

const line = ({
  date = "2026-10-23",
  ip = "203.0.113.7",
  method = "GET",
  path = "/",
  status = "200",
  referrer = "-",
  agent = browser,
  host = "coralreefventures.com",
}: Line) =>
  [
    date,
    "10:15:01",
    "IAD89-C1",
    "5120",
    ip,
    method,
    "d1example.cloudfront.net",
    path,
    status,
    referrer,
    agent,
    "-",
    "-",
    "Hit",
    "req-1",
    host,
  ].join(",");

const log = (...lines: Line[]) => [header, ...lines.map(line)].join("\n");

const site = "coralreefventures.com";

describe("the access log's CSV", () => {
  it("is read by column, with quoted fields, doubled quotes and CRLF", () => {
    expect(parseCsv('a,b,c\r\n"x, y","say ""hi""",z\n\n')).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "z"],
    ]);
  });

  it("is gunzipped when it arrives compressed, and read as it is otherwise", () => {
    const text = log({});
    expect(logText(gzipSync(Buffer.from(text)))).toBe(text);
    expect(logText(new TextEncoder().encode(text))).toBe(text);
  });

  it("refuses a log without a column it reads, rather than counting nothing", () => {
    expect(() => countPages("date,time\n2026-10-23,10:00:00", site)).toThrow(LogFormatError);
  });

  it("counts nothing in an empty log", () => {
    expect(countPages("", site)).toEqual({ rows: [], seen: 0, counted: 0 });
  });

  it("reads CloudFront's own tab-separated form too", () => {
    const fields = header.split(",");
    const row = line({ path: "/whitepaper/" }).split(",");
    const w3c = ["#Version: 1.0", `#Fields: ${fields.join(" ")}`, row.join("\t")].join("\n");
    expect(countPages(w3c, site).rows).toEqual([
      { day: "2026-10-23", path: "/whitepaper/", referrer: "direct", count: 1 },
    ]);
  });
});

describe("what counts", () => {
  it("counts a person's GET of a page on the site, by day, page and referring site", () => {
    const tally = countPages(
      log(
        { path: "/" },
        { path: "/", ip: "198.51.100.9" },
        { path: "/", referrer: "https://www.google.com/search?q=coral" },
        { path: "/whitepaper/", referrer: "https://news.ycombinator.com/item?id=1" },
        { path: "/whitepaper/", referrer: "https://coralreefventures.com/" },
        { path: "/privacy/", status: "304" },
      ),
      site,
    );
    expect(tally).toEqual({
      seen: 6,
      counted: 6,
      rows: [
        { day: "2026-10-23", path: "/", referrer: "direct", count: 2 },
        { day: "2026-10-23", path: "/", referrer: "google.com", count: 1 },
        { day: "2026-10-23", path: "/whitepaper/", referrer: "news.ycombinator.com", count: 1 },
        { day: "2026-10-23", path: "/whitepaper/", referrer: "internal", count: 1 },
        { day: "2026-10-23", path: "/privacy/", referrer: "direct", count: 1 },
      ],
    });
  });

  it("leaves out bots, assets, admin and sign-in pages, failures, other methods and other hosts", () => {
    const tally = countPages(
      log(
        { agent: "Mozilla/5.0%20(compatible;%20Googlebot/2.1;%20+http://www.google.com/bot.html)" },
        { agent: "facebookexternalhit/1.1" },
        { agent: "Slackbot-LinkExpanding%201.0" },
        { agent: "curl/8.7.1" },
        { agent: "python-requests/2.32" },
        { agent: "Mozilla/5.0%20HeadlessChrome/120" },
        { agent: "-" },
        { agent: "" },
        { path: "/_next/static/chunks/main.js" },
        { path: "/_next/static/" },
        { path: "/icon.svg" },
        { path: "/social-card.png" },
        { path: "/admin/" },
        { path: "/admin/invitations/" },
        { path: "/signed-in/" },
        { path: "/signout/done/" },
        { path: "/missing/", status: "404" },
        { path: "/", status: "500" },
        { path: "/", method: "HEAD" },
        { path: "/", method: "POST" },
        { path: "/", host: "www.coralreefventures.com", status: "301" },
        { path: "/", host: "main.d1example.amplifyapp.com" },
        { path: `/${"a".repeat(250)}/` },
        { path: "/a|b/" },
      ),
      site,
    );
    expect(tally).toEqual({ rows: [], seen: 24, counted: 0 });
  });

  it("counts the feed, and the deck's redirect by its 302", () => {
    const tally = countPages(
      log(
        { path: "/articles/feed.xml" },
        { path: "/intentset-deck", status: "302" },
        { path: "/intentset-deck/", status: "302" },
        { path: "/whitepaper/", status: "302" },
      ),
      site,
    );
    expect(tally.rows.map((row) => [row.path, row.count])).toEqual([
      ["/articles/feed.xml", 1],
      ["/intentset-deck", 1],
      ["/intentset-deck/", 1],
    ]);
    expect(tally.counted).toBe(3);
  });

  it("keeps only the day asked for, since a range inclusive of its end reaches the next", () => {
    const tally = countPages(log({ date: "2026-10-23" }, { date: "2026-10-24" }), site, "2026-10-23");
    expect(tally).toMatchObject({ seen: 1, counted: 1 });
    expect(tally.rows.map((row) => row.day)).toEqual(["2026-10-23"]);
  });

  it("matches the site by the host the visitor asked for, whatever its case", () => {
    expect(countPages(log({ host: "CoralReefVentures.com" }), site).counted).toBe(1);
    expect(countPages(log({ host: "dev.coralreefventures.com" }), "dev.coralreefventures.com").counted).toBe(1);
    expect(countPages(log({ host: "dev.coralreefventures.com" }), site).counted).toBe(0);
  });

  it("folds the least requested rows of a flooded day into one, so the table stays small", () => {
    const lines = Array.from({ length: maxRowsPerDay + 50 }, (_, i) => ({ path: `/p${i}/` }));
    const tally = countPages(log(...lines, { path: "/" }, { path: "/" }), site);
    expect(tally.rows).toHaveLength(maxRowsPerDay);
    expect(tally.rows[0]).toEqual({ day: "2026-10-23", path: "/", referrer: "direct", count: 2 });
    expect(tally.rows.at(-1)).toEqual({ day: "2026-10-23", path: "(other)", referrer: "other", count: 52 });
    expect(tally.rows.reduce((sum, row) => sum + row.count, 0)).toBe(tally.counted);
  });
});

describe("what is kept of a request", () => {
  it("is never the address, the browser or the referrer's full URL", () => {
    const tally = countPages(
      log({ ip: "203.0.113.7", referrer: "https://www.example.org/private/page?user=ada%40example.com" }),
      site,
    );
    const kept = JSON.stringify(tally);
    expect(kept).not.toContain("203.0.113.7");
    expect(kept).not.toContain("Mozilla");
    expect(kept).not.toContain("private");
    expect(kept).not.toContain("ada");
    expect(tally.rows[0]?.referrer).toBe("example.org");
  });

  it.each([
    ["-", "direct"],
    ["", "direct"],
    [undefined, "direct"],
    ["not a url", "direct"],
    ["https://WWW.LinkedIn.com/feed/", "linkedin.com"],
    ["https://www.coralreefventures.com/whitepaper/", "internal"],
    ["https://coralreefventures.com/", "internal"],
    ["https%3A%2F%2Fduckduckgo.com%2F", "duckduckgo.com"],
    ["http://192.0.2.10/page", "other"],
    ["http://[2001:db8::1]/", "other"],
  ])("names the referrer %j as %j", (value, expected) => {
    expect(referrerOf(value, site)).toBe(expected);
  });

  it("gives each row an id of its day, page and referrer, so a day counted again overwrites it", () => {
    expect(pageCountId({ day: "2026-10-23", path: "/", referrer: "direct", count: 3 })).toBe("2026-10-23|/|direct");
  });
});

describe("pages and people", () => {
  it.each([
    ["/", true],
    ["/whitepaper/", true],
    ["/articles/a-post/", true],
    ["/articles/feed.xml", true],
    ["/intentset-deck", true],
    ["/robots.txt", false],
    ["/sitemap.xml", false],
    ["/404.html", false],
    ["/admin/visits/", false],
  ])("%s is a page: %s", (path, expected) => expect(isPage(path)).toBe(expected));

  it("takes a browser for a person and a fetcher for none", () => {
    expect(isPerson(browser)).toBe(true);
    for (const agent of [
      "Twitterbot/1.0",
      "WhatsApp/2.23",
      "TelegramBot",
      "Discordbot/2.0",
      "Wget/1.21",
      "Go-http-client/2.0",
      "Java/17",
      "Chrome-Lighthouse",
      "UptimeRobot/2.0",
      "Embedly",
      "Yahoo! Slurp",
      "Mozilla/5.0 (compatible; bingpreview)",
    ]) {
      expect(isPerson(agent), agent).toBe(false);
    }
  });
});
