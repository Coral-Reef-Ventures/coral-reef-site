import { randomBytes } from "node:crypto";

import { type Exchange, header, type Send } from "./http.ts";
import type { CheckedHost } from "./sites.ts";

/**
 * The leak check's rules (plan Phase 3, "CRV side", with the coming-soon page of go-ahead §17). Without a session a
 * locked site gives nothing of itself: a page load gets the gate's coming-soon page, the same bytes for every path but
 * the canonical next in its sign-in link, and anything else an empty 401. With a session minted for a temporary
 * invitee the site answers 200. A host the gate does not allow gets 403, and `www` is sent to the apex before the gate
 * runs. Every gated answer says a shared cache must not keep it (RULE-GATED-NO-STORE) and asks not to be indexed.
 */

export const sessionCookie = "__Host-crv_door";

export type Mode = "page" | "fetch";

/** A browser's page load, which the gate answers with the coming-soon page, and a script's fetch, which gets a 401. */
export const modeHeaders: Record<Mode, Record<string, string>> = {
  page: {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  },
  fetch: { Accept: "*/*", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", "Sec-Fetch-Site": "same-origin" },
};

export type Finding = { host: string; target: string; step: string; problem: string };

/**
 * A path to check. `listed` paths are the site's own (its sitemap's pages and what they reference) and must answer 200
 * to a session; `probe` paths may not exist, so a session may get 404 there, but never a byte without one.
 */
export type CheckPath = { target: string; kind: "listed" | "probe"; page: boolean };

/** The gate's robots.txt, served on every gated host whatever the session: the site's own never is. */
export const gateRobots = "User-agent: *\nDisallow: /\n";

/** A backslash or a control character (U+0000 to U+001F, U+007F), which *Canonical next* refuses. */
const controlOrBackslash = {
  test: (value: string) =>
    [...value].some((char) => char === "\\" || char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f),
};

/** The gate's *Canonical next* (plan §3) for a request target: the path and query it puts in the sign-in link. */
export const expectedNext = (target: string, host: string): string => {
  if (target.length > 512 || controlOrBackslash.test(target)) return "/";
  if (!target.startsWith("/") || target.startsWith("//")) return "/";
  try {
    const url = new URL(target, `https://${host}`);
    if (url.origin !== `https://${host}`) return "/";
    const next = `${url.pathname}${url.search}`;
    return next.startsWith("//") || controlOrBackslash.test(next) ? "/" : next;
  } catch {
    return "/";
  }
};

const unescapeHtml = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const signinLink = /href="(\/_door\/signin\?[^"]*)"/g;

/**
 * The coming-soon page split into what must be identical everywhere (the page with its one sign-in link blanked) and
 * the part that varies (that link's `next`), or why the body is not that page.
 */
export const comingSoonParts = (body: string): { template: string; next: string } | { problem: string } => {
  const links = [...body.matchAll(signinLink)];
  if (links.length !== 1) return { problem: `has ${links.length} sign-in links where the coming-soon page has one` };
  const [whole, href] = links[0] as RegExpMatchArray & [string, string];
  const next = new URLSearchParams(unescapeHtml(href).split("?")[1] ?? "").get("next");
  if (next === null) return { problem: "has a sign-in link with no next" };
  return { template: body.replace(whole, 'href=""'), next };
};

/** Cache-Control that no shared cache may keep: `no-store` or `private`, and never `public` or `s-maxage`. */
export const sharedCacheProblem = (exchange: Exchange): string | undefined => {
  const value = header(exchange, "cache-control").toLowerCase();
  if (!value) return "has no Cache-Control";
  if (/\bpublic\b|s-maxage/.test(value)) return `lets a shared cache keep it (Cache-Control: ${value})`;
  if (!/\b(no-store|private)\b/.test(value)) return `does not say no-store or private (Cache-Control: ${value})`;
  return undefined;
};

const noStoreProblem = (exchange: Exchange): string | undefined =>
  /\bno-store\b/i.test(header(exchange, "cache-control"))
    ? undefined
    : `is not no-store (Cache-Control: ${header(exchange, "cache-control") || "none"})`;

const noindexProblem = (exchange: Exchange): string | undefined =>
  /\bnoindex\b/i.test(header(exchange, "x-robots-tag")) ? undefined : "has no X-Robots-Tag: noindex";

const describe = (exchange: Exchange) =>
  `${exchange.status}${exchange.body.length > 0 ? ` with ${exchange.body.length} bytes` : ""}`;

/** What a site's own page carries that the coming-soon page must not: its `<title>` elements, collected with a session. */
export type SiteMarks = { titles: Set<string> };

const titleElement = /<title[^>]*>[^<]*<\/title>/gi;

export const titlesOf = (html: string): string[] => html.match(titleElement) ?? [];

const carriesSite = (body: Buffer, marks: SiteMarks): boolean => {
  if (body.length === 0 || marks.titles.size === 0) return false;
  const text = body.toString("utf8");
  return titlesOf(text).some((title) => marks.titles.has(title));
};

/**
 * A request without a session. A page load must be the coming-soon page: 401, HTML, no-store, the reference's bytes
 * with only the sign-in link's next differing, and that next the request's own target. Anything else must be an empty
 * 401. `reference` is the site's coming-soon template, taken from its first page load.
 */
export const withoutSessionProblems = (
  exchange: Exchange,
  mode: Mode,
  context: { host: string; target: string; reference: string | undefined; marks: SiteMarks },
): string[] => {
  const problems: string[] = [];
  if (carriesSite(exchange.body, context.marks)) problems.push("carries one of the site's own pages");
  if (exchange.status !== 401) {
    problems.push(
      `answered ${describe(exchange)} where ${mode === "page" ? "the coming-soon page" : "an empty response"} is a 401`,
    );
    return problems;
  }
  for (const problem of [noStoreProblem(exchange), noindexProblem(exchange)]) if (problem) problems.push(problem);
  if (mode === "fetch") {
    if (exchange.body.length > 0)
      problems.push(`answered a fetch with ${exchange.body.length} bytes where it is empty`);
    return problems;
  }
  if (!/^text\/html\b/i.test(header(exchange, "content-type"))) {
    problems.push(`answered a page load with ${header(exchange, "content-type") || "no Content-Type"}, not HTML`);
  }
  const parts = comingSoonParts(exchange.body.toString("utf8"));
  if ("problem" in parts) {
    problems.push(`is not the coming-soon page: it ${parts.problem}`);
    return problems;
  }
  if (context.reference !== undefined && parts.template !== context.reference) {
    problems.push("differs from the coming-soon page by more than its sign-in link");
  }
  const expected = expectedNext(context.target, context.host);
  if (parts.next !== expected) {
    problems.push(`signs in with next ${JSON.stringify(parts.next)} where ${JSON.stringify(expected)} was asked for`);
  }
  return problems;
};

/** A request with the session: the site's own paths answer 200, and nothing gated is shareable in a cache. */
export const withSessionProblems = (exchange: Exchange, path: CheckPath): string[] => {
  const problems: string[] = [];
  const allowed = path.kind === "listed" ? [200] : [200, 301, 308, 404];
  if (!allowed.includes(exchange.status)) {
    problems.push(`answered ${exchange.status} to a session where ${allowed.join(" or ")} was expected`);
  }
  for (const problem of [sharedCacheProblem(exchange), noindexProblem(exchange)]) if (problem) problems.push(problem);
  return problems;
};

/** A host the gate does not allow: 403, empty, not stored, with or without a session. */
export const refusedHostProblems = (exchange: Exchange): string[] => {
  const problems: string[] = [];
  if (exchange.status !== 403) problems.push(`answered ${describe(exchange)} where a refused host gets 403`);
  else if (exchange.body.length > 0) problems.push(`answered 403 with ${exchange.body.length} bytes where it is empty`);
  const store = noStoreProblem(exchange);
  if (store) problems.push(store);
  return problems;
};

/** `www`: Amplify's rule sends it to the same path on the apex before the gate runs, carrying nothing of the site. */
export const redirectHostProblems = (exchange: Exchange, apex: string, target: string, marks: SiteMarks): string[] => {
  const problems: string[] = [];
  const location = header(exchange, "location");
  if (![301, 302, 307, 308].includes(exchange.status)) {
    problems.push(`answered ${describe(exchange)} where www is redirected to ${apex}`);
  } else if (location !== `https://${apex}${target}`) {
    problems.push(`redirected to ${JSON.stringify(location)} where https://${apex}${target} was expected`);
  }
  if (exchange.body.length > 512 || carriesSite(exchange.body, marks)) {
    problems.push(`carries ${exchange.body.length} bytes with its redirect`);
  }
  return problems;
};

/** The paths a sitemap lists, as targets on the host (path and query), each once and in order. */
export const sitemapPages = (xml: string): string[] => {
  const pages: string[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    try {
      const url = new URL(unescapeHtml(match[1] ?? ""));
      const target = `${url.pathname}${url.search}`;
      if (!pages.includes(target)) pages.push(target);
    } catch {
      // A malformed entry names nothing to check.
    }
  }
  return pages;
};

/**
 * Same-origin paths a page references, for the check to request too: `href`, `src`, `content` (the social image),
 * `srcset` entries, and every `/_next/static/` path in the page, including those in its inline router payload.
 * Fragments are dropped; the gate's own `/_door/` paths are not the site's.
 */
export const referencedPaths = (html: string, hosts: readonly string[]): string[] => {
  const found = new Set<string>();
  const add = (raw: string) => {
    const value = unescapeHtml(raw.trim()).split("#")[0] ?? "";
    let target: string | undefined;
    if (value.startsWith("/") && !value.startsWith("//")) target = value;
    else {
      try {
        const url = new URL(value);
        if (url.protocol === "https:" && hosts.includes(url.hostname)) target = `${url.pathname}${url.search}`;
      } catch {
        target = undefined;
      }
    }
    if (!target || /[\s"'<>\\]/.test(target) || target.startsWith("/_door/") || target === "/_door") return;
    found.add(target);
  };
  for (const match of html.matchAll(/\b(?:href|src|content|poster)\s*=\s*"([^"]*)"/gi)) add(match[1] ?? "");
  for (const match of html.matchAll(/\bsrcset\s*=\s*"([^"]*)"/gi)) {
    for (const entry of (match[1] ?? "").split(",")) add(entry.trim().split(/\s+/)[0] ?? "");
  }
  for (const match of html.matchAll(/\/_next\/static\/[A-Za-z0-9._~/%-]+/g)) add(match[0]);
  return [...found];
};

/** Paths every check requests whether or not the site has them: a missing page must not show the site's 404 either. */
export const probePaths = (): CheckPath[] => [
  { target: "/404.html", kind: "probe", page: true },
  { target: "/sitemap.xml", kind: "probe", page: false },
  { target: "/index.txt", kind: "probe", page: false },
  { target: `/leak-check-${randomBytes(6).toString("hex")}/`, kind: "probe", page: true },
];

/** Runs `work` over `items`, at most `limit` at once, keeping the order of the results. */
export const pool = async <T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index] as T);
    }
  });
  await Promise.all(lanes);
  return results;
};

const cookieHeader = (cookie: string | undefined): Record<string, string> =>
  cookie ? { Cookie: `${sessionCookie}=${cookie}` } : {};

/**
 * What a session can see of a site: its pages (the live sitemap, or `fallback` when the sitemap is not served), what
 * those pages reference, and their titles. Also notes any page the sitemap has that `fallback` lacks, so the list a
 * run without a session uses can be kept current.
 */
export const discover = async (input: {
  send: Send;
  host: string;
  hosts: readonly string[];
  cookie: string;
  fallback: readonly string[];
  limit?: number;
}): Promise<{ paths: CheckPath[]; marks: SiteMarks; findings: Finding[]; notes: string[] }> => {
  const { send, host, cookie } = input;
  const findings: Finding[] = [];
  const notes: string[] = [];
  const sitemap = await send({
    host,
    target: "/sitemap.xml",
    headers: { ...modeHeaders.fetch, ...cookieHeader(cookie) },
  });
  let pages = sitemap.status === 200 ? sitemapPages(sitemap.body.toString("utf8")) : [];
  if (pages.length === 0) {
    findings.push({
      host,
      target: "/sitemap.xml",
      step: "with a session",
      problem: `listed no pages (${sitemap.status}); checked the ${input.fallback.length} known pages instead`,
    });
    pages = [...input.fallback];
  }
  const missing = pages.filter((page) => !input.fallback.includes(page));
  if (missing.length > 0) {
    notes.push(
      `scripts/leak-check/sites.ts lacks ${missing.join(", ")}: add them so a run without a session checks them`,
    );
  }
  const marks: SiteMarks = { titles: new Set() };
  const referenced = new Set<string>();
  await pool(pages, 6, async (target) => {
    const page = await send({ host, target, headers: { ...modeHeaders.page, ...cookieHeader(cookie) } });
    if (page.status !== 200) return;
    const html = page.body.toString("utf8");
    for (const title of titlesOf(html)) marks.titles.add(title);
    for (const path of referencedPaths(html, input.hosts)) referenced.add(path);
  });
  const assets = [...referenced].filter((path) => !pages.includes(path)).slice(0, input.limit ?? 300);
  const paths: CheckPath[] = [
    ...pages.map((target) => ({ target, kind: "listed" as const, page: true })),
    ...assets.map((target) => ({ target, kind: "listed" as const, page: false })),
    ...probePaths().filter((probe) => !pages.includes(probe.target) && !assets.includes(probe.target)),
  ];
  if (sitemap.status === 200 && !paths.some((path) => path.target === "/sitemap.xml")) {
    paths.push({ target: "/sitemap.xml", kind: "listed", page: false });
  }
  return { paths, marks, findings, notes };
};

/** The paths a run without a session checks: the known pages and the probes. */
export const pathsWithoutSession = (pages: readonly string[]): CheckPath[] => [
  ...pages.map((target) => ({ target, kind: "listed" as const, page: true })),
  ...probePaths(),
];

/**
 * A gated host: each path is asked for without a session (as a page load and as a fetch), with the session, and
 * without one again, so a CDN that kept the session's answer would show it on the third. Also the gate's robots.txt,
 * and a page load with a session cookie that does not verify.
 */
export const checkGatedHost = async (input: {
  send: Send;
  host: string;
  paths: readonly CheckPath[];
  cookie: string | undefined;
  marks: SiteMarks;
  reference: { template?: string };
  concurrency?: number;
}): Promise<{ findings: Finding[]; requests: number }> => {
  const { send, host, cookie, marks, reference } = input;
  const findings: Finding[] = [];
  let requests = 0;
  const ask = async (target: string, mode: Mode, withCookie?: string) => {
    requests++;
    return send({ host, target, headers: { ...modeHeaders[mode], ...cookieHeader(withCookie) } });
  };
  const report = (target: string, step: string, problems: string[]) => {
    for (const problem of problems) findings.push({ host, target, step, problem });
  };
  const without = async (target: string, step: string) => {
    for (const mode of ["page", "fetch"] as const) {
      const exchange = await ask(target, mode);
      if (mode === "page" && reference.template === undefined && exchange.status === 401) {
        const parts = comingSoonParts(exchange.body.toString("utf8"));
        if (!("problem" in parts)) reference.template = parts.template;
      }
      report(
        target,
        `${step}, ${mode === "page" ? "page load" : "fetch"}`,
        withoutSessionProblems(exchange, mode, {
          host,
          target,
          reference: reference.template,
          marks,
        }),
      );
    }
  };

  // The root first, so the reference is a page load of "/", then everything else.
  const ordered = [...input.paths].sort((a, b) => (a.target === "/" ? -1 : b.target === "/" ? 1 : 0));
  const [first, ...rest] = ordered;
  const one = async (path: CheckPath) => {
    await without(path.target, "without a session");
    if (cookie) {
      const exchange = await ask(path.target, path.page ? "page" : "fetch", cookie);
      report(path.target, "with a session", withSessionProblems(exchange, path));
      await without(path.target, "without a session, after the session's request");
    }
  };
  if (first) await one(first);
  await pool(rest, input.concurrency ?? 6, one);

  const forged = await send({
    host,
    target: "/",
    headers: { ...modeHeaders.page, Cookie: `${sessionCookie}=${randomBytes(24).toString("base64url")}` },
  });
  requests++;
  report(
    "/",
    "with a session cookie that does not verify, page load",
    withoutSessionProblems(forged, "page", {
      host,
      target: "/",
      reference: reference.template,
      marks,
    }),
  );

  for (const withCookie of cookie ? [undefined, cookie] : [undefined]) {
    const robots = await ask("/robots.txt", "fetch", withCookie);
    const step = withCookie ? "with a session" : "without a session";
    if (robots.status !== 200 || robots.body.toString("utf8") !== gateRobots) {
      findings.push({
        host,
        target: "/robots.txt",
        step,
        problem: `is not the gate's robots.txt (${describe(robots)})`,
      });
    }
  }
  return { findings, requests };
};

/** A refused host (403 to everything) or `www` (to the apex), on the root and the site's first listed page. */
export const checkOtherHost = async (input: {
  send: Send;
  checked: CheckedHost;
  targets: readonly string[];
  cookie: string | undefined;
  marks: SiteMarks;
}): Promise<{ findings: Finding[]; requests: number }> => {
  const { send, checked, cookie, marks } = input;
  const findings: Finding[] = [];
  let requests = 0;
  for (const target of input.targets) {
    for (const mode of ["page", "fetch"] as const) {
      for (const withCookie of checked.role === "refused" && cookie ? [undefined, cookie] : [undefined]) {
        requests++;
        const exchange = await send({
          host: checked.host,
          target,
          headers: { ...modeHeaders[mode], ...cookieHeader(withCookie) },
        });
        const problems =
          checked.role === "refused"
            ? refusedHostProblems(exchange)
            : redirectHostProblems(exchange, checked.site.apex, target, marks);
        const step = `${withCookie ? "with a session" : "without a session"}, ${mode === "page" ? "page load" : "fetch"}`;
        for (const problem of problems) findings.push({ host: checked.host, target, step, problem });
      }
    }
  }
  return { findings, requests };
};
