/**
 * The built page against the requirements in docs/requirements/. Builds into a
 * temporary directory so the suite never races dist/ against site:watch.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { build, CANONICAL, META } from "../site/build.ts";
import { PRODUCTS } from "../site/products.ts";

let dir: string;
let html: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "crv-site-"));
  await build(join(dir, "dist"));
  html = await readFile(join(dir, "dist", "index.html"), "utf8");
});
after(() => rm(dir, { recursive: true, force: true }));

const text = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

test("CRV-001: every section of the copy is present, in reading order", () => {
  const order = [
    "Coral Reef Ventures",
    "Our work",
    "Our approach",
    "Documents · Product · Work",
    "Building for software teams in the agentic era.",
    "Open foundations and focused tools for creating software with humans and AI working together.",
    "Explore our work",
    "Three ideas. One direction.",
    "AI is changing how software gets built.",
    "Coral Reef Ventures develops open foundations and practical products for that new way of working.",
    "Markset",
    "Intentset",
    "Streamlane",
    "These offerings share a direction, not an adoption requirement.",
    "Better foundations for what comes next.",
    "We are building tools that make software work easier to understand, maintain, and share as the way we build it changes.",
    "Open foundations and focused products for software teams.",
    "© 2026 Coral Reef Ventures",
  ];
  const body = text(html.slice(html.indexOf("<body")));
  let at = 0;
  for (const phrase of order) {
    const found = body.indexOf(phrase, at);
    assert.ok(found !== -1, `missing or out of order: ${phrase}`);
    at = found + phrase.length;
  }
});

test("CRV-006: headings descend one level at a time, with one h1", () => {
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  assert.deepEqual(levels, [1, 2, 3, 3, 3, 2]);
});

test("CRV-002: each product has its own name, tagline, description and label", () => {
  for (const p of PRODUCTS) {
    for (const value of [p.name, p.tagline, p.description, p.label]) {
      assert.ok(text(html).includes(value), `${p.name}: missing ${value}`);
    }
    assert.match(html, new RegExp(`class="ms-grid-item product ${p.slug}"`));
  }
});

test("CRV-003: only confirmed destinations are links", () => {
  const external = [...html.matchAll(/href="(https?:[^"]+)"/g)].map((m) => m[1]);
  // The canonical and og:url are the page itself, not outbound links.
  const outbound = external.filter((href) => href !== CANONICAL);
  assert.deepEqual(outbound, ["https://markset.org"]);
  assert.doesNotMatch(html, /Explore Intentset/);
  assert.doesNotMatch(html, /href="[^"]*streamlane/i);
  assert.match(text(html), /Not publicly available yet\./);
  assert.match(text(html), /streamlane\.app/);
});

test("CRV-004: the page says the products need not be adopted together", () => {
  assert.match(text(html), /share a direction, not an adoption requirement/);
});

test("CRV-006: skip link and in-page anchors resolve to ids on the page", () => {
  assert.match(html, /<a class="site-skip" href="#main">Skip to content<\/a>/);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, target] of html.matchAll(/href="#([^"]*)"/g)) {
    assert.ok(ids.has(target), `#${target} has no target`);
  }
  assert.match(html, /<nav class="site-nav" aria-label="Main">/);
});

test("CRV-007: no script, no form, nothing loaded from another origin", async () => {
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<form/i);
  for (const [tag, href] of html.matchAll(/<link [^>]*href="([^"]+)"/g)) {
    if (tag.includes('rel="canonical"')) continue;
    assert.ok(!href.includes(":") && !href.startsWith("//"), `external resource: ${href}`);
  }
  for (const css of ["site.css", "markset.css"]) {
    const source = await readFile(join(dir, "dist", "css", css), "utf8");
    assert.doesNotMatch(source, /@import|@font-face|url\(["']?(https?:)?\/\//, css);
  }
});

test("CRV-008: title, description, canonical and social metadata", () => {
  assert.match(html, new RegExp(`<title>${META.title}</title>`));
  assert.match(html, new RegExp(`<meta name="description" content="${META.description}">`));
  assert.match(html, new RegExp(`<link rel="canonical" href="${CANONICAL}">`));
  for (const property of ["og:type", "og:site_name", "og:title", "og:description", "og:url"]) {
    assert.match(html, new RegExp(`<meta property="${property}" content="[^"]+">`));
  }
  assert.match(html, /<meta name="twitter:card" content="summary">/);
  // No approved brand asset exists yet, so nothing may name an image.
  assert.doesNotMatch(html, /og:image|twitter:image|rel="icon"/);
});

test("the build leaves no placeholder behind", () => {
  assert.doesNotMatch(html, /\{\{\w+\}\}/);
  assert.doesNotMatch(html, /example\.(com|org)|lorem|TODO/i);
});
