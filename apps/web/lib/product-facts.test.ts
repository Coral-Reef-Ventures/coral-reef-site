import { describe, expect, it } from "vitest";

import { PRODUCTS, type Product, productGrid } from "./product-facts.ts";

const base: Product = {
  slug: "intentset",
  name: "Intentset",
  area: "Product",
  tagline: "t",
  description: "d",
  label: "l",
};

describe("product facts", () => {
  it("builds no link for a product without a confirmed destination", () => {
    expect(productGrid([base])).not.toMatch(/\]\(/);
  });

  it("renders a planned destination as text, never a link", () => {
    const source = productGrid([{ ...base, plannedDestination: "planned.example" }]);
    expect(source).toMatch(/\[planned\.example\]\{\.planned\}/);
    expect(source).not.toMatch(/\]\(/);
  });

  it.each(["", "../intentset/index.html", "http://intentset.org", "javascript:alert(1)"])(
    "refuses %j as a call to action: it must be an absolute https URL",
    (href) => {
      expect(() => productGrid([{ ...base, cta: { text: "Visit Intentset", href } }])).toThrow();
    },
  );

  // CRV-015: a roadmap's link is a page here, read from a team in the product; nothing else builds.
  it.each([
    { page: "streamlane/roadmap", team: "https://crv.streamlane.app/teams/SL" },
    { page: "https://streamlane.app/roadmap/", team: "https://crv.streamlane.app/teams/SL" },
    { page: "/streamlane/roadmap/", team: "http://crv.streamlane.app/teams/SL" },
    { page: "/streamlane/roadmap/", team: "https://crv.streamlane.app/SL-1" },
  ])("refuses a roadmap at $page read from $team", (roadmap) => {
    expect(() => productGrid([{ ...base, roadmap: { text: "See the roadmap", ...roadmap } }])).toThrow();
  });

  it("lists the products in the approved order, each with a distinct accent", () => {
    expect(PRODUCTS.map((p) => p.name)).toEqual(["Markset", "Intentset", "Streamlane", "Driftline"]);
    expect(new Set(PRODUCTS.map((p) => p.slug)).size).toBe(4);
  });
});
