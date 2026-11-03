import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@markset-lang/parser";
import { addHeadingIds, renderHtml } from "@markset-lang/render-html";

import { articleList, articleOf, dateline } from "./articles.ts";
import { doorProductGrid } from "./products.ts";

/** A rendered stretch of the document, or the name of a place a component goes. */
export type Segment = { html: string } | { slot: string };

// The bundler gives a server module no file of its own, so the content is found from where the build runs: the app's
// own directory under `next build`, or the repository root under the tests.
const contentDir = existsSync(join(process.cwd(), "content"))
  ? join(process.cwd(), "content")
  : join(process.cwd(), "apps", "web", "content");

const render = (source: string, file: string): string => {
  const { ast, diagnostics } = parseDocument(source);
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) throw new Error(`${file}: ${errors.map((d) => d.code).join(", ")}`);
  return renderHtml(addHeadingIds(ast));
};

/** Markset source the build writes itself, such as the end of an article (`articleEnd`), as HTML. */
export const renderSource = (source: string, name: string): string =>
  render(`---\nmarkset: 0\n---\n\n${source}\n`, name);

/** An article's `{{dateline}}`, from the one article table and the file's own length; anything else has none. */
const withDateline = (source: string, file: string): string => {
  if (!source.includes("{{dateline}}")) return source;
  const article = articleOf(file);
  if (article === undefined) throw new Error(`${file}: {{dateline}} outside an article`);
  return source.replaceAll("{{dateline}}", dateline(article, source));
};

/**
 * A content file as Markset, cut at each `{{slot}}` line into the HTML around it and the slot's name, so a page puts
 * its React components exactly where the document says. `{{products}}` is not a slot: it is the product cards, which
 * are Markset source generated from the one product table, and `{{articles}}` is the articles index's list, from the one
 * article table, and `{{dateline}}` is an article's line above its title. Anything else left over is a mistake and fails
 * the build.
 */
export const segments = (file: string, slots: readonly string[] = []): Segment[] => {
  const source = withDateline(readFileSync(join(contentDir, file), "utf8"), file)
    .replaceAll("{{products}}", doorProductGrid())
    .replaceAll("{{articles}}", articleList());
  const out: Segment[] = [];
  let chunk: string[] = [];
  const flush = (first: boolean) => {
    const text = chunk.join("\n").trim();
    chunk = [];
    if (text === "") return;
    // Only the first stretch carries the frontmatter, and a later one is a document of its own.
    out.push({ html: render(first ? `${text}\n` : `---\nmarkset: 0\n---\n\n${text}\n`, file) });
  };
  let first = true;
  for (const line of source.split("\n")) {
    const slot = /^\{\{([\w-]+)\}\}\s*$/.exec(line);
    if (slot?.[1] === undefined) {
      chunk.push(line);
      continue;
    }
    if (!slots.includes(slot[1])) throw new Error(`${file}: unknown slot {{${slot[1]}}}`);
    flush(first);
    first = false;
    out.push({ slot: slot[1] });
  }
  flush(first);
  for (const segment of out) {
    const leftover = "html" in segment ? segment.html.match(/\{\{[\w-]+\}\}/) : null;
    if (leftover) throw new Error(`${file}: unsubstituted token ${leftover[0]}`);
  }
  return out;
};
