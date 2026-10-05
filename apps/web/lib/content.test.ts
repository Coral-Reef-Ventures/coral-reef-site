import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { segments } from "./markset.ts";
import { doorProducts } from "./products.ts";

const text = (file: string, slots: string[] = []) =>
  segments(file, slots)
    .map((s) => ("html" in s ? s.html : `[[${s.slot}]]`))
    .join("\n");

describe("the door's content", () => {
  const door = text("door.md", ["interest-form", "sign-in"]);

  it("parses as Markset with no error and puts the form and the sign-in where the copy says", () => {
    expect(door.indexOf("Get involved")).toBeLessThan(door.indexOf("[[interest-form]]"));
    expect(door.indexOf("[[interest-form]]")).toBeLessThan(door.indexOf("Have an invitation?"));
    expect(door.indexOf("Have an invitation?")).toBeLessThan(door.indexOf("[[sign-in]]"));
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
    expect(() => segments("door.md", [])).toThrow(/unknown slot/);
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

describe("site-copy.md, the source of the door's words", () => {
  const root = join(import.meta.dirname, "..", "..", "..");
  const copy = readFileSync(join(root, "docs", "requirements", "site-copy.md"), "utf8");
  const blocks = new Map(
    [...copy.matchAll(/^```markdown file=(\S+)\n([\s\S]*?)\n```$/gm)].map((m) => [m[1], `${m[2]}\n`] as const),
  );

  it("holds a block for each content file, and no other", () => {
    expect([...blocks.keys()].sort()).toEqual(["apps/web/content/door.md", "apps/web/content/privacy.md"]);
  });

  // Copy is approved text: a content file is its block in site-copy.md, changed there first, in the same commit.
  it.each(["apps/web/content/door.md", "apps/web/content/privacy.md"])("%s is its block, verbatim", (file) => {
    expect(readFileSync(join(root, file), "utf8")).toBe(blocks.get(file));
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
