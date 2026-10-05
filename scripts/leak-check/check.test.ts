import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  checkGatedHost,
  checkOtherHost,
  comingSoonParts,
  discover,
  expectedNext,
  gateRobots,
  pathsWithoutSession,
  referencedPaths,
  sitemapPages,
} from "./check.ts";
import { createSend } from "./http.ts";
import { hostsOf, parseTestHosts, sites } from "./sites.ts";

/**
 * A stand-in for reef's gate with the coming-soon page, small enough to read, and the ways a real one could go wrong:
 * each `faults` entry breaks one rule, and the check must report it.
 */
type Fault = "assets-open" | "cache-leak" | "page-varies" | "public-cache" | "host-open" | "redirect-carries";

const host = "site.test";
const page = (title: string, links: string) =>
  `<!doctype html><html><head><title>${title}</title><meta property="og:image" content="https://${host}/og/home.png"></head>` +
  `<body>${links}<script src="/_next/static/chunks/app.js"></script>` +
  `<script>self.__next_f.push([1,"\\"/_next/static/chunks/route.js\\""])</script></body></html>`;
const files: Record<string, { type: string; body: string }> = {
  "/": {
    type: "text/html",
    body: page("Site", '<a href="/a/">A</a><a href="#top">top</a><a href="/_door/signout">out</a>'),
  },
  "/a/": { type: "text/html", body: page("Site · A", '<a href="/">Home</a>') },
  "/_next/static/chunks/app.js": { type: "text/javascript", body: "console.log('app')" },
  "/_next/static/chunks/route.js": { type: "text/javascript", body: "console.log('route')" },
  "/og/home.png": { type: "image/png", body: "png" },
  "/404.html": { type: "text/html", body: page("Not found", "") },
  "/sitemap.xml": {
    type: "application/xml",
    body: `<urlset><url><loc>https://${host}/</loc></url><url><loc>https://${host}/a/</loc></url></urlset>`,
  },
};

const comingSoon = (next: string) =>
  `<!doctype html><html><head><title>Site is coming soon</title></head><body><h1>Site is coming soon.</h1>` +
  `<a class="button" href="/_door/signin?${new URLSearchParams({ next })}">Have an invitation? Sign in</a></body></html>`;

const startGate = (faults: Fault[]) => {
  const cached = new Map<string, string>();
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = request.url ?? "/";
    const path = url.split("?")[0] ?? "/";
    const base = { "X-Robots-Tag": "noindex, nofollow" };
    if (request.headers.host === `www.${host}`) {
      response.writeHead(301, { Location: `https://${host}${url}` });
      return response.end(faults.includes("redirect-carries") ? files["/"]?.body : undefined);
    }
    if (request.headers.host !== host) {
      if (faults.includes("host-open")) {
        response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": "text/html" });
        return response.end(files["/"]?.body);
      }
      response.writeHead(403, { "Cache-Control": "no-store" });
      return response.end();
    }
    if (path === "/robots.txt") {
      response.writeHead(200, { ...base, "Cache-Control": "no-store" });
      return response.end(gateRobots);
    }
    const session = (request.headers.cookie ?? "").includes("__Host-crv_door=good");
    const document =
      request.headers["sec-fetch-mode"] === "navigate" ||
      (!request.headers["sec-fetch-mode"] && String(request.headers.accept).includes("text/html"));
    if (session) {
      const file = files[path];
      const cacheControl = faults.includes("public-cache") ? "public, max-age=600" : "private, no-store";
      if (!file) {
        response.writeHead(404, { ...base, "Cache-Control": cacheControl, "Content-Type": "text/html" });
        return response.end(files["/404.html"]?.body);
      }
      if (faults.includes("cache-leak")) cached.set(url, file.body);
      response.writeHead(200, { ...base, "Cache-Control": cacheControl, "Content-Type": file.type });
      return response.end(file.body);
    }
    if (cached.has(url)) {
      response.writeHead(200, { ...base, "Content-Type": "text/html" });
      return response.end(cached.get(url));
    }
    if (faults.includes("assets-open") && path.startsWith("/_next/static/") && files[path]) {
      response.writeHead(200, { ...base, "Cache-Control": "private, no-store" });
      return response.end(files[path]?.body);
    }
    if (!document) {
      response.writeHead(401, { ...base, "Cache-Control": "no-store", "Content-Length": "0" });
      return response.end();
    }
    const body = comingSoon(expectedNext(url, host)).replace(
      "</body>",
      faults.includes("page-varies") ? `<p>${path}</p></body>` : "</body>",
    );
    response.writeHead(401, { ...base, "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8" });
    return response.end(body);
  });
};

const servers: Server[] = [];
const origin = async (faults: Fault[] = []) => {
  const server = startGate(faults);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};
afterAll(() => {
  for (const server of servers) server.close();
});

const run = async (faults: Fault[] = [], cookie: string | undefined = "good") => {
  const send = createSend(await origin(faults));
  const found = cookie
    ? await discover({ send, host, hosts: [host], cookie, fallback: ["/", "/a/"] })
    : { paths: pathsWithoutSession(["/", "/a/"]), marks: { titles: new Set<string>() }, findings: [], notes: [] };
  const result = await checkGatedHost({ send, host, paths: found.paths, cookie, marks: found.marks, reference: {} });
  return { ...result, found };
};

describe("the leak check against a gate", () => {
  let clean: Awaited<ReturnType<typeof run>>;
  beforeAll(async () => {
    clean = await run();
  });

  it("finds nothing wrong with a gate that keeps every rule, and asks for every page, asset and probe", () => {
    expect(clean.findings).toEqual([]);
    expect(clean.found.findings).toEqual([]);
    const targets = clean.found.paths.map((path) => path.target);
    expect(targets).toEqual(
      expect.arrayContaining([
        "/",
        "/a/",
        "/_next/static/chunks/app.js",
        "/_next/static/chunks/route.js",
        "/og/home.png",
        "/404.html",
        "/sitemap.xml",
        "/index.txt",
      ]),
    );
    expect(targets.some((target) => target.startsWith("/_door"))).toBe(false);
    // Per path: page load and fetch without, one with, page load and fetch without again; then a forged cookie and
    // robots.txt twice.
    expect(clean.requests).toBe(clean.found.paths.length * 5 + 3);
  });

  it("checks without a session alone when there is none to mint", async () => {
    const result = await run([], undefined);
    expect(result.findings).toEqual([]);
  });

  it("reports an asset served without a session", async () => {
    const { findings } = await run(["assets-open"]);
    expect(findings.map((f) => `${f.target} ${f.step}`)).toContain(
      "/_next/static/chunks/app.js without a session, fetch",
    );
  });

  it("reports a page a cache kept from the session's request", async () => {
    const { findings } = await run(["cache-leak"]);
    const leaked = findings.filter((f) => f.step.startsWith("without a session, after the session's request"));
    expect(leaked.map((f) => f.target)).toContain("/a/");
    expect(leaked.some((f) => f.problem === "carries one of the site's own pages")).toBe(true);
  });

  it("reports a coming-soon page that differs by more than its sign-in link", async () => {
    const { findings } = await run(["page-varies"]);
    expect(findings.some((f) => f.problem === "differs from the coming-soon page by more than its sign-in link")).toBe(
      true,
    );
  });

  it("reports a gated answer a shared cache could keep", async () => {
    const { findings } = await run(["public-cache"]);
    expect(findings.some((f) => f.step === "with a session" && /lets a shared cache keep it/.test(f.problem))).toBe(
      true,
    );
  });

  it("expects 403 from a refused host, with or without the session, and a bare redirect from www", async () => {
    const site = { ...sites[0], apex: host } as (typeof sites)[number];
    const marks = clean.found.marks;
    const good = createSend(await origin());
    const refused = { site, host: "main.app.amplifyapp.com", role: "refused" as const };
    const www = { site, host: `www.${host}`, role: "redirect" as const };
    expect(
      (await checkOtherHost({ send: good, checked: refused, targets: ["/"], cookie: "good", marks })).findings,
    ).toEqual([]);
    expect(
      (await checkOtherHost({ send: good, checked: www, targets: ["/", "/a/"], cookie: "good", marks })).findings,
    ).toEqual([]);
    const bad = createSend(await origin(["host-open", "redirect-carries"]));
    const open = await checkOtherHost({ send: bad, checked: refused, targets: ["/"], cookie: "good", marks });
    expect(open.findings.map((f) => f.problem)).toContain(
      `answered 200 with ${files["/"]?.body.length} bytes where a refused host gets 403`,
    );
    const carried = await checkOtherHost({ send: bad, checked: www, targets: ["/"], cookie: undefined, marks });
    expect(carried.findings.length).toBeGreaterThan(0);
  });
});

describe("the check's parts", () => {
  it("expects the gate's canonical next in the sign-in link", () => {
    expect(expectedNext("/pricing/?plan=team", host)).toBe("/pricing/?plan=team");
    expect(expectedNext("/a/#x", host)).toBe("/a/");
    expect(expectedNext("//evil.com", host)).toBe("/");
    expect(expectedNext("/\\evil.com", host)).toBe("/");
    expect(expectedNext("/\t/evil.com", host)).toBe("/");
    expect(expectedNext("/.//evil.com", host)).toBe("/");
    expect(expectedNext(`/${"a".repeat(600)}`, host)).toBe("/");
    expect(expectedNext("/%2F%2Fevil.com", host)).toBe("/%2F%2Fevil.com");
  });

  it("splits the coming-soon page into its fixed bytes and its next", () => {
    const one = comingSoonParts(comingSoon("/a/?b=1&c=2"));
    const two = comingSoonParts(comingSoon("/"));
    expect(one).toEqual({ template: expect.any(String), next: "/a/?b=1&c=2" });
    expect("template" in one && "template" in two && one.template === two.template).toBe(true);
    expect(comingSoonParts("<p>no link</p>")).toEqual({
      problem: "has 0 sign-in links where the coming-soon page has one",
    });
  });

  it("reads a sitemap's pages and a page's same-origin references", () => {
    expect(sitemapPages(files["/sitemap.xml"]?.body ?? "")).toEqual(["/", "/a/"]);
    const refs = referencedPaths(
      `<a href="/x/#y"></a><a href="//cdn.test/z"></a><a href="https://other.test/q"></a><img srcset="/s1.png 1x, /s2.png 2x">` +
        `<a href="/_door/signout?then=door"></a><a href="https://${host}/p/?q=1&amp;r=2"></a>`,
      [host],
    );
    expect(refs).toEqual(["/x/", "/p/?q=1&r=2", "/s1.png", "/s2.png"]);
  });

  it("knows each site's hosts and reads test hosts in the backend's format", () => {
    const [driftline] = sites.filter((site) => site.id === "driftline");
    if (!driftline) throw new Error("no driftline");
    const tests = parseTestHosts("driftline:main.tmp1.amplifyapp.com, streamlane:main.tmp2.amplifyapp.com");
    expect(hostsOf(driftline, tests).map((checked) => `${checked.host} ${checked.role}`)).toEqual([
      "driftline.app gated",
      "www.driftline.app redirect",
      "main.d39wmoekppxvpd.amplifyapp.com refused",
      "main.tmp1.amplifyapp.com gated",
    ]);
    expect(() => parseTestHosts("markset:markset.org")).toThrow(/<site>:<host>/);
    expect(() => parseTestHosts("driftline:bad host")).toThrow(/<site>:<host>/);
    expect(parseTestHosts(undefined)).toEqual([]);
  });

  it("lists each site's known pages once, as paths on the site", () => {
    for (const site of sites) {
      expect(site.pages[0]).toBe("/");
      expect(site.pages.every((page) => page.startsWith("/") && page.endsWith("/"))).toBe(true);
      expect(new Set(site.pages).size).toBe(site.pages.length);
    }
  });
});
