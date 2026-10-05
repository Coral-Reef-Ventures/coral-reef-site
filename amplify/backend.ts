import { defineBackend } from "@aws-amplify/backend";
import { Aws, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { CfnUserPoolDomain, UserPoolDomain } from "aws-cdk-lib/aws-cognito";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { ArnPrincipal, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key, KeySpec, KeyUsage } from "aws-cdk-lib/aws-kms";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";

import { backupDays } from "./areas/retention.ts";
import { authConfig } from "./auth/auth-config.ts";
import { auth } from "./auth/resource.ts";
import { preSignUp } from "./auth/pre-sign-up/resource.ts";
import { preTokenGeneration } from "./auth/pre-token-generation/resource.ts";
import { data } from "./data/resource.ts";
import { crvAccess } from "./functions/access/resource.ts";
import { crvInterest } from "./functions/interest/resource.ts";
import { limits } from "./functions/interest/limits.ts";
import { crvRetention } from "./functions/retention/resource.ts";
import { models } from "./functions/shared/models.ts";
import { tableVariable } from "./functions/shared/tables.ts";

/**
 * The Coral Reef Ventures app's backend (plan §2.4, ADR 0001), all in us-east-2. Everything this file adds goes in the
 * data stack, and every reference it makes points from data to auth: the access function's user pool and the
 * triggers' role names, the alarms on the triggers. Nothing here hands a data-stack value to the auth stack, which
 * `auth/wiring.test.ts` holds.
 */
const backend = defineBackend({
  auth,
  data,
  crvAccess,
  crvInterest,
  crvRetention,
  preSignUp,
  preTokenGeneration,
});

const dataStack = Stack.of(backend.data.resources.graphqlApi);
// "branch" on the Amplify app, "sandbox" for `ampx sandbox`. A sandbox names what the branch names fixed, so the two
// can share the project, and lets its key go when it is deleted.
const branch = backend.stack.node.tryGetContext("amplify-backend-type") === "branch";
const sandboxName = String(backend.stack.node.tryGetContext("amplify-backend-name") ?? "sandbox")
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-")
  .slice(0, 40);
const named = (name: string) => (branch ? name : `${name}-sandbox-${sandboxName}`);

// The Cognito prefix domain, fixed (plan §2.2): `crv-door` on the branch, `crv-door-sandbox` in a sandbox. defineAuth
// always names it after a hash of the backend, so the prefix is set on the domain resource here. Its Ref is the
// prefix, which is what amplify_outputs.json's oauth.domain is built from, so the outputs follow.
const domain = backend.auth.resources.userPool.node.children.find((child) => child instanceof UserPoolDomain);
if (!(domain?.node.defaultChild instanceof CfnUserPoolDomain)) throw new Error("The user pool has no prefix domain");
domain.node.defaultChild.addPropertyOverride("Domain", authConfig.domainPrefix);

// The model tables: point-in-time recovery on every one, for the 35 days the privacy page states (Amplify accepts a
// shorter period, but changing it changes approved copy, decision D3), and TTL where a row expires (plan §2.3a).
const tables = backend.data.resources.tables;
for (const [name, table] of Object.entries(backend.data.resources.cfnResources.amplifyDynamoDbTables)) {
  table.pointInTimeRecoverySpecification = { pointInTimeRecoveryEnabled: true, recoveryPeriodInDays: backupDays };
  if (name === "Submission" || name === "Activity") {
    table.timeToLiveAttribute = { attributeName: "expiresAt", enabled: true };
  }
}
const table = (model: (typeof models)[number]) => {
  const found = tables[model];
  if (!found) throw new Error(`Missing table for model ${model}`);
  return found;
};

// crv-rate-limits: hashed counters and the daily key, which only crv-interest can reach. Not a model, and no backups:
// a counter lives 24 hours and the key 48, and a backup would keep both longer than the privacy page says.
const rateLimits = new Table(dataStack, "CrvRateLimits", {
  partitionKey: { name: "pk", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "expiresAt",
  removalPolicy: RemovalPolicy.DESTROY,
});

// The door key: ES256 tickets are signed here and the private half never leaves KMS. Retained with the branch, so a
// redeploy cannot strand the product sites' JWKS; a sandbox's goes with it (KMS waits 7 days before deleting).
const doorKey = new Key(dataStack, "DoorSigningKey", {
  keySpec: KeySpec.ECC_NIST_P256,
  keyUsage: KeyUsage.SIGN_VERIFY,
  alias: named("alias/crv-door-signing"),
  description: "Signs the door's site tickets (ES256). Its public key is published as crv-door-jwks.json.",
  removalPolicy: branch ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
  pendingWindow: Duration.days(7),
});
// The Amplify build reads the public key with `aws kms get-public-key` (apps/web/scripts/door-jwks.mjs), granted here
// in the key's own policy rather than through a custom resource, whose handler would corrupt the DER bytes (plan §2.4).
if (authConfig.buildRoleName) {
  doorKey.addToResourcePolicy(
    new PolicyStatement({
      principals: [new ArnPrincipal(`arn:${Aws.PARTITION}:iam::${Aws.ACCOUNT_ID}:role/${authConfig.buildRoleName}`)],
      actions: ["kms:GetPublicKey"],
      resources: ["*"],
    }),
  );
}

// The notice topic. Only the branch subscribes hello@: a sandbox would send its confirmation request to a real inbox.
const notices = new Topic(dataStack, "InterestSubmitted", {
  topicName: named("crv-interest-submitted"),
  displayName: "Coral Reef Ventures",
});
if (branch) notices.addSubscription(new EmailSubscription("hello@coralreefventures.com"));

// crv-access: every table and its indexes, the user pool's admin calls, signing, and the roles it admits.
const access = backend.crvAccess.resources.lambda;
for (const model of models) {
  const modelTable = table(model);
  modelTable.grantReadWriteData(access);
  // Amplify's tables are imported references, so the grant above does not cover their indexes.
  access.addToRolePolicy(
    new PolicyStatement({ actions: ["dynamodb:Query"], resources: [`${modelTable.tableArn}/index/*`] }),
  );
  backend.crvAccess.addEnvironment(tableVariable(model), modelTable.tableName);
}
const userPool = backend.auth.resources.userPool;
access.addToRolePolicy(
  new PolicyStatement({
    actions: [
      "cognito-idp:AdminUserGlobalSignOut",
      "cognito-idp:AdminDisableUser",
      "cognito-idp:AdminEnableUser",
      "cognito-idp:AdminGetUser",
      "cognito-idp:AdminAddUserToGroup",
      "cognito-idp:AdminDeleteUser",
    ],
    resources: [userPool.userPoolArn],
  }),
);
backend.crvAccess.addEnvironment("USER_POOL_ID", userPool.userPoolId);
doorKey.grant(access, "kms:Sign");
backend.crvAccess.addEnvironment("DOOR_KEY_ID", doorKey.keyId);
const roleName = (fn: IFunction, label: string) => {
  if (!fn.role) throw new Error(`${label} has no role`);
  return fn.role.roleName;
};
backend.crvAccess.addEnvironment("PRE_SIGN_UP_ROLE", roleName(backend.preSignUp.resources.lambda, "crv-pre-sign-up"));
backend.crvAccess.addEnvironment(
  "PRE_TOKEN_GENERATION_ROLE",
  roleName(backend.preTokenGeneration.resources.lambda, "crv-pre-token-generation"),
);
backend.crvAccess.addEnvironment("RETENTION_ROLE", roleName(backend.crvRetention.resources.lambda, "crv-retention"));

// crv-interest: it may only add a Submission and its Activity, use its counters, and publish a notice.
const interest = backend.crvInterest.resources.lambda;
for (const model of ["Submission", "Activity"] as const) {
  table(model).grant(interest, "dynamodb:PutItem");
  backend.crvInterest.addEnvironment(tableVariable(model), table(model).tableName);
}
rateLimits.grant(interest, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem");
backend.crvInterest.addEnvironment("RATE_LIMITS_TABLE", rateLimits.tableName);
notices.grantPublish(interest);
backend.crvInterest.addEnvironment("NOTICE_TOPIC_ARN", notices.topicArn);

// The regional WAF web ACL on the AppSync API (plan §2.4), so nothing goes in us-east-1. One rule blocks an address
// sending more than 10 submitInterest requests in 5 minutes (10 is WAF's lowest limit); the other, more than 300
// requests of any kind. Sampled requests stay off, because a sample would keep a request body.
const webAclName = named("crv-door");
const visibility = (metricName: string) => ({
  cloudWatchMetricsEnabled: true,
  metricName,
  sampledRequestsEnabled: false,
});
const webAcl = new CfnWebACL(dataStack, "DoorWebAcl", {
  name: webAclName,
  scope: "REGIONAL",
  defaultAction: { allow: {} },
  visibilityConfig: visibility(webAclName),
  rules: [
    {
      name: "submit-interest-per-ip",
      priority: 0,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: limits.wafSubmitPerFiveMinutes,
          evaluationWindowSec: 300,
          aggregateKeyType: "IP",
          scopeDownStatement: {
            byteMatchStatement: {
              fieldToMatch: { body: { oversizeHandling: "CONTINUE" } },
              positionalConstraint: "CONTAINS",
              searchString: "submitInterest",
              textTransformations: [{ priority: 0, type: "NONE" }],
            },
          },
        },
      },
      visibilityConfig: visibility("submit-interest-per-ip"),
    },
    {
      name: "all-per-ip",
      priority: 1,
      action: { block: {} },
      statement: {
        rateBasedStatement: { limit: limits.wafAllPerFiveMinutes, evaluationWindowSec: 300, aggregateKeyType: "IP" },
      },
      visibilityConfig: visibility("all-per-ip"),
    },
  ],
});
new CfnWebACLAssociation(dataStack, "DoorWebAclAssociation", {
  resourceArn: backend.data.resources.graphqlApi.arn,
  webAclArn: webAcl.attrArn,
});

// Alarms, to the notice topic: an error or a throttle on the form or the access path (a throttled trigger is a failed
// sign-in), the project's concurrency nearing its limit of 10, and the web ACL blocking a flood.
const fiveMinutes = Duration.minutes(5);
const alarm = (id: string, metric: Metric, threshold: number) =>
  new Alarm(dataStack, id, {
    metric,
    threshold,
    evaluationPeriods: 1,
    comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  }).addAlarmAction(new SnsAction(notices));
for (const [label, fn] of [
  ["Interest", interest],
  ["Access", access],
  ["PreSignUp", backend.preSignUp.resources.lambda],
  ["PreTokenGeneration", backend.preTokenGeneration.resources.lambda],
] as const) {
  alarm(`${label}Errors`, fn.metricErrors({ period: fiveMinutes, statistic: "Sum" }), 1);
  alarm(`${label}Throttles`, fn.metricThrottles({ period: fiveMinutes, statistic: "Sum" }), 1);
}
alarm(
  "ProjectConcurrency",
  new Metric({
    namespace: "AWS/Lambda",
    metricName: "ConcurrentExecutions",
    statistic: "Maximum",
    period: fiveMinutes,
  }),
  8,
);
alarm(
  "WebAclBlocked",
  new Metric({
    namespace: "AWS/WAFV2",
    metricName: "BlockedRequests",
    dimensionsMap: { WebACL: webAclName, Region: Aws.REGION, Rule: "ALL" },
    statistic: "Sum",
    period: fiveMinutes,
  }),
  50,
);

backend.addOutput({
  custom: {
    doorKeyArn: doorKey.keyArn,
    doorKid: doorKey.keyId,
    doorSites: authConfig.sites.map((site) => ({ id: site.id, hosts: site.hosts })),
  },
});
