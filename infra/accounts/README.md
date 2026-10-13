# The accounts' baseline

Every Coral Reef app runs in an account per environment (Streamlane ADR 0087; the plan, with the account ids, is
`docs/plans/cells-and-accounts.md` in the streamlane repository).

| Profile | Account | OU |
| --- | --- | --- |
| `crv-dev` | 171180525205 | NonProd |
| `crv-staging` | 715844023793 | NonProd |
| `crv-prod` | 027677878969 | Prod |
| `crv-sandbox` | 650836812608 | Sandbox |

The profiles share one Identity Center sign-in: `aws sso login --sso-session crv`.

`baseline.yml` is the one stack every account holds, `account-baseline`:

- GitHub's OIDC provider, and a deploy role per repository (`github-deploy-<repository>`) that only that repository's
  GitHub environment of the same name can assume (`repo:<owner>/<repository>:environment:<dev|staging|prod>`). A
  deploy may start and follow an Amplify Hosting build and deploy CDK stacks through the bootstrap's roles, and nothing
  else. The prod environment requires an approval, so only an approved run reaches prod. The sandbox account has none.
- `amplify-backend-deploy`, the service role Amplify Hosting builds with, which a deploy may hand to an app.
- `crv-build-artifacts-<account>`, where a deploy leaves what a build in the same account reads: Streamlane's backend
  outputs (`streamlane/current/amplify_outputs.json`, and a copy under each commit), kept 90 days. Deploys write it;
  `amplify-backend-deploy` reads it. Deploys also read the names Streamlane's areas publish (`/streamlane/*`).

Apply it, and bootstrap CDK in us-east-2, after changing the template or creating an account:

```sh
for env in dev staging prod sandbox; do
  aws cloudformation deploy --profile crv-$env --region us-east-2 --stack-name account-baseline \
    --template-file infra/accounts/baseline.yml --parameter-overrides Environment=$env --capabilities CAPABILITY_NAMED_IAM
  pnpm exec cdk bootstrap aws://$(aws sts get-caller-identity --profile crv-$env --query Account --output text)/us-east-2 \
    --profile crv-$env
done
```

Each account's Lambda concurrency quota was requested at 1000 on 2026-10-12 (new accounts start at 10).

## GitHub's side

Each of the four repositories (coral-reef-site, streamlane, driftline, intentset) has the environments `dev`,
`staging` and `prod`, each deployable from `main` only, each with the variables `AWS_ROLE_ARN` (that environment's
`github-deploy-<repository>` role) and `AWS_REGION`. `prod` requires the product owner's approval in the two public
repositories (coral-reef-site, intentset). GitHub's Team plan offers required reviewers on private repositories only
under Enterprise, so streamlane's and driftline's `prod` has no approval gate yet (open, 2026-10-12).
