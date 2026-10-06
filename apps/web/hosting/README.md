# Hosting the Coral Reef Ventures app

The app (`apps/web`) is a static export (`apps/web/out`) served by its own Amplify Hosting app, with its backend (the
repository's `amplify/` folder) deployed by the same build. Both build from this repository, so nothing here may live
at the repository root: Amplify applies a root `amplify.yml` or `customHttp.yml` to every app connected to the
repository. These files are applied to this app only:

| File | What | Applied with |
| --- | --- | --- |
| `build-spec.yml` | Deploy the backend, build `apps/web`, publish the door's public key, publish `out` | `--build-spec` |
| `custom-headers.yml` | Security headers, a content security policy that names only this app and its AWS endpoints, and immutable caching for hashed assets | `--custom-headers` |
| `custom-rules.json` | `www` to the apex, and the 404 page | `--custom-rules` |

The design is in `docs/decisions/0001-the-door-and-the-app.md`. The app is `coral-reef-site`, id `d1fw6blayytium`,
branch `main`. It has served `coralreefventures.com` (apex and `www`) since 2026-10-05 10:47 CDT, and still answers at
`https://main.d1fw6blayytium.amplifyapp.com`.

The account is the `coral-reef` project, pinned to us-east-2: use the `coral-reef` CLI profile
(`aws login --profile coral-reef`), which sets the region. Every Regional resource lives in us-east-2, and the policy
in `custom-headers.yml` names that region's endpoints.

## What has to exist first

1. **The Amplify GitHub App** (`https://github.com/apps/aws-amplify-us-east-2`) installed on the Coral-Reef-Ventures
   organization with this repository granted, so Amplify reads the repository through the app. The organization has
   deploy keys disabled (`Deploy keys are disabled for this repository`, Driftline, 2026-10-03).
2. **The IAM service role `crv-amplify-backend-deploy`**, with the managed policy `AmplifyBackendDeployFullAccess` and
   Amplify as its trusted service. The backend's KMS key policy grants this role `kms:GetPublicKey`, which is how the
   build reads the door's public key; the role's name reaches the backend as `CRV_BUILD_ROLE_NAME`.
3. **`crv-door` free as a Cognito domain prefix.** It is fixed in code, so the Google OAuth client can be set up before
   anything is deployed.

## Creating the app (once)

**Connect the repository in the console, then configure the app with the CLI.** The CLI route was tried first:
`create-app --repository ... --access-token` fell back to Amplify's legacy integration, which clones with a deploy key,
and the organization disables deploy keys. The console connects through the GitHub App.

1. Console, Amplify, **Create new app**, GitHub, `Coral-Reef-Ventures/coral-reef-site`, branch `main`, monorepo root
   `apps/web`, app name `coral-reef-site`. Take whatever build settings it proposes; the next step replaces them.
2. Correct and complete it with `update-app`. The console detects Next.js and sets the platform to `WEB_COMPUTE`, the
   mode for server-rendered Next.js; this app is a static export and the platform must be `WEB` (Driftline,
   2026-10-04: in the other mode the build caches `node_modules` and never finds `out/`).

```sh
APP_ID=d1fw6blayytium
ROLE_ARN=$(aws iam get-role --role-name crv-amplify-backend-deploy --query Role.Arn --output text)

aws amplify update-app --app-id "$APP_ID" --platform WEB --iam-service-role-arn "$ROLE_ARN" \
  --build-spec file://apps/web/hosting/build-spec.yml \
  --custom-headers file://apps/web/hosting/custom-headers.yml \
  --custom-rules file://apps/web/hosting/custom-rules.json \
  --cache-config type=AMPLIFY_MANAGED_NO_COOKIES \
  --environment-variables file://env.json
```

`env.json` is a JSON object of every variable in the table below, written outside the repository. **A file, not the
shorthand** (`KEY=value,KEY=value`): the shorthand splits on commas, and `CRV_AUTH_CALLBACK_URLS` is a comma-separated
list, so its URLs after the first would be read as malformed keys. `update-app --environment-variables` replaces the
whole set, so the file always holds every variable; start it from the current set:

```sh
aws amplify get-app --app-id "$APP_ID" --query app.environmentVariables > env.json
```

The branch is `PRODUCTION`, with auto build on (the first build ran with `start-job --job-type RELEASE` once the
secrets existed). Auto branch creation and pull request previews stay off.

### Environment variables

| Variable | Value | Read by |
| --- | --- | --- |
| `AMPLIFY_MONOREPO_APP_ROOT` | `apps/web`, which must equal `appRoot` in `build-spec.yml` and `custom-headers.yml` | Amplify |
| `CRV_AUTH_DOMAIN_PREFIX` | `crv-door`, giving `crv-door.auth.us-east-2.amazoncognito.com` | the backend, at synth |
| `CRV_AUTH_CALLBACK_URLS` | the app's `/signed-in/` and `/signout/done/` URLs, comma separated, on every origin that serves the app: today `https://main.d1fw6blayytium.amplifyapp.com` and `https://coralreefventures.com` (`www` redirects to the apex, so it needs none) | the backend, at synth |
| `CRV_ADMIN_EMAILS` | the break-glass admins' addresses | the backend, at synth |
| `CRV_ADMIN_ORIGIN` | `https://coralreefventures.com` since the cutover (2026-10-05). A constant, never taken from a request, because the notification links to it | the backend, at synth |
| `CRV_BUILD_ROLE_NAME` | `crv-amplify-backend-deploy`; unset in a sandbox | the backend, at synth |
| `CRV_DOOR_TEST_HOSTS` | empty, except while a locked site is being tested on a temporary host | the backend, at synth |

### Secrets

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set once, on the Amplify app for all branches: console, **coral-reef-site**,
Hosting, Secrets, Manage secrets. They are the Google Cloud OAuth client's, and they are not environment variables. The
client's authorized redirect URI is `https://crv-door.auth.us-east-2.amazoncognito.com/oauth2/idpresponse`, and its
authorized JavaScript origin is `https://crv-door.auth.us-east-2.amazoncognito.com`. An agent's sandbox runs with
placeholder secrets and never signs in with Google.

## After changing a file here

Apply it again to the app; the files are not read from the repository on their own:

```sh
aws amplify update-app --app-id "$APP_ID" --build-spec file://apps/web/hosting/build-spec.yml
aws amplify update-app --app-id "$APP_ID" --custom-headers file://apps/web/hosting/custom-headers.yml
aws amplify update-app --app-id "$APP_ID" --custom-rules file://apps/web/hosting/custom-rules.json
```

## The custom domain

`coralreefventures.com` is a Route 53 zone in the same project, `Z1017162VVBRZ8PDRIQ3`, and NameSilo, the registrar,
points its nameservers at it. Every record NameSilo held was copied in first, Google Workspace's MX, SPF and DKIM and
Google's verification CNAME among them, so mail did not notice the switch.

The domain was added in the console (**coral-reef-site**, Hosting, Custom domains, Add domain), apex and `www` to
`main`, with an Amplify-managed certificate. Because the zone is in the same project, Amplify writes its own records:
the apex ALIAS and the `www` CNAME to its CloudFront distribution, replacing the GitHub Pages A records and `www`
CNAME, and the certificate's validation CNAME. Leave those three to Amplify. `www` reaching the apex is
`custom-rules.json`'s first rule, not DNS.

```sh
aws amplify get-domain-association --app-id "$APP_ID" --domain-name coralreefventures.com \
  --query domainAssociation.domainStatus
```

answers `AVAILABLE` when it is set up.

## What the build does

1. **Backend phase.** Moves to the repository root, installs with the frozen lockfile and runs `ampx pipeline-deploy`,
   which deploys `amplify/` and writes `amplify_outputs.json` into `apps/web`. The service role is what lets it.
2. **Frontend phase.** Builds the static export with `pnpm --filter @crv/web build`, then reads the door key's ARN and
   id from the outputs (`custom.doorKeyArn`, `custom.doorKid`) and pipes `aws kms get-public-key --query PublicKey
   --output text` (base64 DER) into `apps/web/scripts/door-jwks.mjs`, which writes
   `out/.well-known/crv-door-jwks.json` and fails the build unless the key is EC on P-256. The script takes the
   public key on standard input and the key id in `DOOR_KID`. The locked product sites fetch that file at their own
   builds. It is not an `AwsCustomResource`, whose handler decodes binary fields as UTF-8 and would corrupt a DER key.
3. **Artifacts** are `out` and the cache is `.next/cache/**/*` only, never `node_modules`.

Both phases begin with `cd "$(git rev-parse --show-toplevel)"`, because the backend is at the repository root and the
app is in `apps/web`, and a build must not depend on the directory Amplify happens to start in. **First-deploy check:**
that `amplify_outputs.json` lands at `apps/web/amplify_outputs.json`, and that `oauth.domain` in it is
`crv-door.auth.us-east-2.amazoncognito.com`.

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

**By hand,** after every product deploy and each flip: `AWS_PROFILE=coral-reef AWS_CLI=~/.local/bin/aws pnpm run
leak-check --site driftline`. `--no-session` needs no AWS at all and runs every check that does not need a session.

**In CI,** `.github/workflows/leak-check.yml` runs daily at 11:23 UTC and by hand (Actions, "Leak check", with an
optional site and test host). It is a workflow of its own so a locked site's state never fails a pull request. With the
repository variable `CRV_LEAK_CHECK_ROLE_ARN` it assumes that role over GitHub's OIDC; without it, it runs with
`--no-session` and warns.

**The role CI needs (not created yet).** In the coral-reef project, us-east-2:

1. An IAM OIDC identity provider for `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
   **The project's SCP denies it.** `iam:CreateOpenIDConnectProvider` was refused with an explicit deny in a service
   control policy (`p-8r7znzr8`) on 2026-10-06, as `iam:GetOpenIDConnectProvider` and `iam:ListOpenIDConnectProviders`
   were on 2026-10-05. AWS's published project SCPs deny `iam:*Provider*`, and only activating advanced features in
   AWS Settings (Projects, Actions, Explore advanced features) hands the SCPs to the owner. That is Gary's decision: it
   cannot be undone and it removes the spend limit. Until then CI runs without a session and the authenticated half is
   run by hand after each product deploy. A long-lived access key in GitHub would avoid the provider, and is not used.
2. A role, `crv-leak-check`, with this trust policy, so only this repository's `main` (the schedule and a manual run)
   can assume it:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::865000063691:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": {
           "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
           "token.actions.githubusercontent.com:sub": "repo:Coral-Reef-Ventures/coral-reef-site:ref:refs/heads/main"
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
         "Resource": "arn:aws:amplify:us-east-2:865000063691:apps/d1fw6blayytium/branches/main" },
       { "Sid": "ReadItsOutputs", "Effect": "Allow", "Action": "cloudformation:DescribeStacks",
         "Resource": "arn:aws:cloudformation:us-east-2:865000063691:stack/amplify-d1fw6blayytium-main-branch-*/*" },
       { "Sid": "TheInviteesPassword", "Effect": "Allow", "Action": "cognito-idp:AdminSetUserPassword",
         "Resource": "arn:aws:cognito-idp:us-east-2:865000063691:userpool/us-east-2_rKIikq747" }
     ]
   }
   ```

   No `lambda:InvokeFunction` on crv-access and no AdminCreateUser or AdminDeleteUser: the role cannot invite,
   erase or create anyone, which is an admin's job. The sign-in and the ticket need no IAM: they are Cognito's public
   calls and the API with the invitee's own token. A replaced user pool changes the last ARN.
4. Set the repository variable (not a secret; it names a role, it grants nothing alone):
   `gh variable set CRV_LEAK_CHECK_ROLE_ARN --repo Coral-Reef-Ventures/coral-reef-site --body arn:aws:iam::865000063691:role/crv-leak-check`,
   then run the workflow by hand once and read its log.

## Phase 3: status

Phase 3 locks driftline.app and then streamlane.app (the door plan's "Phase 3"). Checked 2026-10-06, about 06:30 CDT:

| Exit item | State | Evidence |
| --- | --- | --- |
| Both domains serve only to invitees | **Done** | Both apps are `WEB_COMPUTE` with the app root `apps/site-door` (driftline #16, streamlane #348: from an app root whose `package.json` uses Next.js, Amplify runs its own Next.js deployment and refuses the gate's, which failed driftline's first three builds). driftline.app was locked by Amplify job 28 (driftline cb030f8), streamlane.app by job 21 (streamlane 49eb5da), both 2026-10-06. A page load answers the coming-soon page as a 401 with `no-store` and `noindex`; anything else gets an empty 401. Each compute log group keeps 30 days. |
| The leak check is green on every host and scheduled daily | **Green; daily without a session** | `pnpm run leak-check --site <id>`, 2026-10-06, signed in as `crv-check@example.com`: driftline 280 requests (53 paths), streamlane 470 requests (91 paths), clean on the apex, `www` and the amplifyapp.com host. Both are `locked` in `scripts/leak-check/sites.ts`, so the daily run checks both, without a session until the role `crv-leak-check` exists. |
| Both `amplifyapp.com` hosts return 403 | **Done** | `main.d39wmoekppxvpd.amplifyapp.com` and `main.d32jlosp0d9m43.amplifyapp.com` answer 403; `www` on each redirects to the apex before the gate. |
| The temporary apps are deleted | **Not applicable** | None was created: `create-app` falls back to deploy keys, which the organization disables. |
| The door cards are updated | **Done, ahead of the lock** | The Streamlane and Driftline cards have read "Open to invited guests." since the cutover (CRV-003 v0.2, `apps/web/lib/products.ts`). |

What is left:

1. The role `crv-leak-check` (above), so the daily run has a session. It waits on the project's SCP, which denies
   the OIDC provider it needs (2026-10-06): only activating advanced features lifts that, which is Gary's decision.
2. `crv-check@example.com` stays: the by-hand check after each product deploy signs in as it, and the daily run will
   once the role exists.

## Rollback

**There is no Pages site to go back to.** The GitHub Pages page was deleted and Pages turned off in Phase 2c
(2026-10-06), so a rollback of the domain is a redeploy of an earlier commit of this app (Amplify's console, the branch's
deployments), not a move to another host. NameSilo still holds its old records, which point at GitHub Pages and would
now serve nothing.

**The app.** Deleting it (`aws amplify delete-app --app-id "$APP_ID"`) and the backend stacks it deployed takes
coralreefventures.com, the door and the locked sites' sign-in down with it, so it is only for retiring the site. The KMS key and the six model tables
(people, addresses, Activity, submissions, invitations and grants) are retained when the stack is deleted, by design,
and the tables keep deletion protection. To remove them too, turn deletion protection off on each table
(`aws dynamodb update-table --table-name <name> --no-deletion-protection-enabled`), delete it, and schedule the key's
deletion, deliberately.
