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
  // The pattern all four sites share (Streamlane's): the name, a middle dot, and
  // what it is. The words are the v0.1 review's; only the separator changed.
  title: "Coral Reef Ventures · Documents. Intent. Work. Usage.",
  description: "Open foundations and focused tools for creating software with humans and AI working together.",
};

/** The footer's copy, from site-copy.md. */
const FOOTER = {
  statement: "Open foundations and focused products for software teams.",
  copyright: "© 2026 Coral Reef Ventures",
};

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
  await cp(join(root, "site", "icon.svg"), join(out, "icon.svg"));
  await writeFile(join(out, "index.html"), await homePage());
  return ["index.html", "css/markset.css", "css/site.css", "icon.svg"];
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
<link rel="icon" type="image/svg+xml" href="icon.svg">
<link rel="stylesheet" href="css/site.css">
</head>
<body${page.bodyAttributes}>
${SCHEME_SCRIPT}<a class="site-skip" href="#main">Skip to content</a>
<header class="site-header">
<a class="site-brand" href="./"><img class="site-mark" src="icon.svg" alt="" width="28" height="28">${esc(META.siteName)}</a>
${SCHEME_CONTROL}</header>
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

/**
 * The reader's color scheme, the same control markset.org and intentset.org
 * have: three radio inputs, read by body:has() in site.css, with markset.css
 * resolving every color from color-scheme. Auto is checked, so a reader who
 * never touches it keeps their system preference. Each option is an icon with
 * its word kept in the accessibility tree.
 */
const ICON_AUTO = `<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none"/></svg>`;
const ICON_LIGHT = `<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>`;
const ICON_DARK = `<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z"/></svg>`;

export const SCHEME_CONTROL = `<div class="site-scheme" role="group" aria-label="Color scheme">
<input type="radio" name="ms-scheme" id="ms-scheme-auto" class="site-scheme-input" checked>
<label class="site-scheme-option" for="ms-scheme-auto" title="Match the system">${ICON_AUTO}<span class="site-visually-hidden">Auto</span></label>
<input type="radio" name="ms-scheme" id="ms-scheme-light" class="site-scheme-input">
<label class="site-scheme-option" for="ms-scheme-light" title="Light">${ICON_LIGHT}<span class="site-visually-hidden">Light</span></label>
<input type="radio" name="ms-scheme" id="ms-scheme-dark" class="site-scheme-input">
<label class="site-scheme-option" for="ms-scheme-dark" title="Dark">${ICON_DARK}<span class="site-visually-hidden">Dark</span></label>
</div>
`;

/**
 * The page's one script, and all it does is remember the reader's scheme
 * choice across a reload, which no CSS can do. It is not tracking (CRV-007): it
 * stores one word in the reader's own browser and sends nothing anywhere. With
 * scripting off the control still works for the visit. It writes data-scheme on
 * <body>, the hook markset.css publishes, and runs first so the scheme is in
 * force before anything paints.
 */
export const SCHEME_SCRIPT = `<script>
(function () {
  var key = "ms-scheme";
  var read = function () {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };
  var apply = function (value) {
    if (value === "light" || value === "dark") document.body.dataset.scheme = value;
    else delete document.body.dataset.scheme;
  };
  apply(read());
  document.addEventListener("change", function (event) {
    var input = event.target;
    if (!input || input.name !== key) return;
    var value = input.id.slice(key.length + 1);
    apply(value);
    try {
      if (value === "auto") localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {}
  });
  document.addEventListener("DOMContentLoaded", function () {
    var value = read();
    var input = document.getElementById(key + "-" + (value === "light" || value === "dark" ? value : "auto"));
    if (input) input.checked = true;
  });
})();
</script>
`;

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const target = join(root, "dist");
  const written = await build(target);
  console.log(`site: ${written.length} files written to ${relative(process.cwd(), target)}/`);
}
