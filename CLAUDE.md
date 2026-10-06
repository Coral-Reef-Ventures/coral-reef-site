# Coral Reef Ventures site

**The CRV app** (`apps/web`, `packages/brand` and the backend in `amplify/`; ADR 0001,
`docs/decisions/0001-the-door-and-the-app.md`, proposed 2026-10-04): the door to Streamlane and Driftline and the
company's system of record for interest and access. Next.js static export and Mantine on Amplify Gen 2, with the
door's copy in Markset (`apps/web/content/`). It replaced the one-page GitHub Pages site at the cutover (plan Phase
2b, 2026-10-05); Phase 2c deleted that page and turned Pages off on 2026-10-06, ahead of the planned 14 days, at
Gary's decision.

Read `docs/requirements/` before changing anything: `site-copy.md` is the editorial source and
`website-requirements.md` holds the CRV requirements the tests are named after (v0.2, adds CRV-009 to CRV-014 and
supersedes CRV-007; its copy approved, its requirement text still recorded as proposed).

## Rules

- **Copy is approved text.** Use `site-copy.md` verbatim; do not write new marketing copy, invent domains, GitHub links,
  contact channels (the one approved is hello@coralreefventures.com) or brand assets. The one exception is the mark,
  `packages/brand/icon.svg` (served as `apps/web/public/icon.svg`): a puffer fish on a coral tile, asked for and approved 2026-10-03, drawn in the same language as the
  three products' marks. Its spines end in dots ("spines as nodes"), chosen the same day from a set of alternatives
  over the first version's plain spines, so the fish carries the network figure and the dots of Markset's mark. The
  coral tile (`#b8461f`) was kept over eight reef blues the same day: it is the one tile clearly distinct from all four
  products, and every blue sat close to Driftline's sea blue. It is the favicon and the header's image. There is still no social image.
- **New copy is drafted in `site-copy.md`, marked proposed, and Gary approves it before it goes live.** The door, its
  privacy page with its retention periods, and the invitation text were approved by Gary on 2026-10-05 (plan step P8),
  as was the locked sites' coming-soon page, which reef's gate serves. A change to any of them is proposed again until
  he approves it. `site-copy.md` is the source of the app's
  content files: `apps/web/content/door.md`, `get-involved.md` and `privacy.md` are copied into it verbatim, and
  `apps/web/lib/content.test.ts` fails if any differs. Change the copy there first and the content file in the same commit. The form's and sign-in's words are
  listed there too; keep the components' strings in step with it.
- **The app's pages.** `/` is the door: the story, the four product cards and the closing statement. `/get-involved/`
  holds the interest form (`#involved`) and the invitation sign-in (`#invited`), moved off the home page 2026-10-05 at
  Gary's request; the header's one nav link goes there. A locked site's gate redirects to the door's origin, `/`, with
  its request in the query, so the home page forwards any visit carrying a sign-in request, a refused sign-in or one of
  the two old anchors to `/get-involved/` (`DoorForward`, `door-session/forward.ts`). `/privacy/`, `/signed-in/`,
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
  period changes the privacy copy, which is proposed copy again until Gary approves it.
- **The leak check proves the lock** (CRV-014): `scripts/leak-check.ts`, daily in `.github/workflows/leak-check.yml`
  (a workflow of its own, so a locked site never fails a pull request) and by hand after every product deploy. It
  checks the sites marked `locked` in `scripts/leak-check/sites.ts`, which is set in the change that records a flip (both are, since 2026-10-06).
  Its session is an existing invitee (`crv-check@example.com`) it sets a fresh password for and signs in as; it makes
  no admin call and never invites, erases or creates anyone, because inviting is an admin's job (go-ahead §17c).
  `apps/web/hosting/README.md`, "The leak check", has how, and the IAM role CI needs, `crv-leak-check`, which does not
  exist: the project's SCP denies the OIDC provider it needs (2026-10-06), so the daily run checks without a session.
- **Unlocking a locked site is a recorded decision** (`door.unlocked` in Activity, with a reason), never a silent
  rollback.
- **Products are independent.** Nothing may imply one is a prerequisite for another (CRV-004).
- Don't add dependencies without asking. The ones the door plan names were approved 2026-10-04; anything beyond them
  still needs asking.
- **AWS: the `coral-reef` profile, us-east-2, every Regional resource.** No Lambda@Edge, no us-east-1 certificate, no
  reserved Lambda concurrency (the project's limit is 10, which allows none). An agent deploys only a temporary
  `ampx sandbox`, and deletes it after.
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

- **Phase 3, the lock, is applied** (2026-10-06). driftline.app and streamlane.app serve only to invitees, from the
  app root `apps/site-door` in each repository (driftline #16, streamlane #348: from an app root whose `package.json`
  uses Next.js, Amplify runs its own Next.js deployment and refuses the gate's). Both leak checks are clean and both
  sites are `locked` in `scripts/leak-check/sites.ts`. Left: the role `crv-leak-check`, whose OIDC provider the
  project's SCP denies (2026-10-06) until advanced features are activated, Gary's decision; the daily run has no
  session until then. `apps/web/hosting/README.md`, "Phase 3: status".

- Requirements v0.2 and ADR 0001 are still recorded as proposed. Gary approved the copy they go with (the door, the
  privacy page with its retention periods and the invitation text) on 2026-10-05 (P8); his approval named the copy.
- Brand assets: the mark exists (`packages/brand/icon.svg`); there is no social image, so the social card is text only.
- Product claims, to be confirmed against actual releases. The labels were confirmed 2026-10-04: Markset `Open source · v0`,
  Intentset `Open source · Early release`.

<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance for the new AWS experience

This user has signed up for the new AWS experience. This experience lets you sign into AWS using a social provider and requires the following additional context.

Where this guidance conflicts with the project's own instructions, the project's instructions take precedence.

## Context

### Terminology:

- Say "project" instead of "account" — a project contains an AWS account and settings for sharing with other collaborators
- Say "team member" instead of "IAM user" — users are invited by email, not created or federated in IAM
- Say "AWS Settings" when referring to management tasks at [settings.aws.com](https://settings.aws.com/) (project management, billing, team members, spend limits). Users view their actual AWS resources in the AWS Management Console.
- Say "selected Region" when referring to the user's Region — not "home Region"
- The user has a managed IAM experience. This includes a managed service control policies (SCP) and resource control policies (RCP) that govern the use of AWS. They will still need to use IAM to create policies to let services work with each other. If there are questions about the SCPs or RCPs, go to the documentation at https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html

### Constraints:

- All projects share a single AWS Region determined by the user's contact address. Resources cannot be created in other Regions
- When developing:
  - MUST create all Regional resources in the project's assigned Region
  - You CAN create AWS WAF and Cloudwatch Logs resources in us-east-1 when there are global resources (like a global WAF instance) that require a connection to dependencies in us-east-1. You should not use these for any other reason, because resources in the selected Region will provide lower cost (due to no cross-Region traffic), increased availability (due to no cross-Region traffic), and easier manageability (due to not needing to look in another Region). When you need to do an inventory of resources, you need to look in both the selected Region and us-east-1 for Cloudwatch Logs or WAF resources.
  - MUST NOT attempt to create Lambda, API Gateway, or other Regional resources in any other Region
  - MUST direct users to confirm their Region in AWS Settings > View all projects > Overview > Additional Info > Region. If the user cannot confirm their Region, check in ~/.aws/config
  - MUST NOT use Lambda@Edge — excluded from both Lambda and CloudFront
  - MUST NOT use CloudFormation StackSets — no multi-account or multi-Region deployments
  - MUST NOT attempt cross-Region actions — no cross-Region replication for DynamoDB/S3/RDS, no multi-Region KMS keys
  - MUST NOT use Route 53 cross-Region routing — geolocation, latency-based, and failover routing policies are not available
  - CloudFront is a global service and its actions ARE allowed in `us-east-1`. A user can create a CloudFront distribution pointing to their project-region Lambda function URL or API Gateway. However, Lambda and API Gateway themselves MUST NOT be created in `us-east-1` — they must be in the project Region.
  - Reduced availability in `eu-north-1` specifically: Amazon Rekognition, Amazon Textract, Amazon Personalize, AWS App Runner are not available in that Region.
- IAM permissions for human access are managed by AWS. Don't assign roles to team members unless absolutely necessary
- The user may have a spend limit if they are on the paid plan. The limit that pauses their project if it's exceeded. If resources suddenly become inaccessible, ask if they have a spend limit configured. Only project owners can modify a spend limit.
- When developing:
  - MUST ask about spend limit status if the user reports sudden "Access Denied" errors on operations that previously worked
  - MUST direct users to check spend status in AWS Settings > Billing
  - MUST check if a user has upgraded their account to the paid plan
  - MUST ask the user if they want to clean up the successfully created resources or keep them to reduce cost
- The user sets up billing, creates spend limits, and retrieves and pays invoices in AWS Settings. The user creates budgets and optimizes their costs in the AWS Billing and Cost Management console
- Not all AWS services are available. If a service isn't working, do the following:
  1. Run the command `aws freetier get-account-plan-state`
  2. If accountPlanType": "FREE", check the [Free Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-free-tier) next,
  3. If accountPlanType": "PAID", check the [Paid Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-paid-plan).
  4. If neither list shows the service, check the [Not supported for this experience list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#unsupported-services). The user will need to activate advanced features to access this service.
- Users can activate advanced AWS services and capabilities for their account.
- Before starting a task, check whether a relevant AWS skill is available. Load the skill with retrieve_skill and prefer its guidance over general knowledge.

### Help level

- help_level (required): LOW, MEDIUM, or HIGH. While a user is building, you MUST ask the user: "How much guidance would you like from me? Low (I only flag security risks), medium (I ask a couple of clarifying questions if something seems off), or high (I explain what I'm doing, suggest alternatives, and flag best practices)."

You CAN update this rule file to save a user's help_level.

Constraints for each level:

**LOW:**

- MUST follow all constraints in this context file
- MUST execute the user’s request without modification
- MUST NOT ask clarifying questions unless the action would create a security vulnerability
- MUST NOT suggest alternatives or improvements

**MEDIUM:**

- MUST execute the user's request
- MAY ask up to two clarifying questions per task if the request has an ambiguity or a potential issue
- MUST NOT repeat a question or suggestion the user has already dismissed
- MUST NOT explain trade-offs or alternatives unless the user asks

**HIGH:**

- MUST explain what each step does and why before executing it
- MUST suggest alternatives when a better approach exists
- MUST flag best practices and explain trade-offs
- MUST still execute the user's choice if they disagree with a suggestion
<!-- END AWS Agent Toolkit rules -->
