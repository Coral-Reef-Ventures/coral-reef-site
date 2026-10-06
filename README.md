# Coral Reef Ventures website

coralreefventures.com: the door to Streamlane and Driftline, and the company's record of interest and access. It
explains the thesis, introduces Markset, Intentset, Streamlane and Driftline as independent offerings, takes the
interest form and signs invited guests in to the two locked product sites. Requirements are in
[docs/requirements/](docs/requirements/README.md), and the decision behind the app is
[ADR 0001](docs/decisions/0001-the-door-and-the-app.md).

The app (`apps/web`) is a Next.js static export with Mantine, its copy written in [Markset](https://markset.org) and
copied verbatim from `docs/requirements/site-copy.md`. Its backend (`amplify/`) is Amplify Gen 2 in us-east-2. Both are
hosted on Amplify; `apps/web/hosting/README.md` has how, and how to roll back.

## Working on it

Node ≥ 22.18 and pnpm.

```sh
pnpm install
pnpm run web:dev      # http://localhost:3002
pnpm test             # Vitest: the app, the packages and the backend
pnpm exec playwright install chromium   # once
pnpm run e2e          # Chromium at 390px and 1440px, light and dark
pnpm run lint && pnpm run typecheck
```

## Where things live

| Path | What it is |
|---|---|
| `apps/web/content/` | The door's copy, in Markset, copied verbatim from `docs/requirements/site-copy.md`. |
| `apps/web/lib/product-facts.ts` | Product names, taglines, status labels and destinations. The only place a product link can come from. |
| `apps/web/app/door.css` | The door's theme, layered over Markset's default stylesheet. |
| `packages/brand/` | The mark and the brand's color tokens. |
| `amplify/` | The backend: auth, the interest, access and people areas, and their functions. |
| `scripts/leak-check.ts` | Proves the locked sites serve nothing without a session (CRV-014). |
| `e2e/` | Playwright screen tests: overflow, tap targets, keyboard, focus, contrast, and the form and admin flows. |

## Changing a product's status or destination

Edit `apps/web/lib/product-facts.ts`. A product gets a link only when it has a `cta`, and the build fails unless that
is an absolute `https` URL:

```ts
cta: { text: "Visit Intentset", href: "https://intentset.org" },
```

The door drops the links of the two locked products and shows them as open to invited guests
(`apps/web/lib/products.ts`, CRV-003).
