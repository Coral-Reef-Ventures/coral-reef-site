/**
 * The four offerings, and the one place their names, status labels and
 * destinations are written down (backlog item 3).
 *
 * A destination is either confirmed and public, in which case the card links to
 * it, or it is not, in which case there is no `cta` and no link can be built.
 * That is the whole guard against a broken call to action (CRV-003): a product
 * gets a link by gaining a `cta` here once its public URL is confirmed, and not
 * before. A planned destination that is not yet an
 * invitation, like streamlane.app, is `plannedDestination` and renders as text. driftline.app gained a
 * `cta` on 2026-10-04, when its site went live with an early-access request.
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
    tagline: "Documents your agents write, and people want to read.",
    description:
      "Markdown with a small, closed vocabulary of layout: cards, grids, tabs, metrics and charts. Agents write it from one guide and check their own work; people review plain text that reads as Markdown wherever it goes.",
    label: "Open source · v0",
    cta: { text: "Visit Markset", href: "https://markset.org" },
  },
  {
    slug: "intentset",
    name: "Intentset",
    area: "Intent",
    tagline: "Keep control of what your agents build.",
    description:
      "Readable records of what your product promises, which code delivers each promise and how it is checked, kept current by your agents in the same commit as the code. People review the product, not the diff.",
    label: "Open source · Early release",
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
      "Knows what each release is meant to do, and watches real users meet it. When adoption stalls it asks them why, traces errors to the team that owns them, and runs feature flags and betas.",
    label: "Product · In planning",
    availability: "Early access by request.",
    cta: { text: "Visit Driftline", href: "https://driftline.app" },
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
