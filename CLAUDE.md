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
- **The app's pages.** `/` is the door: the outcome, the shift (writing the code is no longer the hard part), the problem (code outruns
  review and the product drifts; rewritten 2026-10-15 from Gary's thought-leadership notes), the four on their cards (Markset and Intentset are
  open foundations, never "products"; Streamlane and Driftline are products), how they fit, the whitepaper, the origin
  story ("Why we exist": the company's voice, unsigned since 2026-10-08, when Gary's signed founder note was rewritten
  at his request; rewritten again 2026-10-15 as a story ending on what the name means, a reef built by countless small
  builders into one structure that lasts, which Gary confirmed is why the name was chosen) and the contact. **The door makes the case; it does not demonstrate it** (2026-10-08): the internal
  pilot, the worked example and "Where to start" all came off that day, because a dated one-capability experiment and a
  record of a product's emptiest state told a reader how new this is, and the how-to lead was written for an engineer
  on a page read by investors. The evidence lives where its context does, in `/whitepaper/` and in Intentset's adoption
  log; `/get-involved/` is reached from the header's nav and the one button in "Talk to us". `/whitepaper/` is Gary's whitepaper in Markset, ungated, and kept
  only there: no PDF beside it. Rewritten 2026-10-15 at his request around the same thesis, for design partners first and
  investors second; its status table and adoption figures are dated, so refresh them when a version or the log moves. `/get-involved/`
  holds the interest form (`#involved`) and the invitation sign-in (`#invited`), moved off the home page 2026-10-05 at
  Gary's request; the header's nav is Whitepaper (added 2026-10-09, so the paper the door sends readers to for its
  evidence is reachable from every page) and then Get involved. A locked site's gate redirects to the door's origin, `/`, with
  its request in the query, so the home page forwards any visit carrying a sign-in request, a refused sign-in or one of
  the two old anchors to `/get-involved/` (`DoorForward`, `door-session/forward.ts`). `/eddy/` (2026-10-09) introduces Eddy, in planning, and the loop with
  Capture ahead of Intent; it is reached only from the footer's "The step before intent" (the door's note asking whether the loop starts
  at intent came off the same day, at Gary's request), and Eddy has no card, mark,
  accent or domain until each is approved. `/streamlane/roadmap/` (CRV-015, 2026-10-17) is Streamlane's roadmap, read
  at build from Streamlane's own planning team (`SL` in `crv`, public under Streamlane ADR 0094) as a signed-out guest
  reads it, and reached from Streamlane's card ("See Streamlane's roadmap"), which still reads "Open to invited
  guests.": the product owner chose that day to keep streamlane.app locked and show the roadmap here. It is under
  `/streamlane/` because it is that product's (there is no `/streamlane/` page). `/privacy/`, `/signed-in/`,
  `/signout/`, `/signout/done/` and the admin views under `/admin/` are the rest.
- **The frame lines up with the shell.** The color-scheme control is in the header's bar, after the nav and before the
  folded menu's button, through reef's `headerTools` (`@coralreefventures/site` 0.3.0, `lib/site.tsx`); its slot keeps
  the collapsed pill's size so the open pill grows leftward over the bar and a phone's row never overflows. Every page's
  column, the admin views' included, is the shell's (`--site-max-width`, `--site-gutter`), so the h1 starts where the
  lockup does and nothing runs past the header's right edge. `e2e/door.spec.ts` holds both, at 390 to 1440px.
- **Product facts live in `apps/web/lib/product-facts.ts` only.** A link exists only where a destination is confirmed
  (markset.org, intentset.org, driftline.app); streamlane.app is a planned destination and renders as text, never as a link.
  The door reads the same table through `apps/web/lib/products.ts`, which drops the two locked products' links and gives
  them "Open to invited guests." (CRV-003 v0.2). Streamlane's `roadmap` names its page here and the public team it is
  read from; the roadmap page links each idea to its page in that team (`https://crv.streamlane.app/SL-n`, "Add my
  insight"), which a guest may read, and never links streamlane.app (CRV-015).
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
  allowed; analytics, tag managers, web fonts from another origin and embeds are not. The roadmap's read is the
  build's, not the browser's: `apps/web/scripts/read-roadmap.ts` runs before `next build`, signs in to Streamlane's
  identity pool as a guest and calls its Merged API (`lib/roadmap-guest.ts`), and the page ships the result as HTML.
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
  still needs asking. The roadmap's guest read (2026-10-17) added `@aws-sdk/credential-providers` 3.1146.0,
  `@smithy/signature-v4` 5.7.4 and `@aws-crypto/sha256-js` 5.2.0 as `@crv/web` dev dependencies, pinned, each already
  in the lockfile, under the product owner's standing approval for pinned dependencies.
- **AWS: us-east-2, every Regional resource, in the environment accounts below.** No Lambda@Edge. us-east-1 is used
  only where a service requires it, such as a CloudFront certificate (allowed since 2026-10-12, Streamlane ADR 0087).
  Each account's Lambda concurrency quota is 1000, shared by every app in that account, so reserved concurrency is
  possible where a function needs a ceiling or a guarantee (the intentset.org chat has one); each environment's
  backend has a ProjectConcurrency alarm at 800. An agent deploys only a temporary `ampx sandbox`, in `crv-sandbox`,
  and deletes it after. The old project account (865000063691, the `coral-reef` profile) held everything until the
  move and was closed on 2026-10-16; no profile, script or setting here names it any more. Gary activated the organization's advanced features
  on 2026-10-06, so the organization (`o-unhnb0wshs`, management account 797661577985) and its SCPs are his: these
  limits are this project's own rules now, not AWS's.
- **The environment accounts** (Streamlane ADR 0087, `infra/accounts/README.md`): `crv-dev`, `crv-staging`,
  `crv-prod` and `crv-sandbox`, one Identity Center sign-in (`aws sso login --sso-session crv`). The app's dev, staging
  and prod are Amplify apps with no repository connected (`apps/web/hosting/environments.ts`), deployed only by
  `.github/workflows/deploy.yml`: dev on every push to main, staging nightly from what dev last shipped. **Prod is
  started by hand by Gary** (2026-10-12): an agent never starts the workflow for prod and never deploys to the dev,
  staging or prod accounts itself. Prod also rebuilds nightly (04:45 CDT), the commit it already runs
  (`deployed/prod`) and nothing newer, so `/streamlane/roadmap/` is at most a day old: the one scheduled prod run, which
  ships nothing new. It extends to this site the product owner's choice for Streamlane's own site on 2026-10-15
  (streamlane #974, "A day"), and dropping it is removing that schedule from `deploy.yml`. Only prod's build reads the
  roadmap (`readsRoadmap` in `environments.ts`): `scripts/deploy.ts` downloads Streamlane's product outputs from the
  account's `crv-build-artifacts-<account>` bucket for it; dev's and staging's `crv` hold no SL team, so their pages say
  they read no roadmap. coralreefventures.com has been prod's since the cutover (2026-10-14).
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
  `pnpm run sandbox` deploys a temporary agent sandbox (`crv-agent`) to the `crv-sandbox` account (650836812608, the
  agents' own; `aws sso login --sso-session crv` first). Set `CRV_AUTH_DOMAIN_PREFIX=crv-door-sandbox` (the workspace's
  `.envrc` does) and placeholder `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` with
  `ampx sandbox secret set <name> --identifier crv-agent --profile crv-sandbox` first, piped from `printf`, not
  `echo`: the client id goes into the identity pool, which refuses its trailing newline. Delete it afterwards with
  `pnpm exec ampx sandbox delete --identifier crv-agent --profile crv-sandbox --yes`, with `CRV_AUTH_DOMAIN_PREFIX` still
  set (the delete synthesizes the backend first, and the settings check refuses it unset), remove the two secrets
  (`ampx sandbox secret remove <name> --identifier crv-agent --profile crv-sandbox`), and delete the `/aws/lambda/amplify-coralreefsite-crv*` log groups in `crv-sandbox` that Amplify's own custom-resource functions leave behind (they
  are created on first use, so no stack owns them). The key waits KMS's 7 days before it goes. Then move
  `.amplify/artifacts` out of the way: CDK's hotswap cache in it remembers the deleted stacks, and the next
  `ampx sandbox --once` fails with "Stack with id ... does not exist" until it is gone. On the sandbox an
  uninvited AdminCreateUser was refused with `NOT_INVITED` through the whole chain (trigger, AppSync with IAM,
  crv-access), first in the old account and again in `crv-sandbox` on 2026-10-16, where `crv-door-sandbox` was free. Measured cold on 2026-10-05, each trigger takes about 2 s of Cognito's 5-second limit (init 0.7 s plus
  1.3 s with crv-access also cold); pre token generation after a warm crv-access takes 1.4 s.
  defineAuth always replaces the Cognito domain prefix with a hash, so `backend.ts` sets the fixed one on the domain
  resource. A sandbox names its key alias, topic and web ACL after itself and subscribes no inbox, so it can share an
  account with other sandboxes (Streamlane's are in `crv-sandbox` too).
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

coralreefventures.com and `www` are served by prod's Amplify app, `coral-reef-site` (`d5rsxrpztyob9` in `crv-prod`),
deployed only by `.github/workflows/deploy.yml` (`apps/web/hosting/environments.ts`), and the zone is
`Z0528736N9QND8UQUIJC` in `crv-prod`; streamlane.app and driftline.app are prod's too. `www` redirects to the apex
through `custom-rules.json`. `apps/web/hosting/` holds the headers and rules the deploy applies, and its README the
environments, the sign-in addresses and the leak check. `homepage` in `package.json` (the canonical URL) is
`https://coralreefventures.com/`. NameSilo (the registrar) points the domain's nameservers at the zone; NameSilo's own
records are kept, but they point at GitHub Pages and would now serve nothing.

History: from 2026-10-05 10:47 CDT to the cutover (2026-10-14) the site was served by the Amplify app `d1fw6blayytium`
in the old project account (865000063691) with its zone `Z1017162VVBRZ8PDRIQ3`; the zone was deleted and the account
closed on 2026-10-16 (Streamlane's `docs/plans/cells-and-accounts.md`, step 9).

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
