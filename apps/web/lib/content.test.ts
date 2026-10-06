import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { segments } from "./markset.ts";
import { doorProducts } from "./products.ts";

const text = (file: string, slots: string[] = []) =>
  segments(file, slots)
    .map((s) => ("html" in s ? s.html : `[[${s.slot}]]`))
    .join("\n");

const h1s = (html: string) => html.match(/<h1\b/g)?.length ?? 0;

describe("the door's content", () => {
  const door = text("door.md");

  it("parses as Markset with no error, with one h1 and neither the form nor the sign-in", () => {
    expect(h1s(door)).toBe(1);
    for (const gone of ["Get involved", "Have an invitation?", 'id="involved"', 'id="invited"', "[[interest-form]]"]) {
      expect(door, gone).not.toContain(gone);
    }
  });

  it("carries the approved copy in the approved order", () => {
    const order = [
      "Building for software teams in the agentic era.",
      "Four ideas. One direction.",
      "Markset",
      "Intentset",
      "Streamlane",
      "Driftline",
      "These offerings share a direction, not an adoption requirement.",
      "Better foundations for what comes next.",
      "hello@coralreefventures.com",
    ];
    let at = 0;
    for (const phrase of order) {
      const found = door.indexOf(phrase, at);
      expect(found, phrase).toBeGreaterThan(-1);
      at = found;
    }
  });

  it("links a visitor to Markset and Intentset only, and reads 'Open to invited guests' for the two behind the door", () => {
    expect(door).toContain("https://markset.org");
    expect(door).toContain("https://intentset.org");
    expect(door).not.toContain("https://driftline.app");
    expect(door).not.toContain("streamlane.app");
    expect(door.match(/Open to invited guests\./g)).toHaveLength(2);
    expect(doorProducts.filter((p) => p.cta).map((p) => p.slug)).toEqual(["markset", "intentset"]);
  });

  it("refuses a slot it was not given", () => {
    expect(() => segments("get-involved.md", ["interest-form"])).toThrow(/unknown slot/);
  });
});

describe("the Get involved page", () => {
  const page = text("get-involved.md", ["interest-form", "sign-in"]);

  it("has one h1, Get involved, and puts the form and then the sign-in where the copy says", () => {
    expect(h1s(page)).toBe(1);
    expect(page).toMatch(/<h1 id="involved">Get involved<\/h1>/);
    expect(page).toMatch(/<h2 id="invited">Have an invitation\?<\/h2>/);
    expect(page.indexOf("Get involved")).toBeLessThan(page.indexOf("[[interest-form]]"));
    expect(page.indexOf("[[interest-form]]")).toBeLessThan(page.indexOf("Have an invitation?"));
    expect(page.indexOf("Have an invitation?")).toBeLessThan(page.indexOf("[[sign-in]]"));
  });
});

describe("the privacy page", () => {
  const privacy = text("privacy.md");

  // The retention periods (plan §2.3a). amplify/areas/retention.test.ts ties each sentence to its constant.
  it.each(["12 months", "90 days", "24 hours", "10 minutes", "1 month", "35 days", "within a few days"])(
    "states %s",
    (period) => {
      expect(privacy).toContain(period);
    },
  );

  it("says what is stored, the browser's part, erasure and the one contact address", () => {
    for (const phrase of [
      "What the interest form stores",
      "What the invitation sign-in stores",
      "What your browser keeps",
      "erase",
      "hello@coralreefventures.com",
    ]) {
      expect(privacy, phrase).toContain(phrase);
    }
  });
});

describe("copy-approvals.md, the record of what Gary approved", () => {
  const root = join(import.meta.dirname, "..", "..", "..");
  const log = readFileSync(join(root, "docs", "requirements", "copy-approvals.md"), "utf8");
  const files = readdirSync(join(root, "apps", "web", "content")).filter((f) => f.endsWith(".md"));

  // Copy is approved text: every content file has an entry, which says approved (with a date) or proposed.
  it.each(files)("has an entry for %s", (file) => {
    const entry = log.split(/^## /m).find((section) => section.includes(`apps/web/content/${file}`));
    expect(entry, file).toBeDefined();
    expect(entry).toMatch(/\((approved|proposed) \d{4}-\d{2}-\d{2}\)/);
  });
});

describe("a production build", () => {
  const out = join(import.meta.dirname, "..", "out");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });

  // Present after `pnpm web:build`. The stub backend answers by what a visitor types, so it must not reach a reader.
  it.skipIf(!existsSync(out))("holds no trace of the stub backend", () => {
    for (const file of walk(out).filter((f) => f.endsWith(".js"))) {
      expect(readFileSync(file, "utf8"), file).not.toContain("stubbed outage");
    }
  });
});
