# Coral Reef Ventures site

Two things live here, one replacing the other (ADR 0001, `docs/decisions/0001-the-door-and-the-app.md`, proposed
2026-10-04):

- **The Pages page** (`site/`, `test/`, `e2e/page.spec.ts`): one static page, built the way the Markset site is, as
  Markset source rendered by `@markset-lang/parser` and `@markset-lang/render-html`, a TypeScript build script run by
  Node's type stripping, and a Pages workflow. It serves coralreefventures.com until the cutover (plan Phase 2b) and is
  deleted 14 days after it.
- **The CRV app** (`apps/web`, `packages/brand` and the backend in `amplify/`): the door to Streamlane and
  Driftline and the company's system of record for interest and access. Next.js static export and Mantine on Amplify
  Gen 2, with the door's copy in Markset (`apps/web/content/`).

Read `docs/requirements/` before changing anything: `site-copy.md` is the editorial source and
`website-requirements.md` holds the CRV requirements the tests are named after (v0.2, proposed, adds CRV-009 to
CRV-014 and supersedes CRV-007).

## Rules

- **Copy is approved text.** Use `site-copy.md` verbatim; do not write new marketing copy, invent domains, GitHub links,
  contact channels (the one approved is hello@coralreefventures.com) or brand assets. The one exception is the mark,
  `site/icon.svg`: a puffer fish on a coral tile, asked for and approved 2026-10-03, drawn in the same language as the
  three products' marks. Its spines end in dots ("spines as nodes"), chosen the same day from a set of alternatives
  over the first version's plain spines, so the fish carries the network figure and the dots of Markset's mark. The
  coral tile (`#b8461f`) was kept over eight reef blues the same day: it is the one tile clearly distinct from all four
  products, and every blue sat close to Driftline's sea blue. It is the favicon and the header's image. There is still no social image.
- **New copy is drafted in `site-copy.md`, marked proposed, and Gary approves it before it goes live.** The door, its
  privacy page and the invitation text are proposed (2026-10-04) and go live only at the cutover, after Gary approves
  them (plan step P8). `site-copy.md` is the source of the app's content files: `apps/web/content/door.md` and
  `privacy.md` are copied into it verbatim, and `apps/web/lib/content.test.ts` fails if either differs. Change the copy
  there first and the content file in the same commit. The form's and sign-in's words are listed there too; keep the
  components' strings in step with it.
- **Product facts live in `site/products.ts` only.** A link exists only where a destination is confirmed
  (markset.org, intentset.org, driftline.app); streamlane.app is a planned destination and renders as text, never as a link.
  The door reads the same table through `apps/web/lib/products.ts`, which drops the two locked products' links and gives
  them "Open to invited guests." (CRV-003 v0.2).
- **The Pages page only: no form, tracking or external font** (CRV-007, which v0.2 supersedes for the app), and **one
  script**: the color-scheme control's, the same as markset.org's and intentset.org's, which stores one word in the
  reader's browser and sends nothing anywhere. CRV-007 rules out a tracking dependency, not that. `test/` enforces both
  halves until the page is retired.
- **The app: no tracking, no external font, no third-party script** (CRV-011). Nothing loads from another origin but
  the AWS endpoints the form and sign-in call. The browser stores only the sign-in tokens, the form's guest identity id
  and the scheme word, and coralreefventures.com sets no cookie. The locked sites set exactly two, both the door's
  (`__Host-crv_door`, one hour; `__Host-crv_door_state`, 10 minutes during sign-in). The form and the sign-in are
  allowed; analytics, tag managers, web fonts from another origin and embeds are not.
- **Access is decided by a grant, and an invitation binds to an identity** (ADR 0001). `AccessGrant` is the one place
  access is decided. An invitation binds to the first Cognito and Google identity that accepts it, never to an address
  alone. `CRV_ADMIN_EMAILS` (gary@coralreefventures.com, the first admin) is the one break-glass path; keep the list
  short.
- **Nothing personal or secret is logged**: no request body, message, email address, cookie, ticket or token. Each
  function logs an event kind, ids and a status, and a test per function holds it.
- **Every stored field has a retention period** (plan §2.3a), kept as constants the privacy page quotes. A changed
  period changes the privacy copy, which is proposed copy again until Gary approves it.
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
  placeholder `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` with `ampx sandbox secret set` first); delete it afterwards with
  `pnpm exec ampx sandbox delete --identifier crv-agent --profile coral-reef --yes` and remove the two secrets.
  defineAuth always replaces the Cognito domain prefix with a hash, so `backend.ts` sets the fixed one on the domain
  resource. A sandbox names its key alias, topic and web ACL after itself and subscribes no inbox, so it can share the
  project with the branch.
- Node ≥ 22.18. Erasable TypeScript only (no enums, namespaces, parameter properties); import with `.ts` extensions.
- pnpm (pinned by `packageManager`; moved from npm 2026-10-04 with the lockfile imported). `pnpm test` builds into a
  temporary directory and checks the output. `pnpm run e2e` is Playwright, as in Streamlane and
  Markset's editor: `e2e/global-setup.ts` builds into `e2e/.build`, and `e2e/page.spec.ts` checks it in Chromium at
  390px and 1440px in both color schemes for overflow, tap targets, keyboard order, focus rings and WCAG AA contrast.
  `pnpm exec playwright install chromium` once before the first run.
- `pnpm run lint` is Biome, configured in `biome.jsonc`; the stylesheet is exempt from formatting, as in Markset.
- `site/site.css` sets Markset's tokens and styles the author classes the page uses. Every color is a `light-dark()`
  pair, as in `markset.css`. The four product accents (violet, teal, amber, sea blue) each have a bar color and a darker or
  lighter `-text` variant that clears 4.5:1. Each product card shows that product's own mark beside its name, carried
  in the stylesheet as a data URI (Markset's and Intentset's from their sites, Streamlane's tiles from its brand package,
  the ink tile in light and the light tile in dark, as that guide says; Driftline's drawn 2026-10-03 for this page, until
  Driftline has a repository to own it); refresh them there when a product's mark changes.

## Hosting

Until the cutover: GitHub Pages, decided earlier on 2026-10-04 (#11), like markset.org and intentset.org. `homepage` in
`package.json` (the canonical URL) is `https://coralreefventures.com/`, and the build writes `dist/CNAME` from its host,
which is what tells Pages the custom domain (a test holds it). DNS is at the registrar (dnsowl, NameSilo) today.

After it, ADR 0001: the CRV app on the Amplify `WEB` app `coral-reef-site` in the coral-reef project (us-east-2), with
`coralreefventures.com` in a Route 53 zone in the project and every existing record copied, Workspace mail included.
`apps/web/hosting/` holds the build spec, headers and rules, applied with `update-app`.

## Open launch decisions

From the requirements' launch gates, not yet settled:

- The door copy, the privacy page with its retention periods, the invitation text and requirements v0.2, all proposed
  in `docs/requirements/` (P8, before the cutover).
- Whether the product repositories stay public (plan decision D1, before the lock): the door locks the sites, not the
  source.
- Brand assets: the mark exists (`site/icon.svg`); there is no social image, so the social card is text only.
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
