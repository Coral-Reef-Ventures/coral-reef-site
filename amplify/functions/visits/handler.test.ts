import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it, vi } from "vitest";

import { retention } from "../../areas/retention.ts";
import { memoryStore } from "../../test/memory-store.ts";
import { modelKeys } from "../shared/models.ts";
import { createVisits, daysToCount, type LogRange, type VisitsDeps } from "./handler.ts";

const header =
  "date,time,x-edge-location,sc-bytes,c-ip,cs-method,cs(Host),cs-uri-stem,sc-status,cs(Referer),cs(User-Agent),x-host-header";
const agent = "Mozilla/5.0%20(X11;%20Linux%20x86_64)%20Firefox/131.0";
const request = (day: string, path: string, referrer = "-", ip = "203.0.113.7") =>
  `${day},08:00:00,IAD89-C1,900,${ip},GET,d1example.cloudfront.net,${path},200,${referrer},${agent},coralreefventures.com`;

const logs: Record<string, string> = {
  "2026-10-23": [
    header,
    request("2026-10-23", "/"),
    request("2026-10-23", "/", "-", "198.51.100.9"),
    request("2026-10-23", "/whitepaper/", "https://www.linkedin.com/feed/?trk=ada%40example.com"),
    request("2026-10-23", "/_next/static/app.js"),
    // The range is inclusive of its end, so the next day's first second can appear.
    request("2026-10-24", "/"),
  ].join("\n"),
  "2026-10-22": [header, request("2026-10-22", "/privacy/")].join("\n"),
};

const settings = { appId: "d1example", domain: "coralreefventures.com", host: "coralreefventures.com" };
const now = new Date("2026-10-24T00:00:05.000Z");

const fixture = (over: Partial<VisitsDeps> = {}) => {
  const store = memoryStore(modelKeys);
  const ranges: LogRange[] = [];
  const deps: VisitsDeps = {
    settings,
    async logUrl(range) {
      ranges.push(range);
      return `https://logs.example/${range.start.toISOString().slice(0, 10)}.csv?X-Amz-Signature=secret`;
    },
    async download(url) {
      const day = /\/(\d{4}-\d{2}-\d{2})\.csv/.exec(url)?.[1] ?? "";
      // Amplify's file arrives gzipped; the handler reads it either way.
      return gzipSync(Buffer.from(logs[day] ?? header));
    },
    store,
    now: () => now,
    ...over,
  };
  return { store, ranges, run: createVisits(deps) };
};

const lines: string[] = [];

describe("crv-visits", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    lines.length = 0;
  });
  const capture = () => vi.spyOn(console, "log").mockImplementation((line: unknown) => lines.push(String(line)));

  it("counts yesterday and the day before, each as a whole UTC day", () => {
    expect(daysToCount(now)).toEqual(["2026-10-23", "2026-10-22"]);
  });

  it("asks for each day's log, and writes one PageCount row per day, page and referrer", async () => {
    capture();
    const { store, ranges, run } = fixture();
    expect(await run()).toEqual({ days: 2, failed: 0 });
    expect(ranges).toEqual([
      {
        appId: "d1example",
        domain: "coralreefventures.com",
        start: new Date("2026-10-23T00:00:00.000Z"),
        end: new Date("2026-10-23T23:59:59.999Z"),
      },
      {
        appId: "d1example",
        domain: "coralreefventures.com",
        start: new Date("2026-10-22T00:00:00.000Z"),
        end: new Date("2026-10-22T23:59:59.999Z"),
      },
    ]);
    const rows = store.all("PageCount").sort((a, b) => String(a.id).localeCompare(String(b.id)));
    expect(rows.map(({ id, site, day, path, referrer, count }) => ({ id, site, day, path, referrer, count }))).toEqual([
      {
        id: "2026-10-22|/privacy/|direct",
        site: "coralreefventures.com",
        day: "2026-10-22",
        path: "/privacy/",
        referrer: "direct",
        count: 1,
      },
      {
        id: "2026-10-23|/|direct",
        site: "coralreefventures.com",
        day: "2026-10-23",
        path: "/",
        referrer: "direct",
        count: 2,
      },
      {
        id: "2026-10-23|/whitepaper/|linkedin.com",
        site: "coralreefventures.com",
        day: "2026-10-23",
        path: "/whitepaper/",
        referrer: "linkedin.com",
        count: 1,
      },
    ]);
    // Amplify's resolvers' attributes, and 13 months from the day counted.
    const first = rows.find((row) => row.id === "2026-10-23|/|direct");
    expect(first).toMatchObject({ __typename: "PageCount", createdAt: now.toISOString() });
    expect(first?.expiresAt).toBe(Date.parse("2026-10-23T00:00:00.000Z") / 1000 + retention.pageCount.seconds);
    // Nothing that tells one visitor from another reaches the table.
    const stored = JSON.stringify(store.all("PageCount"));
    for (const value of ["203.0.113.7", "198.51.100.9", "Firefox", "ada", "trk", "feed"]) {
      expect(stored, value).not.toContain(value);
    }
  });

  it("overwrites a day counted again rather than adding to it", async () => {
    capture();
    const { store, run } = fixture();
    await run();
    await run();
    expect(store.all("PageCount").find((row) => row.id === "2026-10-23|/|direct")?.count).toBe(2);
    expect(store.all("PageCount")).toHaveLength(3);
  });

  it("logs each day's counts and nothing of the log: no row, address, browser, referrer or the log's URL", async () => {
    capture();
    await fixture().run();
    expect(lines).toEqual([
      JSON.stringify({ kind: "visits.counted", day: "2026-10-23", rows: 2, counted: 3, seen: 4, status: "ok" }),
      JSON.stringify({ kind: "visits.counted", day: "2026-10-22", rows: 1, counted: 1, seen: 1, status: "ok" }),
    ]);
    const all = lines.join("\n");
    for (const value of ["203.0.113", "Mozilla", "linkedin", "logs.example", "Signature", "/whitepaper/"]) {
      expect(all, value).not.toContain(value);
    }
  });

  it("goes on past a day that fails, logs the error's name alone, and then fails so the alarm says so", async () => {
    capture();
    const { store, run } = fixture({
      async logUrl(range) {
        if (range.start.toISOString().startsWith("2026-10-23")) {
          const error = new Error("https://logs.example/secret?X-Amz-Signature=abc denied");
          error.name = "AccessDeniedException";
          throw error;
        }
        return "https://logs.example/2026-10-22.csv";
      },
    });
    await expect(run()).rejects.toThrow("crv-visits could not count 1 of 2 days");
    expect(lines[0]).toBe(JSON.stringify({ kind: "visits.failed", day: "2026-10-23", error: "AccessDeniedException" }));
    expect(lines.join("\n")).not.toContain("Signature");
    expect(store.all("PageCount").map((row) => row.day)).toEqual(["2026-10-22"]);
  });

  it("counts nothing, and says so, where there is no hosted app: a sandbox", async () => {
    capture();
    const logUrl = vi.fn();
    const { store, run } = fixture({ settings: undefined, logUrl });
    expect(await run()).toEqual({ days: 0, failed: 0 });
    expect(logUrl).not.toHaveBeenCalled();
    expect(store.all("PageCount")).toEqual([]);
    expect(lines).toEqual([JSON.stringify({ kind: "visits.skipped", reason: "unconfigured" })]);
  });
});
