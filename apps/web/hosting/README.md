# Hosting the Coral Reef Ventures app

The app (`apps/web`) is a static export (`apps/web/out`) with its backend (the repository's `amplify/` folder). Each
environment, dev, staging and prod, is an Amplify Hosting app with no repository connected, in its own account
(`environments.ts`; "The environment accounts", below), and `scripts/deploy.ts` deploys to it from
`.github/workflows/deploy.yml`. Prod's app, `coral-reef-site` (`d5rsxrpztyob9` in `crv-prod`), has served
`coralreefventures.com` and `www` since the cutover (2026-10-14, Streamlane's plan, step 8), and the domain's zone is
`Z0528736N9QND8UQUIJC` there. The files here:

| File | What | Used by |
| --- | --- | --- |
| `environments.ts` | Each environment's account, app, origin, sign-in address and backend settings (`backendSettings`) | `scripts/deploy.ts` |
| `custom-headers.yml` | Security headers, a content security policy that names only this app and its AWS endpoints, and immutable caching for hashed assets | `scripts/deploy.ts`, rendered for each environment by `renderHeaders`, then `update-app --custom-headers` |
| `custom-rules.json` | `www` to the apex, and the 404 page | `scripts/deploy.ts`, `update-app --custom-rules` |
| `build-spec.yml` | The build spec of the old, repository-connected app (History, below) | no environment's app; `hosting.test.ts` still reads it |

The design is in `docs/decisions/0001-the-door-and-the-app.md`. Every Regional resource lives in us-east-2, and the
policy in `custom-headers.yml` names that region's endpoints. The accounts are reached through one Identity Center
sign-in (`aws sso login --sso-session crv`); an agent deploys only its own sandbox, in `crv-sandbox`, and never to
dev, staging or prod.

## History

From 2026-10-05 10:47 CDT until the cutover the site was served by the Amplify app `coral-reef-site`
(`d1fw6blayytium`) in the old project account (865000063691, the `coral-reef` profile), connected to this repository
through the Amplify GitHub App and built by `build-spec.yml`, with its zone `Z1017162VVBRZ8PDRIQ3` there. At the
cutover the door's records were copied to prod's backend, and the identities bound in the old user pool bind again at
their first sign-in. The old zone was deleted and the account closed on 2026-10-16 (step 9), so nothing in it can be
reached; how that app was set up is in this file's history before that date.

## What a deploy does

`node scripts/deploy.ts <dev|staging|prod>`, run by the workflow with that environment's role, refuses any other
account, then:

1. **The backend.** `ampx pipeline-deploy` with the environment's settings (`backendSettings` in `environments.ts`,
   read and checked by `amplify/auth/settings.ts`), which writes `amplify_outputs.json` into `apps/web`; the outputs'
   `oauth.domain` is then pointed at the environment's own sign-in address.
2. **The export**, `pnpm --filter @crv/web build`, with the environment's own site hosts.
3. **The door's public key.** It reads the key's ARN and id from the outputs (`custom.doorKeyArn`, `custom.doorKid`)
   and pipes `aws kms get-public-key --query PublicKey --output text` (base64 DER) into
   `apps/web/scripts/door-jwks.mjs`, which writes `out/.well-known/crv-door-jwks.json` and fails unless the key is EC on
   P-256. The script takes the public key on standard input and the key id in `DOOR_KID`. The locked product sites
   fetch that file at their own builds. It is not an `AwsCustomResource`, whose handler decodes binary fields as UTF-8
   and would corrupt a DER key.
4. **The app's settings**: `update-app` with the platform `WEB`, the rendered headers, the rules and the cache type,
   then `out` zipped and uploaded with `create-deployment` and `start-deployment`.

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are each environment app's own Amplify secrets
(`/amplify/shared/<appId>/` in its account's Parameter Store), the Google Cloud OAuth client's; they are not
environment variables. An agent's sandbox runs with placeholder secrets and never signs in with Google.

## Notes

- Pages are directories (`/privacy/` is `privacy/index.html`), because `trailingSlash` is on, and every link ends in a
  slash.
- Amplify's `404` rule is a redirect, not a rewrite: a missing address answers 302 to `/404.html`, which serves with
  200 (Driftline, 2026-10-04). The 404 page carries `noindex`. The rule is acceptable here only because nothing this
  app serves is gated; the locked product sites remove theirs.
- The cache type `AMPLIFY_MANAGED_NO_COOKIES` is the default and is stated so that it is a decision. Nothing the app
  serves varies by cookie.
- Admin pages are static shells; what they show comes from AppSync, which authorizes every call.
- CloudWatch log groups of the backend's functions keep logs for one month, set in the functions' definitions.

## The leak check

`scripts/leak-check.ts` (`pnpm run leak-check`) proves CRV-014 on each locked site, on every host: the apex, `www`, the
product app's `main.<appId>.amplifyapp.com` and any temporary app's host. Without a session every path answers the
gate's coming-soon page (a 401, the same bytes for every path but the next in its sign-in link) or, for anything that
is not a page load, an empty 401, never a byte of the site; with a session it answers 200; asked again without one it
still gives nothing, which is the CDN cache check; `www` goes to the apex before the gate runs and the amplifyapp.com
host gets 403. Every gated answer must be `no-store` or `private` (RULE-GATED-NO-STORE) and carry `X-Robots-Tag:
noindex`. The paths are the live sitemap's pages, everything those pages reference (`/_next/static/**`, `/og/*.png`,
icons), and probes (`/404.html`, `/sitemap.xml`, `/index.txt`, a page that does not exist).

**Which sites.** The ones `locked: true` in `scripts/leak-check/sites.ts`, set in the change that records a flip;
`--site <id>` checks one before that. `--test-host <site>:<host> --only-test-hosts` checks a temporary app alone
(Phase 3, step 2), and the CRV app's `CRV_DOOR_TEST_HOSTS` must list the same host, or no ticket is issued for it.

**The session.** The check mints one the way an invitee gets one, as an invitee that already exists:
`crv-check@example.com` by default (invited to both sites from /admin/ on 2026-10-05, go-ahead §17b), or `--invitee`
/ `CRV_LEAK_CHECK_INVITEE`. **Inviting is an admin's job**, done by a person signed in to /admin/: the check makes no
admin call to the door, never invites, erases or creates anyone, and leaves the user in place afterwards. If the user is
missing or its invitation does not cover a checked site, the run fails at that step and an admin invites it again.

1. AdminSetUserPassword with a fresh random permanent password, passed to the CLI in a file only the run can read and
   deleted at once. It is never printed or kept; each run sets a new one.
2. USER_SRP_AUTH, the app client's one password flow, so pre token generation binds the invitation like any sign-in.
   Measured 2026-10-05 against the live pool: 2.3 s.
3. `issueSiteTicket` through the API with that user's token, for each gated host; the ticket is posted to the host's
   `/_door` with a matching state cookie, and the gate's 303 sets the session.

Revoking the invitee's invitation and deleting its Cognito user, when the checks no longer need it, are an admin's, from
/admin/.

**By hand,** after every product deploy and each flip, with credentials for prod, whose backend the session is minted
from: `AWS_PROFILE=crv-prod pnpm run leak-check --site driftline` (`AWS_CLI=<path>` if `aws` on the path is not the
one that reads the SSO login). `--no-session` needs no AWS at all and runs every check that does not need a session.

**In CI,** `.github/workflows/leak-check.yml` runs daily at 11:23 UTC and by hand (Actions, "Leak check", with an
optional site and test host). It is a workflow of its own so a locked site's state never fails a pull request. With the
repository variable `CRV_LEAK_CHECK_ROLE_ARN` it assumes that role over GitHub's OIDC; without it, it runs with
`--no-session` and warns.

**The role CI needs** (in `crv-prod` since the cutover, 2026-10-14; in the old project from 2026-10-06), us-east-2:

1. An IAM OIDC identity provider for `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`:
   the accounts' baseline makes it (`infra/accounts/`).
2. A role, `crv-leak-check`, with this trust policy, so only this repository's `main` (the schedule and a manual run)
   can assume it. The repository uses GitHub's immutable subject, which carries the owner's and the repository's ids
   (`repo:Coral-Reef-Ventures@337009897/coral-reef-site@1402479746:...`), so the policy names both forms; with only
   the plain one, the first run was refused at "Not authorized to perform sts:AssumeRoleWithWebIdentity".

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::027677878969:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": {
           "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
           "token.actions.githubusercontent.com:sub": [
             "repo:Coral-Reef-Ventures/coral-reef-site:ref:refs/heads/main",
             "repo:Coral-Reef-Ventures@337009897/coral-reef-site@1402479746:ref:refs/heads/main"
           ]
         }
       }
     }]
   }
   ```

3. This inline policy, and a maximum session of one hour:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Sid": "FindTheBackend", "Effect": "Allow", "Action": "amplify:GetBranch",
         "Resource": "arn:aws:amplify:us-east-2:027677878969:apps/d5rsxrpztyob9/branches/main" },
       { "Sid": "ReadItsOutputs", "Effect": "Allow", "Action": "cloudformation:DescribeStacks",
         "Resource": "arn:aws:cloudformation:us-east-2:027677878969:stack/amplify-d5rsxrpztyob9-main-branch-*/*" },
       { "Sid": "TheInviteesPassword", "Effect": "Allow", "Action": "cognito-idp:AdminSetUserPassword",
         "Resource": "arn:aws:cognito-idp:us-east-2:027677878969:userpool/us-east-2_PJsbzeVwo" }
     ]
   }
   ```

   No `lambda:InvokeFunction` on crv-access and no AdminCreateUser or AdminDeleteUser: the role cannot invite,
   erase or create anyone, which is an admin's job. The sign-in and the ticket need no IAM: they are Cognito's public
   calls and the API with the invitee's own token. A replaced user pool changes the last ARN.
4. Set the repository variable (not a secret; it names a role, it grants nothing alone):
   `gh variable set CRV_LEAK_CHECK_ROLE_ARN --repo Coral-Reef-Ventures/coral-reef-site --body arn:aws:iam::027677878969:role/crv-leak-check`,
   then run the workflow by hand once and read its log.

## Phase 3: status

Phase 3 locks driftline.app and then streamlane.app (the door plan's "Phase 3"). Checked 2026-10-06, about 06:30 CDT:

| Exit item | State | Evidence |
| --- | --- | --- |
| Both domains serve only to invitees | **Done** | Both apps are `WEB_COMPUTE` with the app root `apps/site-door` (driftline #16, streamlane #348: from an app root whose `package.json` uses Next.js, Amplify runs its own Next.js deployment and refuses the gate's, which failed driftline's first three builds). driftline.app was locked by Amplify job 28 (driftline cb030f8), streamlane.app by job 21 (streamlane 49eb5da), both 2026-10-06. A page load answers the coming-soon page as a 401 with `no-store` and `noindex`; anything else gets an empty 401. Each compute log group keeps 30 days. |
| The leak check is green on every host and scheduled daily | **Done** | `pnpm run leak-check --site <id>`, 2026-10-06, signed in as `crv-check@example.com`: driftline 280 requests (53 paths), streamlane 470 requests (91 paths), clean on the apex, `www` and the amplifyapp.com host. Both are `locked` in `scripts/leak-check/sites.ts`, and the daily workflow signs in through `crv-leak-check`: its first manual run on `main` (Actions run 37466471636, 2026-10-06) minted a session for both and was clean, 750 requests. |
| Both `amplifyapp.com` hosts return 403 | **Done** | `main.d39wmoekppxvpd.amplifyapp.com` and `main.d32jlosp0d9m43.amplifyapp.com` answer 403; `www` on each redirects to the apex before the gate. |
| The temporary apps are deleted | **Not applicable** | None was created: `create-app` falls back to deploy keys, which the organization disables. |
| The door cards are updated | **Done, ahead of the lock** | The Streamlane and Driftline cards have read "Open to invited guests." since the cutover (CRV-003 v0.2, `apps/web/lib/products.ts`). |

Phase 3 is complete (2026-10-06). `crv-check@example.com` stays: the daily run and the by-hand check after each
product deploy sign in as it.

## Rollback

**There is no Pages site to go back to.** The GitHub Pages page was deleted and Pages turned off in Phase 2c
(2026-10-06), so a rollback of the domain is a redeploy of an earlier commit to prod (the deploy workflow's `ref` input, started by
Gary), not a move to another host. NameSilo still holds its old records, which point at GitHub Pages and would
now serve nothing.

**The app.** Deleting prod's (`aws amplify delete-app --app-id d5rsxrpztyob9 --profile crv-prod`) and the backend
stacks it deployed takes coralreefventures.com, the door and the locked sites' sign-in down with it, so it is only for retiring the site. The KMS key and the six model tables
(people, addresses, Activity, submissions, invitations and grants) are retained when the stack is deleted, by design,
and the tables keep deletion protection. To remove them too, turn deletion protection off on each table
(`aws dynamodb update-table --table-name <name> --no-deletion-protection-enabled`), delete it, and schedule the key's
deletion, deliberately.

## The environment accounts

Since 2026-10-12 the app has dev, staging and prod in their own accounts (Streamlane ADR 0087,
`infra/accounts/README.md`): Amplify apps with no repository connected, listed in `environments.ts`, and deployed by
`.github/workflows/deploy.yml` through `scripts/deploy.ts` ("What a deploy does", above). Each app's
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` were copied from the old app's when the environments were made, so the
one Google client must allow each environment's sign-in address (below). Dev deploys on every push to main, staging
nightly, and prod only when Gary starts it. Prod has served coralreefventures.com since the cutover (2026-10-14).

### The sign-in address

Since 2026-10-14 each environment signs in at its own address under coralreefventures.com, a Cognito custom domain
beside the prefix one: `auth-dev.coralreefventures.com`, `auth-staging.coralreefventures.com` and
`auth.coralreefventures.com` (`signInDomain` in `environments.ts`). Google then counts one authorized domain,
coralreefventures.com, for all three, where each prefix domain counted as its own. Each name's parent is
coralreefventures.com, which already resolves, as Cognito requires of a custom domain's parent. `scripts/deploy.ts`
points the outputs' `oauth.domain` at it, and the headers name it in place of the hosted UI.

Made once per environment, by hand:

1. **The certificate**, in us-east-1 in the environment's account (Cognito's CloudFront requires it), validated by a
   CNAME in prod's zone `Z0528736N9QND8UQUIJC`. All three were issued on 2026-10-14.
2. **The Google client's redirect URI**, `https://<address>/oauth2/idpresponse`, before the first deploy that carries it.
3. **The alias**, after that deploy has created the domain: an A record for the address in prod's zone, aliased to the
   distribution `aws cognito-idp describe-user-pool-domain --domain <address>` reports (hosted zone `Z2FDTNDATAQYW2`).
   Until it exists, sign-in in that environment fails.

### Each environment's address

Each environment answers at its own name under each domain, as prod does at the domain itself. The door is at
`dev.coralreefventures.com` and `staging.coralreefventures.com`, Streamlane's site at `dev.streamlane.app` and
`staging.streamlane.app`, and Driftline's at `dev.driftline.app` and `staging.driftline.app` (since 2026-10-16 and
2026-10-17). Before that, dev and staging answered only at their Amplify addresses. `environments.ts` names the door's
`origin` and each site's host. The sites' own `apps/site/hosting/environments.json` names the door they are locked
behind and their own host.

Streamlane's dev and staging zones are their own accounts' (its `apps/site/hosting/claim-apex.sh`).
coralreefventures.com and driftline.app have one zone each, in prod. So `claim-env-domains.sh` adds an environment's
names to its door's and its Driftline site's Amplify apps, once, signed in to that environment's account and to prod's.
It writes the certificate and address records Amplify asks for into prod's zones, and waits until both are available.
Run it before the change that names the addresses merges. Each door then signs its tickets as its new origin, and the
sites follow on their own next deploys: until a site has deployed, its sign-in in that environment fails.

```sh
apps/web/hosting/claim-env-domains.sh dev
apps/web/hosting/claim-env-domains.sh staging
```
