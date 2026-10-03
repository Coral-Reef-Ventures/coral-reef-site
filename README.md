# Coral Reef Ventures website

The parent-company site: one page that explains the thesis and introduces Markset, Intentset and Streamlane as
independent offerings. Requirements are in [docs/requirements/](docs/requirements/README.md).

The page is a [Markset](https://markset.org) document, `site/content/index.md`, rendered to static HTML by the Markset
reference implementation and deployed to GitHub Pages. There is no framework, no client-side script and no backend.

## Working on it

Node ≥ 22.18. TypeScript runs directly through Node's type stripping; there is no compile step.

```sh
npm install
npm run site:watch   # http://localhost:3000, rebuilds and reloads on change
npm run site         # build into dist/
npm test             # requirements checks against the built HTML
npx playwright install chromium   # once
npm run e2e          # Chromium at 390px and 1440px, light and dark
npm run lint && npm run typecheck
```

## Where things live

| Path | What it is |
|---|---|
| `site/content/index.md` | The page copy, in Markset. `{{products}}` is replaced with the product cards. |
| `site/products.ts` | Product names, taglines, status labels and destinations. The only place a product link can come from. |
| `site/build.ts` | Renders the page and wraps it in the shell: header, footer, metadata. |
| `site/site.css` | The site theme, layered over Markset's default stylesheet. |
| `test/` | Requirements checks against the built HTML, named after the CRV IDs. |
| `e2e/` | Playwright screen tests: overflow, tap targets, keyboard, focus, contrast. |

## Changing a product's status or destination

Edit `site/products.ts`. A product gets a link only when it has a `cta`, and the build fails unless that is an absolute
`https` URL. To enable "Explore Intentset" once its public URL is confirmed:

```ts
cta: { text: "Explore Intentset", href: "https://…" },
```

and update the CRV-003 test, which lists the confirmed destinations.

## Publishing

`.github/workflows/pages.yml` runs lint, typecheck, tests and the screen tests, builds `dist/`, and deploys it on every push to `main`.
Enable Pages once in the repository settings with **GitHub Actions** as the source. The canonical URL is `homepage` in
`package.json`; a custom domain is set in the repository's Pages settings.
