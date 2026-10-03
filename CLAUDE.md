# Coral Reef Ventures site

One static page for the parent company, built the way the Markset site is: the page is Markset source rendered by
`@markset-lang/parser` and `@markset-lang/render-html`, a TypeScript build script run by Node's type stripping, and a
Pages workflow. Read `docs/requirements/` before changing anything: `site-copy.md` is the editorial source and
`website-requirements.md` holds the CRV requirements the tests are named after.

## Rules

- **Copy is approved text.** Use `site-copy.md` verbatim; do not write new marketing copy, invent domains, GitHub links,
  contact channels (the one approved is hello@coralreefventures.com) or brand assets (logo, favicon, social image).
- **Product facts live in `site/products.ts` only.** A link exists only where a destination is confirmed. Intentset has
  none yet; streamlane.app is a planned destination and renders as text, never as a link.
- **No script, form, tracking or external font** in the output (CRV-007). Tests enforce it.
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
  pair, as in `markset.css`. The three product accents (violet, teal, amber) each have a bar color and a darker or
  lighter `-text` variant that clears 4.5:1.

## Open launch decisions

From the requirements' launch gates, not yet settled:

- Hosting destination. `homepage` in `package.json` (the canonical URL) is `https://coralreefventures.com/`, assumed from
  the company email domain. No CNAME is written; a custom domain is set in the repository's Pages settings.
- Intentset's public URL.
- Brand assets: there is no logo, favicon or social image, so the social card is text only.
- Product claims and license labels, to be confirmed against actual releases.
