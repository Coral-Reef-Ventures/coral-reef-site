# Coral Reef Ventures site

One static page for the parent company, built the way the Markset site is: the page is Markset source rendered by
`@markset-lang/parser` and `@markset-lang/render-html`, a TypeScript build script run by Node's type stripping, and a
Pages workflow. Read `docs/requirements/` before changing anything: `site-copy.md` is the editorial source and
`website-requirements.md` holds the CRV requirements the tests are named after.

## Rules

- **Copy is approved text.** Use `site-copy.md` verbatim; do not write new marketing copy, invent domains, GitHub links,
  contact channels (the one approved is hello@coralreefventures.com) or brand assets. The one exception is the mark,
  `site/icon.svg`: a puffer fish on a coral tile, asked for and approved 2026-10-03, drawn in the same language as the
  three products' marks. Its spines end in dots ("spines as nodes"), chosen the same day from a set of alternatives
  over the first version's plain spines, so the fish carries the network figure and the dots of Markset's mark. The
  coral tile (`#b8461f`) was kept over eight reef blues the same day: it is the one tile clearly distinct from all four
  products, and every blue sat close to Driftline's sea blue. It is the favicon and the header's image. There is still no social image.
- **Product facts live in `site/products.ts` only.** A link exists only where a destination is confirmed
  (markset.org, intentset.org); streamlane.app and driftline.app are planned destinations and render as text, never as links.
- **No form, tracking or external font** in the output (CRV-007), and **one script**: the color-scheme control's, the same
  as markset.org's and intentset.org's, which stores one word in the reader's browser and sends nothing anywhere. CRV-007
  rules out a tracking dependency, not that. Tests enforce both halves.
- **Products are independent.** Nothing may imply one is a prerequisite for another (CRV-004).
- Don't add dependencies without asking.

## Toolchain

- Node ≥ 22.18. Erasable TypeScript only (no enums, namespaces, parameter properties); import with `.ts` extensions.
- `npm test` builds into a temporary directory and checks the output. `npm run e2e` is Playwright, as in Streamlane and
  Markset's editor: `e2e/global-setup.ts` builds into `e2e/.build`, and `e2e/page.spec.ts` checks it in Chromium at
  390px and 1440px in both color schemes for overflow, tap targets, keyboard order, focus rings and WCAG AA contrast.
  `npx playwright install chromium` once before the first run.
- `npm run lint` is Biome, configured in `biome.jsonc`; the stylesheet is exempt from formatting, as in Markset.
- `site/site.css` sets Markset's tokens and styles the author classes the page uses. Every color is a `light-dark()`
  pair, as in `markset.css`. The four product accents (violet, teal, amber, sea blue) each have a bar color and a darker or
  lighter `-text` variant that clears 4.5:1. Each product card shows that product's own mark beside its name, carried
  in the stylesheet as a data URI (Markset's and Intentset's from their sites, Streamlane's tiles from its brand package,
  the ink tile in light and the light tile in dark, as that guide says; Driftline's drawn 2026-10-03 for this page, until
  Driftline has a repository to own it); refresh them there when a product's mark changes.

## Open launch decisions

From the requirements' launch gates, not yet settled:

- Hosting destination. `homepage` in `package.json` (the canonical URL) is `https://coralreefventures.com/`, assumed from
  the company email domain. No CNAME is written; a custom domain is set in the repository's Pages settings.
- Brand assets: the mark exists (`site/icon.svg`); there is no social image, so the social card is text only.
- Product claims and license labels, to be confirmed against actual releases.
