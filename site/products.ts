/**
 * The four offerings, and the one place their names, status labels and
 * destinations are written down (backlog item 3).
 *
 * A destination is either confirmed and public, in which case the card links to
 * it, or it is not, in which case there is no `cta` and no link can be built.
 * That is the whole guard against a broken call to action (CRV-003): a product
 * gets a link by gaining a `cta` here once its public URL is confirmed, and not
 * before. A planned destination that is not yet an
 * invitation, like streamlane.app and driftline.app, is `plannedDestination` and renders as text.
 *
 * Copy is from docs/requirements/site-copy.md, which is the editorial source.
 */

export interface Product {
  /** Used as the card's class, which picks its accent color in site.css. */
  slug: "markset" | "intentset" | "streamlane" | "driftline";
  name: string;
  /** What it handles: documents, intent, work or usage; the card's kicker. */
  area: string;
  tagline: string;
  description: string;
  /** Maturity label, shown on the card exactly as approved. */
  label: string;
  /** A confirmed public destination. Absent means the card carries no link. */
  cta?: { text: string; href: string };
  /** Shown when the product cannot be used yet. */
  availability?: string;
  /** A destination that is planned but is not yet an invitation; rendered as text, never as a link. */
  plannedDestination?: string;
}

export const PRODUCTS: Product[] = [
  {
    slug: "markset",
    name: "Markset",
    area: "Documents",
    tagline: "Rich documents without leaving Markdown.",
    description:
      "A portable Markdown extension for structured, expressive documents that remain readable as text. Built for content that needs to move between people, tools, and publishing systems.",
    label: "Open source",
    cta: { text: "Visit Markset", href: "https://markset.org" },
  },
  {
    slug: "intentset",
    name: "Intentset",
    area: "Intent",
    tagline: "Keep product intent connected to what you ship.",
    description:
      "An open framework connecting observable product behavior to its implementation, verification, and customer knowledge. Start with readable files; build a model people and agents can follow.",
    label: "Open source",
    cta: { text: "Visit Intentset", href: "https://intentset.org" },
  },
  {
    slug: "streamlane",
    name: "Streamlane",
    area: "Work",
    tagline: "Work management built for teams and agents.",
    description:
      "A unified workspace for planning and moving work forward, designed as an alternative to fragmented Atlassian workflows. Built around agentic development, with close GitHub and Slack integration.",
    label: "Product · In development",
    availability: "Not publicly available yet.",
    plannedDestination: "streamlane.app",
  },
  {
    slug: "driftline",
    name: "Driftline",
    area: "Usage",
    tagline: "Know whether what you shipped is working.",
    description:
      "Product analytics that understands what your product is meant to do. It watches how each release is adopted, asks users why when something stalls, traces errors to the team that owns them, and runs feature flags and betas.",
    label: "Product · In planning",
    availability: "Not publicly available yet.",
    plannedDestination: "driftline.app",
  },
];

/**
 * The product cards as Markset source: a two-column grid, one item per
 * product, each opened with `- {.product .<slug>}` so the theme can give it its
 * accent (spec §2.5). Generated rather than assembled as HTML, so the page stays
 * one Markset document and the renderer is the only thing writing markup.
 */
export function productGrid(products: Product[] = PRODUCTS): string {
  const items = products.map((p, i) => {
    const lines = [
      `- {.product .${p.slug}}`,
      `  [${String(i + 1).padStart(2, "0")} / ${p.area}]{.kicker}`,
      "",
      `  ### ${p.name}`,
      "",
      "  {.tagline}",
      `  ${p.tagline}`,
      "",
      `  ${p.description}`,
      "",
      `  [${p.label}]{.status}`,
    ];
    if (p.availability) lines.push("", `  ${p.availability}`);
    if (p.plannedDestination) lines.push("", `  [${p.plannedDestination}]{.planned}`);
    if (p.cta) {
      assertPublicUrl(p);
      lines.push("", `  [[${p.cta.text}](${p.cta.href})]{.cta}`);
    }
    return lines.join("\n");
  });
  return `:::grid{cols=2 .products}\n${items.join("\n\n")}\n:::`;
}

/** A call to action must point at a public https URL; anything else fails the build. */
function assertPublicUrl(p: Product): void {
  const href = p.cta?.href ?? "";
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new Error(`${p.name}: cta href is not an absolute URL: ${JSON.stringify(href)}`);
  }
  if (url.protocol !== "https:") throw new Error(`${p.name}: cta href must use https: ${href}`);
}
