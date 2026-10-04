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
  (markset.org, intentset.org, driftline.app); streamlane.app is a planned destination and renders as text, never as a link.
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
