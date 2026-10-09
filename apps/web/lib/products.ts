import { PRODUCTS, type Product, productGrid } from "./product-facts.ts";

/** The two products behind the door. */
const LOCKED: ReadonlySet<Product["slug"]> = new Set(["streamlane", "driftline"]);

/**
 * The four offerings as the door shows them, from the one place their names and copy are written down
 * (product-facts.ts). A locked product's card carries no destination for a visitor: CRV-003 has it read "Open to
 * invited guests" and link nowhere. The way in is /get-involved/, which the note under the cards points at and the
 * header's nav link goes to; the invitation sign-in has been on that page since 2026-10-05.
 */
export const doorProducts: Product[] = PRODUCTS.map((product) => {
  if (!LOCKED.has(product.slug)) return product;
  const { cta: _cta, plannedDestination: _planned, ...rest } = product;
  return { ...rest, availability: "Open to invited guests." };
});

export const doorProductGrid = (): string => productGrid(doorProducts);
