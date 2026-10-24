import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PageCount } from "../../../infrastructure/amplify/api.ts";
import { createStubApi } from "../../../infrastructure/amplify/adminStub.ts";
import {
  barWidth,
  lastDays,
  pageLabel,
  referrerLabel,
  topPages,
  topReferrers,
  total,
  totalsByDay,
  within,
} from "./model.ts";
import { PageCountsReport, VISITS_NOTE } from "./VisitsView.tsx";

const now = new Date("2026-10-24T09:00:00Z");
const c = (day: string, path: string, referrer: string, count: number): PageCount => ({ day, path, referrer, count });

const rows = [
  c("2026-10-23", "/", "direct", 5),
  c("2026-10-23", "/", "search.example", 2),
  c("2026-10-23", "/whitepaper/", "internal", 3),
  c("2026-10-21", "/whitepaper/", "news.example", 4),
  c("2026-10-01", "/", "direct", 9),
];

describe("the days a view covers", () => {
  it("end yesterday, since today's requests are counted tomorrow, oldest first", () => {
    expect(lastDays(now, 3)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23"]);
    expect(lastDays(now, 30)).toHaveLength(30);
    expect(lastDays(now, 30)[0]).toBe("2026-09-24");
  });

  it("keep only their own rows", () => {
    expect(within(rows, lastDays(now, 7))).toHaveLength(4);
  });
});

describe("the totals", () => {
  it("sum each day, with a day of none as zero", () => {
    expect(totalsByDay(rows, lastDays(now, 3))).toEqual([
      { day: "2026-10-21", count: 4 },
      { day: "2026-10-22", count: 0 },
      { day: "2026-10-23", count: 10 },
    ]);
    expect(total(within(rows, lastDays(now, 3)))).toBe(14);
  });

  it("rank pages and referrers, most first, under readable names", () => {
    const week = within(rows, lastDays(now, 7));
    // A tie keeps the path order, so the table does not shuffle between loads.
    expect(topPages(week)).toEqual([
      { key: "/", label: "/", count: 7 },
      { key: "/whitepaper/", label: "/whitepaper/", count: 7 },
    ]);
    expect(topReferrers(week).map((r) => [r.label, r.count])).toEqual([
      ["Direct, or not said", 5],
      ["news.example", 4],
      ["This site", 3],
      ["search.example", 2],
    ]);
    expect(topReferrers(week, 1)).toHaveLength(1);
  });

  it("name the words crv-visits writes", () => {
    expect(referrerLabel("direct")).toBe("Direct, or not said");
    expect(referrerLabel("internal")).toBe("This site");
    expect(referrerLabel("other")).toBe("Other");
    expect(referrerLabel("linkedin.com")).toBe("linkedin.com");
    expect(pageLabel("(other)")).toBe("Other pages");
  });

  it("draw each bar as a share of the busiest day", () => {
    expect(barWidth(5, 10)).toBe(50);
    expect(barWidth(1, 3)).toBe(33.3);
    expect(barWidth(0, 0)).toBe(0);
  });
});

describe("the report", () => {
  const draw = (data: PageCount[], days: string[]) =>
    renderToStaticMarkup(
      <MantineProvider>
        <PageCountsReport rows={data} days={days} />
      </MantineProvider>,
    );

  it("shows the total, each day newest first with its bar, the pages and the referrers", () => {
    const html = draw(rows, lastDays(now, 3));
    expect(html).toContain("14 page requests in the last 3 days.");
    expect(html.indexOf("2026-10-23")).toBeLessThan(html.indexOf("2026-10-21"));
    expect(html).toContain("width:100%");
    expect(html).toContain("width:40%");
    expect(html).toContain("Most requested pages");
    expect(html).toContain("news.example");
    expect(html).toContain("This site");
    expect(html).not.toContain("2026-10-01");
  });

  it("says so when a range has nothing", () => {
    const html = draw([], lastDays(now, 7));
    expect(html).toContain("0 page requests in the last 7 days.");
    expect(html).toContain("None.");
  });

  it("is described as requests counted from the host's logs, bots left out, not people", () => {
    expect(VISITS_NOTE).toContain("from the host's own access logs");
    expect(VISITS_NOTE).toContain("known bots left out");
    expect(VISITS_NOTE).toContain("not people");
  });
});

describe("the stub's page counts", () => {
  it("are invented, under .example, and kept to the range asked for", async () => {
    const api = createStubApi(() => now);
    const days = lastDays(now, 7);
    const got = await api.listPageCounts("localhost:3002", days[0] ?? "", days.at(-1) ?? "");
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((row) => row.day >= (days[0] ?? "") && row.day <= (days.at(-1) ?? ""))).toBe(true);
    for (const row of got) {
      expect(["direct", "internal"].includes(row.referrer) || row.referrer.endsWith(".example"), row.referrer).toBe(
        true,
      );
    }
  });
});
