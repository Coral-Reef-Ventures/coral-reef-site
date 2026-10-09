# Coral Reef Ventures site

**The CRV app** (`apps/web`, `packages/brand` and the backend in `amplify/`; ADR 0001,
`docs/decisions/0001-the-door-and-the-app.md`, accepted 2026-10-06): the door to Streamlane and Driftline and the
company's system of record for interest and access. Next.js static export and Mantine on Amplify Gen 2, with the
door's copy in Markset (`apps/web/content/`). It replaced the one-page GitHub Pages site at the cutover (plan Phase
2b, 2026-10-05); Phase 2c deleted that page and turned Pages off on 2026-10-06, ahead of the planned 14 days, at
Gary's decision.

Read `docs/requirements/` before changing anything: `website-requirements.md` holds the CRV requirements the tests
are named after (v0.2, adds CRV-009 to CRV-014 and supersedes CRV-007; its requirement text accepted 2026-10-06), and
the facts the copy must keep.

## Rules

- **Copy can be written and changed without approval** (Gary, 2026-10-06). The copy is the content files
  (`apps/web/content/`), the product table (`apps/web/lib/product-facts.ts`) and the components' strings. It never
  invents a fact: no domain, link, contact address, price, legal or privacy claim, or claim that is not true today.
  The one contact address is hello@coralreefventures.com.
  `website-requirements.md`, "Content authority", has the facts the cards and pages keep.
- **No invented brand assets.** The one mark is
  `packages/brand/icon.svg` (served as `apps/web/public/icon.svg`): a puffer fish on a coral tile, asked for and approved 2026-10-03, drawn in the same language as the
  three products' marks. Its spines end in dots ("spines as nodes"), chosen the same day from a set of alternatives
  over the first version's plain spines, so the fish carries the network figure and the dots of Markset's mark. The
  coral tile (`#b8461f`) was kept over eight reef blues the same day: it is the one tile clearly distinct from all four
  products, and every blue sat close to Driftline's sea blue. **The ground is the tile's neighbour in both schemes**
  (`packages/brand/tokens.ts`, the one source, which `tokens.test.ts` holds `door.css` to): the cream always was, and
  on 2026-10-07 the dark ground went from a green-black to a warm near-black, which had been sitting cool under a
  coral mark and cream text. Every family site's ground carries its own mark's color this way; `e2e/door.spec.ts`
  measures WCAG AA on every text element in both schemes, and a changed dark ground means redrawing the social card. It is the favicon, the header's image and the mark on the
  social card.
- **The app's pages.** `/` is the door: the outcome, the problem, the four on their cards (Markset and Intentset are
  open foundations, never "products"; Streamlane and Driftline are products), how they fit, the whitepaper, the origin
  story ("Why we exist": the company's voice, unsigned since 2026-10-08, when Gary's signed founder note was rewritten
  at his request) and the contact. **The door makes the case; it does not demonstrate it** (2026-10-08): the internal
  pilot, the worked example and "Where to start" all came off that day, because a dated one-capability experiment and a
  record of a product's emptiest state told a reader how new this is, and the how-to lead was written for an engineer
  on a page read by investors. The evidence lives where its context does, in `/whitepaper/` and in Intentset's adoption
  log; `/get-involved/` is reached from the header's nav and the one button in "Talk to us". `/whitepaper/` is Gary's whitepaper in Markset, ungated, and kept
  only there: no PDF beside it. `/get-involved/`
  holds the interest form (`#involved`) and the invitation sign-in (`#invited`), moved off the home page 2026-10-05 at
  Gary's request; the header's nav is Whitepaper (added 2026-10-09, so the paper the door sends readers to for its
  evidence is reachable from every page) and then Get involved. A locked site's gate redirects to the door's origin, `/`, with
  its request in the query, so the home page forwards any visit carrying a sign-in request, a refused sign-in or one of
  the two old anchors to `/get-involved/` (`DoorForward`, `door-session/forward.ts`). `/eddy/` (2026-10-09) introduces Eddy, in planning, and the loop with
  Capture ahead of Intent; it is reached only from the footer's "The step before intent" (the door's note asking whether the loop starts
  at intent came off the same day, at Gary's request), and Eddy has no card, mark,
  accent or domain until each is approved. `/privacy/`, `/signed-in/`,
  `/signout/`, `/signout/done/` and the admin views under `/admin/` are the rest.
- **The frame lines up with the shell.** The color-scheme control is in the header's bar, after the nav and before the
  folded menu's button, through reef's `headerTools` (`@coralreefventures/site` 0.3.0, `lib/site.tsx`); its slot keeps
  the collapsed pill's size so the open pill grows leftward over the bar and a phone's row never overflows. Every page's
  column, the admin views' included, is the shell's (`--site-max-width`, `--site-gutter`), so the h1 starts where the
  lockup does and nothing runs past the header's right edge. `e2e/door.spec.ts` holds both, at 390 to 1440px.
- **Product facts live in `apps/web/lib/product-facts.ts` only.** A link exists only where a destination is confirmed
  (markset.org, intentset.org, driftline.app); streamlane.app is a planned destination and renders as text, never as a link.
  The door reads the same table through `apps/web/lib/products.ts`, which drops the two locked products' links and gives
  them "Open to invited guests." (CRV-003 v0.2).
- **The social card is drawn by hand and committed** (2026-10-07): `pnpm run social-card` runs
  `scripts/social-card.ts`, which draws `apps/web/public/social-card.png` in a headless Chromium from the mark and
  the constants in `apps/web/lib/social-card.ts`; every page names it through `socialCardImages`, and a page that
  writes its own `openGraph` names it again, because Next replaces rather than merges. reef's own card builder
  (`socialCard` in `lib/site.tsx`) stays unused: it fetches a web font from Google at build time, which would put
  another origin in the build. Redraw the card when the mark, the headline or the colours change;
  `apps/web/lib/social-card.test.ts` holds the committed file to the size the pages claim.
- **The app: no tracking, no external font, no third-party script** (CRV-011). Nothing loads from another origin but
  the AWS endpoints the form and sign-in call. The browser stores only the sign-in tokens, the form's guest identity id
  and the scheme word, and coralreefventures.com sets no cookie. The locked sites set three, all the door's
  (`__Host-crv_door`, one hour; `__Host-crv_door_state`, 10 minutes during sign-in; `__Host-crv_door_seen`, 30 days,
  holding nothing about who you are, so an expired hour renews without the coming-soon page: Gary kept it 2026-10-05,
  go-ahead §17d, and `/privacy/` says so in his words). The form and the sign-in are
  allowed; analytics, tag managers, web fonts from another origin and embeds are not.
- **Access is decided by a grant, and an invitation binds to an identity** (ADR 0001). `AccessGrant` is the one place
  access is decided. An invitation binds to the first Cognito and Google identity that accepts it, never to an address
  alone. `CRV_ADMIN_EMAILS` (gary@coralreefventures.com, the first admin) is the one break-glass path; keep the list
  short.
- **Nothing personal or secret is logged**: no request body, message, email address, cookie, ticket or token. Each
  function logs an event kind, ids and a status, and a test per function holds it.
- **Every stored field has a retention period** (plan §2.3a), kept as constants the privacy page quotes. A changed
  period is a decision (D3) and changes the privacy page in the same commit; `amplify/areas/retention.test.ts` holds the
  two together.
- **The leak check proves the lock** (CRV-014): `scripts/leak-check.ts`, daily in `.github/workflows/leak-check.yml`
  (a workflow of its own, so a locked site never fails a pull request) and by hand after every product deploy. It
  checks the sites marked `locked` in `scripts/leak-check/sites.ts`, which is set in the change that records a flip (both are, since 2026-10-06).
  Its session is an existing invitee (`crv-check@example.com`) it sets a fresh password for and signs in as; it makes
  no admin call and never invites, erases or creates anyone, because inviting is an admin's job (go-ahead §17c).
  `apps/web/hosting/README.md`, "The leak check", has how, and the IAM role CI signs in through, `crv-leak-check`
  (2026-10-06), whose trust policy names both forms of GitHub's subject for this repository's `main`.
- **Unlocking a locked site is a recorded decision** (`door.unlocked` in Activity, with a reason), never a silent
  rollback.
- **Products are independent.** Nothing may imply one is a prerequisite for another (CRV-004).
- Don't add dependencies without asking. The ones the door plan names were approved 2026-10-04; anything beyond them
  still needs asking.
- **AWS: the `coral-reef` profile, us-east-2, every Regional resource.** No Lambda@Edge, no us-east-1 certificate, no
  reserved Lambda concurrency (the project's limit is 10, which allows none). An agent deploys only a temporary
  `ampx sandbox`, and deletes it after. Gary activated the project's advanced features on 2026-10-06, so the
  organization (`o-unhnb0wshs`, management account 797661577985) and its SCPs are his: these limits are this project's
  own rules now, not AWS's.
- **Check DNS over HTTPS** (`https://dns.google/resolve`) or with Route 53's `TestDNSAnswer`, never plain `dig`: this
  machine's network intercepts port 53 and answers wrongly.

## Toolchain

- **The backend** (`amplify/`, plan §2.1 to §2.4) is Amplify Gen 2 in us-east-2: auth with two triggers in the `auth`
  group, a schema of three areas (`areas/people`, `areas/interest`, `areas/access`), and three functions in the `data`
  group (`crv-access`, the named handler for every operation but the form's; `crv-interest`, the form's; `crv-retention`,
  the daily sweep). Its settings are environment variables read and checked at synth (`auth/settings.ts`). The triggers
  touch no table: they call `checkAdmission` and `admitSignIn` through `allow.resource` and the data client, so nothing
  in the auth stack points at the data stack, and `auth/wiring.test.ts` synthesizes the backend to hold that. Every
  function writes through the `Store` in `functions/shared/store.ts`, whose conditions are data, so the tests run each
  operation against `test/memory-store.ts` with the same conditions DynamoDB is sent. `amplify/vitest.config.ts`
  synthesizes the backend twice, as a sandbox and as the branch, before its tests, reading no account.
  `pnpm run sandbox` deploys a temporary agent sandbox (`crv-agent`; set `CRV_AUTH_DOMAIN_PREFIX=crv-door-sandbox` and
  placeholder `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` with `ampx sandbox secret set` first, piped from `printf`, not
  `echo`: the client id goes into the identity pool, which refuses its trailing newline); delete it afterwards with
  `pnpm exec ampx sandbox delete --identifier crv-agent --profile coral-reef --yes`, with `CRV_AUTH_DOMAIN_PREFIX` still
  set (the delete synthesizes the backend first, and the settings check refuses it unset), remove the two secrets, and
  delete the `/aws/lambda/amplify-coralreefsite-crv*` log groups Amplify's own custom-resource functions leave behind (they
  are created on first use, so no stack owns them). The key waits KMS's 7 days before it goes. Then move
  `.amplify/artifacts` out of the way: CDK's hotswap cache in it remembers the deleted stacks, and the next
  `ampx sandbox --once` fails with "Stack with id ... does not exist" until it is gone. On the sandbox an
  uninvited AdminCreateUser was refused with `NOT_INVITED` through the whole chain (trigger, AppSync with IAM,
  crv-access). Measured cold on 2026-10-05, each trigger takes about 2 s of Cognito's 5-second limit (init 0.7 s plus
  1.3 s with crv-access also cold); pre token generation after a warm crv-access takes 1.4 s.
  defineAuth always replaces the Cognito domain prefix with a hash, so `backend.ts` sets the fixed one on the domain
  resource. A sandbox names its key alias, topic and web ACL after itself and subscribes no inbox, so it can share the
  project with the branch.
- Node ≥ 22.18. Erasable TypeScript only (no enums, namespaces, parameter properties); import with `.ts` extensions.
- pnpm (pinned by `packageManager`; moved from npm 2026-10-04 with the lockfile imported). `pnpm test` is Vitest:
  the app and packages, and the backend. `pnpm run e2e` is Playwright, as in Streamlane and Markset's editor:
  `e2e/global-setup.ts` builds the app's export with the stub backends and serves it, and `e2e/door.spec.ts` checks it
  in Chromium at 390px and 1440px in both color schemes for overflow, tap targets, keyboard order, focus rings and WCAG
  AA contrast. `pnpm exec playwright install chromium` once before the first run.
- `pnpm run lint` is Biome, configured in `biome.jsonc`; the stylesheet is exempt from formatting, as in Markset.
- `pnpm run intentset` is the architecture check (Intentset L2, the `product/model/slices/` files), and it is a gate
  CI runs that `pnpm test`, `pnpm run lint` and `pnpm run typecheck` do not: a slice reaching past another's
  `index.ts` entrypoint, or importing a slice it does not declare in `dependsOn`, is an error. Run it before pushing.
- `apps/web/app/door.css` sets Markset's tokens and styles the author classes the door uses. Every color is a `light-dark()`
  pair, as in `markset.css`. The four product accents (violet, teal, amber, sea blue) each have a bar color and a darker or
  lighter `-text` variant that clears 4.5:1. Each product card shows that product's own mark beside its name, carried
  in the stylesheet as a data URI (Markset's and Intentset's from their sites, Streamlane's tiles from its brand package,
  the ink tile in light and the light tile in dark, as that guide says; Driftline's drawn 2026-10-03 for the old page,
  until Driftline has a repository to own it); refresh them there when a product's mark changes.

## Hosting

ADR 0001: the CRV app on the Amplify `WEB` app `coral-reef-site` (`d1fw6blayytium`, branch `main`) in the coral-reef
project (us-east-2) has served `coralreefventures.com` since 2026-10-05 10:47 CDT, apex and `www`, on an
Amplify-managed certificate; `www` redirects to the apex through `custom-rules.json`. It still answers at
`https://main.d1fw6blayytium.amplifyapp.com`. `apps/web/hosting/` holds the build spec, headers and rules, applied with
`update-app`, and its README the custom domain and how to roll it back. `homepage` in `package.json` (the canonical URL)
is `https://coralreefventures.com/`.

DNS is the Route 53 zone `Z1017162VVBRZ8PDRIQ3` in the coral-reef project; NameSilo (the registrar) points its
nameservers there. The zone's records were copied from NameSilo's: first the GitHub Pages A records and `www` CNAME,
replaced at the cutover by the apex ALIAS, the `www` CNAME and the ACM validation CNAME that Amplify wrote itself; then
Google Workspace's MX, SPF and DKIM, and Google's verification CNAME, unchanged. NameSilo's own records are kept, so
rolling back is setting its nameservers again.

GitHub Pages, decided earlier on 2026-10-04 (#11), was to stay deployed until 2026-10-19 in case the switch had to be
undone; Gary retired it early, on 2026-10-06. Phase 2c then deleted the page, its tests and its workflow, and turned Pages off, so there is no longer a Pages
site to roll back to.

## Open launch decisions

From the requirements' launch gates, not yet settled:

- **Phase 3, the lock, is complete** (2026-10-06). driftline.app and streamlane.app serve only to invitees, from the
  app root `apps/site-door` in each repository (driftline #16, streamlane #348: from an app root whose `package.json`
  uses Next.js, Amplify runs its own Next.js deployment and refuses the gate's). Both leak checks are clean and both
  sites are `locked` in `scripts/leak-check/sites.ts`. The daily leak check signs in through the role
  `crv-leak-check`. `apps/web/hosting/README.md`, "Phase 3: status".

- Brand assets: the mark exists (`packages/brand/icon.svg`), and since 2026-10-07 so does the social card,
  `apps/web/public/social-card.png`: the mark, the home page's headline and the four colours already in
  `lib/site.tsx`, nothing invented.
- Product claims, to be confirmed against actual releases. The labels were confirmed 2026-10-04: Markset `Open source · v0`,
  Intentset `Open source · Early release`.
