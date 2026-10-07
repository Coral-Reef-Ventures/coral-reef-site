# 0001. coralreefventures.com becomes the door, and the app behind it

Date: 2026-10-04. Status: accepted (Gary, 2026-10-06; the door copy it goes with was approved 2026-10-05). Amended
2026-10-06: the product repositories are private, and the family stance governs publishing them; see "Amendment:
the product repositories (2026-10-06)".

Supersedes, for hosting and for CRV-007: the GitHub Pages hosting decided earlier the same day (#11).

## Context

Gary decided on 2026-10-04 to put a locked door in front of the public product sites. These decisions were asked and
answered that day:

- **Scope.** streamlane.app and driftline.app go behind the door. markset.org and intentset.org stay open, because they
  are open source and their published packages link to their docs. coralreefventures.com is the door.
- **A real lock.** A locked site's pages are not served at all without a signed-in invitee, and that includes its
  scripts, images and social cards. The product sites' hosting may change to make this possible.
- **One door.** Both product domains send visitors to coralreefventures.com. It has one interest form for anyone who
  wants to contribute (funding, design partner, advisor or other), and one Google sign-in that opens every site the
  person was invited to.
- **A system of record.** coralreefventures.com becomes a Next.js and Mantine app on Amplify Gen 2 in the coral-reef
  project (us-east-2), with Cognito and DynamoDB, as the products have. It records interest, invitations, access and
  sign-ins now. It is meant to grow into the CRM, licence management (ADR 0017's keys) and Stripe billing, without a
  rewrite.

The constraints that shaped the design:

- **AWS project rules:** every Regional resource in us-east-2; nothing in us-east-1 except WAF and Logs where a global
  resource needs them; no Lambda@Edge.
- **Amplify lessons:** a static export runs on platform `WEB`; build spec, headers and rules are applied with
  `update-app`; the amplify tsconfig is self-contained.
- **Family rules:** the reef shell and packages where they fit; no trackers or third-party scripts; copy is approved
  text.
- **The family source licence** is with counsel, so the CRV app builds its own small auth on `defineAuth` and copies
  nothing from the products.

Three facts found on 2026-10-04 shaped the choices:

- Amplify Hosting documents Next.js support only for versions 12 to 15, and both sites run 16.3.6.
- Amplify lists "running middleware on static assets and optimized images" as unsupported.
- Both product apps cache with `AMPLIFY_MANAGED_NO_COOKIES`, which leaves cookies out of the CDN cache key.

## Decision

**The door is a static app.** The CRV app is a Next.js static export on an Amplify `WEB` app named `coral-reef-site`.

- Its backend is Amplify Gen 2 in us-east-2.
- The browser signs in with Cognito's managed login and Google as the only provider, using the prefix domain
  `crv-door.auth.us-east-2.amazoncognito.com`. A custom auth domain would need a certificate in us-east-1.
- Tokens stay in browser storage, so coralreefventures.com sets no cookie.
- The door's copy is Markset (`apps/web/content/door.md`, and `get-involved.md` for the form and the sign-in, which
  have their own page at `/get-involved/` since 2026-10-05) from approved text, rendered at build.
- The page loads nothing from another origin except the AWS endpoints the form and sign-in call.

**Invite-only sign-in, bound to an identity.** Two Cognito triggers enforce it:

- Pre sign-up refuses password sign-up. It admits a federated first sign-in only for a verified email whose invitation
  is still pending. An accepted invitation already belongs to someone, so it admits nobody new. Anyone else gets
  `NOT_INVITED`, so no account is created for a stranger, and the door then offers them the interest form, prefilled.
- Pre token generation runs before every token, refresh included. On the first sign-in it accepts the pending
  invitation and binds it to that Cognito username, Cognito `sub` and Google `sub`, in one conditional transaction, so
  only one identity can win an address. After that it admits only that identity, and only while the invitation is
  accepted and Google still reports the bound email. Ticket issuance checks the same binding.
- There is no post confirmation trigger. Cognito does not document it for federated or admin-created users, which is
  every door user.
- A changed Google address, or an address reissued to someone else, is refused until an admin rebinds the invitation:
  either to the new address with the same identity, or cleared so the next first sign-in binds afresh. Clearing
  deletes the old Cognito user, and leaves a revoked invitation revoked until it is restored.

The triggers sit in Amplify's `auth` resource group and reach data only through `allow.resource` and the data client,
calling trigger-only operations on the access function. Amplify creates that access policy in the data stack and passes
the API endpoint through SSM at runtime, so every dependency points from data to auth and the nested stacks have no
cycle.

`CRV_ADMIN_EMAILS` (gary@coralreefventures.com) is admitted and made an admin without an invitation, and bound like any
other at first sign-in. If the invitation table cannot be read at all, it is still admitted. That is the one break-glass
path, and it is recorded here as such.

**The lock is a gate that serves every byte.**

- Each product site stays a static export. A dependency-free Node server, the gate, is bundled with it into Amplify's
  deployment specification (`.amplify-hosting/compute/default`).
- The deployment manifest has one route, `/*` to Compute, and no Static route, so no file reaches a visitor except
  through the gate.
- The product apps move to `WEB_COMPUTE` with the cache type `AMPLIFY_MANAGED` (cookies in the key). Every gated
  response is `private`, and pages are `no-store`.
- This deliberately departs from the "WEB for static export" lesson, and the reasons are specific. Amplify never runs
  Next. The bundle is a few megabytes. The build caches `.next/cache` only, never `node_modules`. The out-of-memory
  failure came from a stub build spec on a Next detection, which this layout doesn't have.
- The domains, certificates and Route 53 zones stay where they are.
- The gate and its packager (`reef-door-bundle`) live in reef's `@coralreefventures/site-tools`. They are MIT, take
  only data, name no product, and both products use them.

**One session per domain, minted by the door.**

1. Without a valid cookie, a navigation gets a 302 to the door. Everything else gets a 401 with no body.
2. Before redirecting, the gate sets a 10-minute state nonce cookie.
3. After sign-in, the door asks the backend for a ticket. The backend checks an active grant for that exact host and
   signs an ES256 JWS with a KMS key in us-east-2 (`alias/crv-door-signing`). The private key never leaves KMS.
4. The door posts the ticket to `https://<host>/_door` in a form body. It never travels in a URL.
5. The gate verifies the ticket with the public key alone: issuer, audience equal to the host, expiry no more than an
   hour away, and the state nonce. It then sets `__Host-crv_door` (Secure, HttpOnly, SameSite=Lax, one hour) and
   redirects to `next`. `next` is canonicalised by parsing it against the host, both when the ticket is issued and in
   the gate: it must keep the same origin, it is re-serialised as path and query, and backslashes and control
   characters are refused. A prefix check alone would let `/\evil.com` or a tab-split path leave the site.
6. When the cookie expires, the bounce through the door is silent while the Cognito session lives.
7. The gate refuses any Host not on its allowlist, answers `robots.txt` with `Disallow: /`, marks everything
   `noindex`, and fails closed on any error.

**The public key** reaches the gates as a JWKS file the CRV build writes. Its frontend phase runs
`aws kms get-public-key`, with the build role granted `kms:GetPublicKey` in the key's own policy, and converts the
base64 DER to a JWK, failing unless the key is P-256. Each product build fetches that file.

**Revocation.**

- Revoking in the admin view marks the invitation and grants revoked, signs the bound Cognito user out everywhere, and
  disables it. No new token or ticket can be issued, because both require an accepted invitation bound to the caller.
- A site cookie already issued lives at most one hour.
- Rotating the KMS key and rebuilding both product apps ends every session in about five minutes.

**Data.** There is one Amplify backend now. The areas are folders and Intentset slice domains: `people`, `interest` and
`access`. The rules that let later areas join without a rewrite:

- People is the spine: `Person`, a conditionally claimed `PersonEmail` so each address belongs to one person, and one
  `Activity` timeline (area, kind, subject).
- `AccessGrant` holds a typed resource (`site:streamlane.app` now; `workspace:<orgId>` or `licence:<id>` later). It is
  the one place access is decided.
- Each model and operation is declared once.
- Areas refer to each other by id only, never by a schema relationship.
- No scans.
- A CRM, licensing or billing area adds its own tables and Activity kinds. When the backend nears CloudFormation's
  limits, an area moves to its own backend behind a Merged API (Intentset profile §9) without a schema change.
- An interest submission is unverified, so it stays out of the spine. It creates no person and claims no address
  until an admin invites.
- Every model has a retention period, which the privacy page quotes. Declined or archived submissions go 12 months
  after the decision. People whose invitation is revoked or never accepted go 12 months later, through a daily sweep
  that also deletes their Cognito user. Ticket records go after 90 days and sign-in records after 12 months. A refused
  sign-in is never stored with an address. Logs are kept for one month and never hold a body, an address, a cookie or a
  token. Admins can delete a person, or erase every record of an address someone else submitted.
- Erasure reaches every Cognito user the app created for an address. Pre sign-up records each username it admits on
  the invitation before Cognito creates the user, and erasure and the sweep delete each one. The access function also
  deletes at once an unbound user that pre token generation refuses, such as the losing identity of two that share an
  address.
- The `admins` group follows `CRV_ADMIN_EMAILS`: pre token generation leaves it out of the token of an address taken
  off the list, and crv-access takes that user out of the group.
- On the branch, every model table is retained, with deletion protection, so removing the branch's backend leaves
  production data in place. A sandbox's tables go with it.

**The interest form** is a guest mutation on the app's AppSync API, through the identity pool's unauthenticated role,
behind a regional WAF web ACL in us-east-2 with per-IP rate rules. The handler also limits each source and each address
with DynamoDB counters. Its hash keys are random, made daily, and gone after 48 hours. Nothing reserves Lambda
concurrency: the project's limit is 10, which allows no reservation, so an increase is requested instead.

**Notification.** A new submission is written first. Then it is published to an SNS topic with an email subscription
to hello@coralreefventures.com, at most 10 notices a day. The notice is plain text: the admin link comes from a
configured origin, never from the request, and the visitor's name and address are marked as unverified. The message
itself is not sent. That needs no SES identity, no DNS records and no request to leave the SES sandbox. Invitations are
sent from Gary's own mail, using text the admin view prepares, until the app sends them through SES.

**DNS.** coralreefventures.com moves from dnsowl (NameSilo) to a Route 53 zone in the project, with every existing
record copied, including Google Workspace mail. NameSilo has no ALIAS record, and the apex carries MX and SPF, so it
can't be a CNAME. Amplify then manages the apex and `www`. streamlane.app and driftline.app are already delegated to
Route 53 in the project and need no change. Done 2026-10-05: the zone is `Z1017162VVBRZ8PDRIQ3`, and the app has served
coralreefventures.com since 10:47 CDT that day.

**Requirements.** CRV-001 and CRV-003 are amended. CRV-007 is superseded by:

- CRV-009: the interest form;
- CRV-010: invite-only Google sign-in;
- CRV-011: no tracking, no external font, no third-party script, a privacy page;
- CRV-012: the admin views;
- CRV-013: the notification;
- CRV-014: the lock.

The products' "no cookies" rule becomes "no trackers, and two cookies, both the door's".

**Intentset.** The app carries a draft Intentset model: PRD-CRV, two intents, two outcomes with measures, four
capabilities, behaviors that each state their failure response, five rules and five slices. Its rule that gated
responses are never shared-cacheable is verified by a leak check. The check runs daily and after every product deploy,
and requests every file of each locked site on every host with no cookie, with a session, and again with no cookie.

## Rejected

- **Next.js middleware on Amplify's managed Next.js hosting.** Amplify doesn't run middleware on static assets and
  optimized images, so client chunks (which carry copy and prices) and social cards would be served to anyone. It also
  supports Next only up to 15.
- **A Next.js standalone server on the deployment specification.** It locks every byte too, but it puts Next 16's
  request handling on an unsupported host. It brings cold starts and the memory-heavy build back to sites that are
  static exports. And it makes the lock depend on framework middleware, which has a history of bypass bugs.
- **Our own CloudFront distribution with a CloudFront Function and KeyValueStore.** It is the strongest lock in
  principle, but CloudFront takes certificates only from ACM in us-east-1, which the project's written rule doesn't
  allow without an exception. It also needs S3, a second deploy path, and a shared HMAC secret in every gate. Revocation
  through KeyValueStore from a us-east-2 Lambda needs SigV4A, whose treatment by the project's SCP is undocumented.
- **A ticket in the URL redeemed server to server.** It works, but it needs a ticket table and a redemption endpoint.
  A ticket in a URL can also reach history, Referer headers and logs. A form POST has none of these.
- **SES for the notice now.** It needs DKIM records before the zone is in Route 53, and production access before it
  can mail invitees. Both are deferred until the app sends invitations itself.
- **A CDK `AwsCustomResource` that reads the public key.** Its handler (aws-cdk-lib 2.266.0) decodes every binary
  response field as UTF-8, which corrupts a DER key beyond recovery.
- **A Lambda function URL with auth NONE for the form.** It accepts any caller, CORS stops only browsers, and the
  reserved concurrency that was meant to cap it cannot be set in this project. Putting CloudFront and a WAF in
  us-east-1 in front of it is allowed by the project rules, but needs a second entry point and signed POST bodies. A
  guest mutation behind a regional WAF keeps everything in us-east-2 and in the one API.
- **Binding an invitation to an email address alone.** An address can be reissued, or a domain re-registered, and its
  new holder would inherit the person and their grants.
- **Cognito triggers in the data resource group.** The user pool's trigger configuration and AppSync's user-pool
  authorization would make the auth and data stacks depend on each other.
- **Making the product repositories private.** It isn't decided here, and it is not part of the lock. The repositories
  are private, so their copy and prices are not readable on GitHub either, but that is not the door's doing: the door
  locks the sites, not the source. When the source is published is the family's decision ("Amendment: the product
  repositories (2026-10-06)").

## Consequences

- **Locked sites serve only to invitees.** Search engines see `Disallow` and `noindex`. Shared links lose their
  previews. Copies crawled or archived before the lock stay where they are unless removal is requested.
- **The product apps run on Amplify compute.** Every asset is a compute request: cents a month, plus a cold start on
  the first request after idle. Rolling a site back to `WEB` re-exposes it, so it is an emergency move, written to
  Activity as a decision (`door.unlocked`) and never done silently.
- **Revocation can take up to an hour.** A revoked invitee keeps a site open for at most an hour, and key rotation is
  the immediate kill.
- **An invitee whose Google address changes is locked out until an admin rebinds them.** That is the price of not
  letting an address carry access by itself.
- **The WAF web ACL is the largest line in the bill,** about $7 of roughly $10–11 a month.
- **Until the Lambda concurrency increase is granted,** the project's ten execution slots are shared by every function,
  so a burst that gets past WAF can slow or fail sign-in. Alarms on throttles report it.
- **Gary is the door's only admin, through `CRV_ADMIN_EMAILS`.** If the invitation records break, that address still
  gets in.
- **coral-reef-site gains a workspace, a backend and dependencies** (approved by Gary on 2026-10-04). Its "one script,
  no form" rule now applies only to the retired Pages page, which is deleted 14 days after the cutover (2026-10-05), on 2026-10-19.
- **New offerings join by configuration.** A locked offering added later is one entry in the door's site registry and
  one `reef-door-bundle` line in its build. An open one needs neither.

## Amendment: the product repositories (2026-10-06)

The bullet under "Rejected" said the product repositories' copy and prices "remain readable on GitHub". They are not:
Driftline's repository has been private since it was created on 2026-10-03, and both repositories are private in the
Coral-Reef-Ventures organization on GitHub Team, which Streamlane's moved to on 2026-10-04 (Streamlane #312). No reason
for making them private was recorded. The bullet is corrected above.

Gary decided the family's stance on 2026-10-06: the working repositories stay private. Each product is published from a
new public repository with a squashed root commit at its first release, once counsel has finished the licence, the
free-use terms are settled, and the CLA and trademark search are done. Publishing is a recorded decision, dated in that
product's README.md.

This changes nothing in the door. It locks the sites, not the source, and publishing a product's source is not a
condition for lifting a site's lock. Each is a recorded decision of its own: unlocking is `door.unlocked` in Activity,
with a reason, and publishing is the dated line in the README.
