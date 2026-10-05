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

## Rollback

**The domain, back to GitHub Pages** (deployed until 2026-10-19):

1. `aws amplify delete-domain-association --app-id "$APP_ID" --domain-name coralreefventures.com`, which removes the
   records Amplify wrote.
2. In the Route 53 zone, put back the GitHub Pages records: the apex A records (`185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153`) and the `www` CNAME `coral-reef-ventures.github.io`.
3. In the repository's Pages settings, set the custom domain to `coralreefventures.com` again.

NameSilo still holds the old records, so setting its nameservers back to its own is the other way, and the slower one.
Either way, set `CRV_ADMIN_ORIGIN` back to `https://main.d1fw6blayytium.amplifyapp.com` and redeploy, so the
notification's admin link reaches the app.

**The app.** Delete it (`aws amplify delete-app --app-id "$APP_ID"`) and the backend stacks it deployed, only after the
domain has gone back to Pages. The KMS key and the six model tables
(people, addresses, Activity, submissions, invitations and grants) are retained when the stack is deleted, by design,
and the tables keep deletion protection. To remove them too, turn deletion protection off on each table
(`aws dynamodb update-table --table-name <name> --no-deletion-protection-enabled`), delete it, and schedule the key's
deletion, deliberately.
