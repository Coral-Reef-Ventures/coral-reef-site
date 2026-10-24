import { gunzipSync } from "node:zlib";

/**
 * Page counts from the host's access logs (CRV-017), as pure functions: crv-visits hands them a day's log and writes
 * what comes back. The log is Amplify's, CSV in CloudFront's columns with a header row, read by column name (CloudFront's
 * own tab-separated form is read too, in case the log arrives that way). Each row
 * is read for the few fields that decide whether it counts and where it came from, and dropped: nothing here returns,
 * keeps or logs an address, a browser, a full referrer URL or a row.
 */

/** A page's requests on one day from one referrer: the only thing kept. */
export type PageCountRow = { day: string; path: string; referrer: string; count: number };

/** A day's counts, and how many requests the log held and how many of them counted. */
export type Tally = { rows: PageCountRow[]; seen: number; counted: number };

/** The log's shape changed: a column this reads is missing. */
export class LogFormatError extends Error {
  constructor(column: string) {
    super(`The access log has no ${column} column`);
    this.name = "LogFormatError";
  }
}

/** The longest path counted; anything longer is a probe, not a page. */
export const maxPathLength = 200;

/** The most rows one day keeps; the least requested beyond it are folded into one, so a flood of odd paths stays small. */
export const maxRowsPerDay = 500;

/** The row the overflow is folded into. */
export const otherPath = "(other)";

/** Pages that do not end in `/`: the feed, and the deck's redirect (custom-rules.json), which answers 302. */
const exactPages = new Set(["/articles/feed.xml", "/intentset-deck", "/intentset-deck/"]);
const redirects = new Set(["/intentset-deck", "/intentset-deck/"]);

/** Paths that end in `/` but are not pages a visitor reads: the admin views, the build's assets, sign-in's returns. */
const notPages = ["/admin/", "/_next/", "/signed-in/", "/signout/"];

/** What a page's path may hold. Anything else, a `|` or a space say, is not a page this site serves. */
const pathShape = /^\/[A-Za-z0-9/._~%-]*$/;

/** Crawlers, link previews, scripts and monitors: requests no person made. */
export const botAgent =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|curl|wget|python|go-http|java|headless|lighthouse|monitor|uptime|scan/i;

const hostnameShape = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** The log as text, gunzipped when it arrives compressed. */
export const logText = (body: Uint8Array): string => {
  const bytes = body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body;
  return new TextDecoder().decode(bytes);
};

/**
 * CloudFront's own W3C form, in case the log arrives that way: `#Fields:` names the columns, and the rows are separated
 * by tabs. Undefined for any other text.
 */
const parseW3c = (text: string): string[][] | undefined => {
  const lines = text.split(/\r?\n/);
  const fields = lines.find((line) => line.startsWith("#Fields:"));
  if (!fields) return undefined;
  const header = fields.slice("#Fields:".length).trim().split(/\s+/);
  return [
    header,
    ...lines.filter((line) => line.trim() !== "" && !line.startsWith("#")).map((line) => line.split("\t")),
  ];
};

/** The log's rows, header first: Amplify's CSV, or CloudFront's W3C form. */
export const parseLog = (text: string): string[][] => parseW3c(text) ?? parseCsv(text);

/** CSV rows: commas, quoted fields with doubled quotes, LF or CRLF. Blank lines are left out. */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") endRow();
    else if (char !== "\r") field += char;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
};

const decoded = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const bare = (host: string): string => host.toLowerCase().replace(/^www\./, "");

/** A hostname, lowercased and without `www.`; `direct` with none; `internal` for the site itself; `other` for an address. */
export const referrerOf = (value: string | undefined, siteHost: string): string => {
  const raw = (value ?? "").trim();
  if (!raw || raw === "-") return "direct";
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    try {
      host = new URL(decoded(raw)).hostname;
    } catch {
      return "direct";
    }
  }
  if (!host) return "direct";
  const name = bare(host);
  if (name === bare(siteHost)) return "internal";
  // An IP address or anything else that is not a name is kept as a word, never as itself.
  return hostnameShape.test(name) ? name : "other";
};

/** Whether a path is a page a visitor reads. */
export const isPage = (path: string): boolean => {
  if (path.length > maxPathLength || !pathShape.test(path)) return false;
  if (exactPages.has(path)) return true;
  return path.endsWith("/") && !notPages.some((prefix) => path.startsWith(prefix));
};

/** Whether a user agent is a person's browser, as far as its name says. */
export const isPerson = (agent: string | undefined): boolean => {
  const name = decoded(agent ?? "").trim();
  return name !== "" && name !== "-" && !botAgent.test(name);
};

const column = (header: string[], ...names: string[]): number => {
  for (const name of names) {
    const at = header.indexOf(name);
    if (at >= 0) return at;
  }
  throw new LogFormatError(names[0] ?? "");
};

/**
 * One day's page counts from a log. A request counts when it is a GET answered 200 or 304 (302 for the deck's
 * redirect), to the site's own host, for a page, from something that is not a bot. `day`, when given, keeps only that
 * UTC day's rows, since a range inclusive of its end can reach into the next.
 */
export const countPages = (text: string, siteHost: string, day?: string): Tally => {
  const [header, ...rows] = parseLog(text);
  if (!header) return { rows: [], seen: 0, counted: 0 };
  const names = header.map((name) => name.trim());
  const at = {
    date: column(names, "date"),
    method: column(names, "cs-method"),
    // The Host the visitor asked for; cs(Host) is the distribution's own name in CloudFront's logs.
    host: column(names, "x-host-header", "cs(Host)"),
    path: column(names, "cs-uri-stem"),
    status: column(names, "sc-status"),
    referrer: column(names, "cs(Referer)"),
    agent: column(names, "cs(User-Agent)"),
  };
  const site = siteHost.toLowerCase();
  const counts = new Map<string, PageCountRow>();
  let seen = 0;
  let counted = 0;
  for (const row of rows) {
    const date = row[at.date] ?? "";
    if (day && date !== day) continue;
    seen += 1;
    const path = row[at.path] ?? "";
    const status = row[at.status] ?? "";
    const ok = status === "200" || status === "304" || (status === "302" && redirects.has(path));
    if (row[at.method] !== "GET" || !ok) continue;
    if ((row[at.host] ?? "").toLowerCase() !== site) continue;
    if (!isPage(path) || !isPerson(row[at.agent])) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const referrer = referrerOf(row[at.referrer], site);
    const key = `${date}|${path}|${referrer}`;
    const found = counts.get(key);
    if (found) found.count += 1;
    else counts.set(key, { day: date, path, referrer, count: 1 });
    counted += 1;
  }
  return { rows: capped([...counts.values()]), seen, counted };
};

/** At most maxRowsPerDay rows a day: the most requested, and the rest folded into one `(other)` row. */
const capped = (rows: PageCountRow[]): PageCountRow[] => {
  const byDay = new Map<string, PageCountRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.day);
    if (list) list.push(row);
    else byDay.set(row.day, [row]);
  }
  return [...byDay.values()].flatMap((dayRows) => {
    if (dayRows.length <= maxRowsPerDay) return dayRows;
    const sorted = [...dayRows].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    const kept = sorted.slice(0, maxRowsPerDay - 1);
    const rest = sorted.slice(maxRowsPerDay - 1).reduce((sum, row) => sum + row.count, 0);
    const day = dayRows[0]?.day ?? "";
    return [...kept, { day, path: otherPath, referrer: "other", count: rest }];
  });
};

/** A row's id: the day, the path and the referrer, so a day counted again overwrites its own rows. */
export const pageCountId = (row: PageCountRow): string => `${row.day}|${row.path}|${row.referrer}`;
