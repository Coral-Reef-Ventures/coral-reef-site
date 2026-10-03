import assert from "node:assert/strict";
import { test } from "node:test";
import { type Product, PRODUCTS, productGrid } from "../site/products.ts";

const base: Product = {
  slug: "intentset",
  name: "Intentset",
  area: "Product",
  tagline: "t",
  description: "d",
  label: "l",
};

test("a product without a confirmed destination produces no link", () => {
  assert.doesNotMatch(productGrid([base]), /\]\(/);
});

test("a planned destination is text, never a link", () => {
  const source = productGrid([{ ...base, plannedDestination: "planned.example" }]);
  assert.match(source, /\[planned\.example\]\{\.planned\}/);
  assert.doesNotMatch(source, /\]\(/);
});

test("a call to action must be an absolute https URL", () => {
  for (const href of ["", "../intentset/index.html", "http://intentset.org", "javascript:alert(1)"]) {
    assert.throws(() => productGrid([{ ...base, cta: { text: "Visit Intentset", href } }]), href);
  }
});

test("the products appear in the approved order, each with a distinct accent", () => {
  assert.deepEqual(
    PRODUCTS.map((p) => p.name),
    ["Markset", "Intentset", "Streamlane", "Driftline"],
  );
  assert.equal(new Set(PRODUCTS.map((p) => p.slug)).size, 4);
});
