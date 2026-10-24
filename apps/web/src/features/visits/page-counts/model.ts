import type { PageCount } from "../../../infrastructure/amplify/api.ts";

/**
 * The page counts as the Visits view shows them (CRV-017): totals per day, the most requested pages and the sites the
 * requests came from. The rows are aggregates already; nothing here can tell a visitor apart, because nothing it is
 * given can.
 */

export type DayTotal = { day: string; count: number };
export type Ranked = { key: string; label: string; count: number };

const dayMs = 24 * 60 * 60 * 1000;

/** The UTC day `n` days before `now`'s, as YYYY-MM-DD. */
export const dayBefore = (now: Date, n: number): string =>
  new Date(now.getTime() - n * dayMs).toISOString().slice(0, 10);

/**
 * The `count` days a view covers, oldest first, ending yesterday: today is still being served, and its count is
 * written the day after.
 */
export function lastDays(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => dayBefore(now, count - i));
}

/** Each day's requests, a day with none included as zero, in the order of `days`. */
export function totalsByDay(rows: readonly PageCount[], days: readonly string[]): DayTotal[] {
  const totals = new Map(days.map((day) => [day, 0]));
  for (const row of rows) {
    const total = totals.get(row.day);
    if (total !== undefined) totals.set(row.day, total + row.count);
  }
  return days.map((day) => ({ day, count: totals.get(day) ?? 0 }));
}

/** Only the rows of `days`. */
export function within(rows: readonly PageCount[], days: readonly string[]): PageCount[] {
  const wanted = new Set(days);
  return rows.filter((row) => wanted.has(row.day));
}

const ranked = (
  rows: readonly PageCount[],
  keyOf: (row: PageCount) => string,
  label: (key: string) => string,
  limit: number,
) => {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(keyOf(row), (totals.get(keyOf(row)) ?? 0) + row.count);
  return [...totals]
    .map(([key, count]) => ({ key, label: label(key), count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
};

/** The most requested pages, most first. */
export function topPages(rows: readonly PageCount[], limit = 10): Ranked[] {
  return ranked(rows, (row) => row.path, pageLabel, limit);
}

/** The sites requests came from, most first. */
export function topReferrers(rows: readonly PageCount[], limit = 10): Ranked[] {
  return ranked(rows, (row) => row.referrer, referrerLabel, limit);
}

/** A page as the table names it; the overflow row crv-visits folds a flooded day into reads as what it is. */
export function pageLabel(path: string): string {
  return path === "(other)" ? "Other pages" : path;
}

/** A referrer as the table names it: the words crv-visits writes for no site, this site and an address, or the site. */
export function referrerLabel(referrer: string): string {
  if (referrer === "direct") return "Direct, or not said";
  if (referrer === "internal") return "This site";
  if (referrer === "other") return "Other";
  return referrer;
}

/** The sum of the counts. */
export function total(rows: readonly { count: number }[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

/** A bar's width as a share of the largest, in percent; zero for an empty range. */
export function barWidth(count: number, largest: number): number {
  return largest > 0 ? Math.round((count / largest) * 1000) / 10 : 0;
}
