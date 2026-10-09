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

  // The order of the 2026-10-06 rewrite: the outcome, the problem, the four introduced on their cards before anything
  // shows how they fit, the direction, the whitepaper, the origin story and the contact.
  it("carries the copy in its order", () => {
    const order = [
      "Keep control as agents build your software",
      "Agents change the code. Your team still answers for the product",
      "Two open foundations. Two products",
      "Markset",
      "Intentset",
      "Streamlane",
      "Driftline",
      "Where each one fits, from intent to outcomes",
      "None of the four requires another",
      "Keeping product intent connected in agentic software development",
      "Why we started Coral Reef Ventures",
      "Talk to us",
      "hello@coralreefventures.com",
    ];
    let at = 0;
    for (const phrase of order) {
      const found = door.indexOf(phrase, at);
      expect(found, phrase).toBeGreaterThan(-1);
      at = found;
    }
  });

  // Markset and Intentset are open foundations, not products (Gary, 2026-10-06): only Streamlane and Driftline are.
  it("never calls the four products", () => {
    expect(door).not.toMatch(/\b(four|the) products\b/i);
    expect(door).toContain("Markset and Intentset are open foundations");
  });

  // The page says what each one is and where it fits, not how early it is (Gary, 2026-10-06).
  it("does not hedge the narrative with how early it is", () => {
    for (const hedge of ["building toward", "still building", "not how", "available yet", "available today"]) {
      expect(door, hedge).not.toContain(hedge);
    }
  });

  // The whitepaper is one page, kept once: no PDF beside it to maintain twice (Gary, 2026-10-06).
  it("offers the whitepaper as its page, ungated, and nowhere as a PDF", () => {
    expect(door).toContain('href="/whitepaper/"');
    expect(door).not.toMatch(/\.pdf\b/);
    expect(text("whitepaper.md")).not.toMatch(/\.pdf\b/);
    expect(readdirSync(join(import.meta.dirname, "..", "public")).filter((f) => f.endsWith(".pdf"))).toEqual([]);
  });

  // A reader reaches each action in its context, not as a row at the top to skip to (Gary, 2026-10-06).
  it("offers each explicit action in its own section, and none in the hero", () => {
    const hero = door.slice(0, door.indexOf("<hr"));
    expect(hero).not.toContain('class="actions"');
    const section = (heading: string) => door.slice(door.indexOf(heading), door.indexOf("<hr", door.indexOf(heading)));
    expect(section("Keeping product intent connected")).toContain("Read the whitepaper");
    expect(section("Talk to us")).toContain("Take part");
    expect(door).toContain('href="/whitepaper/"');
    expect(door.match(/href="\/get-involved\/"/g)?.length).toBe(2);
  });

  // The door makes the case and does not demonstrate it: the worked example and the internal pilot both came off on
  // 2026-10-08. What each product is stays on its card, and the evidence lives where its context does, in the
  // whitepaper and in Intentset's adoption log.
  it("claims no adoption evidence, review or conformance, and carries no worked example", () => {
    expect(door).not.toMatch(/\bverified by\b|\bconform/i);
    expect(door).not.toMatch(/\bpilot\b|\bcustomer evidence\b/i);
    expect(door).not.toMatch(/\bIllustrative\b|Schedule an assessment/);
  });

  // The origin story is the company's voice and carries no byline (2026-10-08): the first and last
  // sentences pin both ends, and no name appears on the page.
  it("keeps the origin story word for word, unsigned", () => {
    expect(door).toContain(
      "Keeping track of what a software product does has always been a challenge, and the past two years of agentic development have magnified it.",
    );
    expect(door).toContain(
      "The aim is to help teams retain a coherent understanding of their products as agents take on more of the work.",
    );
    expect(door).not.toContain("Gary");
    expect(door).not.toMatch(/\bI’ve\b|\bMy aim\b/);
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

// Eddy is in planning (2026-10-09): the door asks whether the loop starts at intent, under the lifecycle, and /eddy/
// answers with the loop one step earlier. Eddy has no card, mark, accent or domain yet, so neither page links out for it.
describe("the step before intent", () => {
  const door = text("door.md");
  const eddy = text("eddy.md");

  it("asks the question on the door, directly after the independence note, and links to /eddy/", () => {
    const note = door.indexOf("None of the four requires another");
    const question = door.indexOf("Does the loop really start at intent?");
    expect(question).toBeGreaterThan(note);
    expect(question).toBeLessThan(door.indexOf("Keeping product intent connected in agentic software development"));
    expect(door.match(/href="\/eddy\/"/g)).toHaveLength(1);
  });

  it("leaves the door's four cards as they are", () => {
    expect(door).not.toMatch(/class="[^"]*\beddy\b/);
    expect(doorProducts.map((p) => p.slug)).not.toContain("eddy");
  });

  it("has one h1 and shows the loop as six steps, Capture first, then the door's five", () => {
    expect(h1s(eddy)).toBe(1);
    const order = ["Capture.", "Intent.", "Execution.", "Verification.", "Release.", "Feedback."];
    let at = 0;
    for (const step of order) {
      const found = eddy.indexOf(`<strong>${step}</strong>`, at);
      expect(found, step).toBeGreaterThan(-1);
      at = found;
    }
  });

  it("says Eddy is in planning, keeps it independent, and claims no price, date, domain or release", () => {
    expect(eddy).toContain("Eddy is in planning");
    expect(eddy).toContain("planned to stand on its own");
    expect(eddy).not.toMatch(/\$\d|\bper month\b|\bavailable now\b|\bbeta\b|\b20\d\d\b/i);
    expect(eddy).not.toMatch(/https?:\/\/(?!markset\.org|intentset\.org)/);
    expect(eddy).toContain('href="/get-involved/"');
    expect(eddy).toContain("hello@coralreefventures.com");
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
