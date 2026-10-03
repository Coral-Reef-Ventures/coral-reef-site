/**
 * Static site generator for the Coral Reef Ventures website. The page is a
 * Markset document, rendered by the Markset reference implementation, and
 * wrapped in a shell that carries the header, footer and metadata.
 *
 * Output: dist/ with relative links, so it works at any base path (a GitHub
 * Pages project site lives under /<repo>/) as well as on a custom domain.
 *
 *   npm run site
 */
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseDocument } from "@markset-lang/parser";
import { addHeadingIds, bodyAttributes, defaultStylesheetPath, renderHtml } from "@markset-lang/render-html";
import { productGrid } from "./products.ts";

const root = resolve(import.meta.dirname, "..");

/**
 * The canonical URL comes from package.json's homepage, so there is one place
 * to change it when the hosting destination is approved.
 */
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { homepage: string };
export const CANONICAL = new URL(pkg.homepage).href;

/**
 * Search and share metadata (CRV-008). The title is the v0.1 review's, the
 * description is the hero's lead, and nothing here names an image: there is no
 * approved brand asset yet, so the social card is the text-only summary.
 */
export const META = {
  siteName: "Coral Reef Ventures",
  title: "Coral Reef Ventures — Documents. Product. Work.",
  description: "Open foundations and focused tools for creating software with humans and AI working together.",
};

/** The footer's copy, from site-copy.md. */
const FOOTER = {
  statement: "Open foundations and focused products for software teams.",
  copyright: "© 2026 Coral Reef Ventures",
};

/** Header navigation: the two sections the copy names, as in-page anchors. */
const NAV: Array<[string, string]> = [
  ["Our work", "#work"],
  ["Our approach", "#approach"],
];

/**
 * Build into outDir. The tree is written to a staging directory unique to this
 * build and renamed into place, so a reader (or the watch server) never sees a
 * half-written site and a failed build leaves the previous one intact.
 */
export async function build(outDir: string = join(root, "dist")): Promise<string[]> {
  const tag = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const staging = `${outDir}.staging-${tag}`;
  const previous = `${outDir}.previous-${tag}`;
  try {
    const written = await writeSite(staging);
    const hadPrevious = await rename(outDir, previous).then(
      () => true,
      () => false, // absent on a first build
    );
    try {
      await rename(staging, outDir);
    } catch (error) {
      // Put the previous build back rather than let the cleanup below delete it.
      if (hadPrevious) await rename(previous, outDir);
      throw error;
    }
    return written;
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(previous, { recursive: true, force: true });
  }
}

async function writeSite(out: string): Promise<string[]> {
  await mkdir(join(out, "css"), { recursive: true });
  await cp(defaultStylesheetPath, join(out, "css", "markset.css"));
  await cp(join(root, "site", "site.css"), join(out, "css", "site.css"));
  await writeFile(join(out, "index.html"), await homePage());
  return ["index.html", "css/markset.css", "css/site.css"];
}

/** The home page: site/content/index.md with the product cards substituted in, rendered and wrapped. */
export async function homePage(): Promise<string> {
  const file = join(root, "site", "content", "index.md");
  const source = (await readFile(file, "utf8")).replaceAll("{{products}}", productGrid());
  const leftover = source.match(/\{\{\w+\}\}/);
  if (leftover) throw new Error(`${relative(root, file)}: unsubstituted token ${leftover[0]}`);

  const { ast, diagnostics } = parseDocument(source);
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length) throw new Error(`${relative(root, file)}: ${errors.map((d) => d.code).join(", ")}`);

  return shell({
    body: renderHtml(addHeadingIds(ast)),
    bodyAttributes: bodyAttributes(ast.frontmatter ?? null),
  });
}

function shell(page: { body: string; bodyAttributes: string }): string {
  const nav = NAV.map(([label, href]) => `<a href="${href}">${esc(label)}</a>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(META.title)}</title>
<meta name="description" content="${esc(META.description)}">
<link rel="canonical" href="${esc(CANONICAL)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(META.siteName)}">
<meta property="og:title" content="${esc(META.title)}">
<meta property="og:description" content="${esc(META.description)}">
<meta property="og:url" content="${esc(CANONICAL)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(META.title)}">
<meta name="twitter:description" content="${esc(META.description)}">
<link rel="stylesheet" href="css/markset.css">
<link rel="stylesheet" href="css/site.css">
</head>
<body${page.bodyAttributes}>
<a class="site-skip" href="#main">Skip to content</a>
<header class="site-header">
<a class="site-brand" href="./">${esc(META.siteName)}</a>
<nav class="site-nav" aria-label="Main">
${nav}
</nav>
</header>
<main id="main" class="ms-document" tabindex="-1">
${page.body}</main>
<footer class="site-footer">
<p><strong>${esc(META.siteName)}</strong><br>${esc(FOOTER.statement)}</p>
<p>${esc(FOOTER.copyright)}</p>
</footer>
</body>
</html>
`;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const target = join(root, "dist");
  const written = await build(target);
  console.log(`site: ${written.length} files written to ${relative(process.cwd(), target)}/`);
}
