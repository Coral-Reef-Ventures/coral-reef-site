import { describe, expect, it } from "vitest";

import { backupDays } from "./areas/retention.ts";
import { indexes, models } from "./functions/shared/models.ts";
import { nested, type Resource, resourcesOf, templates } from "./test/templates.ts";

/** What backend.ts adds (plan §2.4), read from the synthesized templates. */

const all = (type: "sandbox" | "branch"): [string, Resource][] =>
  templates(type).flatMap(({ template }) => Object.entries(template.Resources ?? {}));
const ofType = (type: "sandbox" | "branch", resourceType: string) =>
  all(type).filter(([, resource]) => resource.Type === resourceType);
const props = (resource: Resource | undefined) => (resource?.Properties ?? {}) as Record<string, unknown>;

describe("the model tables", () => {
  const tables = ofType("branch", "Custom::AmplifyDynamoDBTable");
  const named = (model: string) =>
    tables.find(([, table]) => JSON.stringify(props(table).tableName).includes(`"${model}-`))?.[1];

  it("are the six models, each with point-in-time recovery for the period the privacy page states", () => {
    expect(tables).toHaveLength(models.length);
    for (const model of models) {
      expect(props(named(model)).pointInTimeRecoverySpecification, model).toEqual({
        pointInTimeRecoveryEnabled: true,
        recoveryPeriodInDays: backupDays,
      });
    }
  });

  it("are retained and protected from deletion on the branch, so removing its backend keeps production data", () => {
    for (const model of models) {
      const table = named(model);
      expect(table?.DeletionPolicy, model).toBe("Retain");
      expect(props(table).deletionProtectionEnabled, model).toBe(true);
    }
  });

  it("go with a sandbox, so the agent's sandbox can be deleted whole", () => {
    const sandbox = ofType("sandbox", "Custom::AmplifyDynamoDBTable");
    expect(sandbox).toHaveLength(models.length);
    for (const [id, table] of sandbox) {
      expect(table.DeletionPolicy, id).toBe("Delete");
      expect(props(table).deletionProtectionEnabled, id).toBe(false);
    }
  });

  it("expire Submission and Activity rows by expiresAt, and nothing else", () => {
    for (const model of models) {
      const ttl = props(named(model)).timeToLiveSpecification;
      if (model === "Submission" || model === "Activity") {
        expect(ttl, model).toEqual({ attributeName: "expiresAt", enabled: true });
      } else {
        expect(ttl, model).toBeUndefined();
      }
    }
  });

  it("carry the indexes the functions query, by the names they query them with", () => {
    for (const index of Object.values(indexes)) {
      const gsis = (props(named(index.model)).globalSecondaryIndexes ?? []) as {
        indexName: string;
        keySchema: { attributeName: string; keyType: string }[];
      }[];
      const gsi = gsis.find((candidate) => candidate.indexName === index.name);
      expect(gsi, `${index.model}.${index.name}`).toBeDefined();
      expect(gsi?.keySchema).toEqual([
        { attributeName: index.partition, keyType: "HASH" },
        ...("sort" in index ? [{ attributeName: index.sort, keyType: "RANGE" }] : []),
      ]);
    }
  });
});

describe("the door key", () => {
  it("is P-256 for signing, retained with the branch under alias/crv-door-signing", () => {
    const [[, key] = ["", { Type: "" }]] = ofType("branch", "AWS::KMS::Key");
    expect(props(key)).toMatchObject({ KeySpec: "ECC_NIST_P256", KeyUsage: "SIGN_VERIFY" });
    expect(key.DeletionPolicy).toBe("Retain");
    expect(props(ofType("branch", "AWS::KMS::Alias")[0]?.[1]).AliasName).toBe("alias/crv-door-signing");
  });

  it("lets the build role read the public key and nothing more, through the key's own policy", () => {
    const [[, key] = ["", { Type: "" }]] = ofType("branch", "AWS::KMS::Key");
    const statements = (props(key).KeyPolicy as { Statement: { Action: unknown; Principal: unknown }[] }).Statement;
    const build = statements.filter((s) => JSON.stringify(s.Principal).includes("crv-amplify-backend-deploy"));
    expect(build).toHaveLength(1);
    expect(build[0]?.Action).toBe("kms:GetPublicKey");
  });

  it("goes with a sandbox, under a sandbox's own alias, and names no build role there", () => {
    const [[, key] = ["", { Type: "" }]] = ofType("sandbox", "AWS::KMS::Key");
    expect(key.DeletionPolicy).toBe("Delete");
    expect(props(ofType("sandbox", "AWS::KMS::Alias")[0]?.[1]).AliasName).toBe("alias/crv-door-signing-sandbox-synth");
    expect(JSON.stringify(props(key).KeyPolicy)).not.toContain("crv-amplify-backend-deploy");
  });

  it("is published as the outputs custom.doorKeyArn, custom.doorKid and custom.doorSites", () => {
    const output = JSON.stringify(templates("branch")[0]?.template.Outputs?.customOutputs);
    for (const name of ["doorKeyArn", "doorKid", "doorSites", "streamlane.app", "driftline.app"]) {
      expect(output).toContain(name);
    }
  });
});

describe("the notice topic", () => {
  it("emails hello@ from the branch only, so a sandbox never writes to a real inbox", () => {
    const subscriptions = (type: "sandbox" | "branch") =>
      ofType(type, "AWS::SNS::Subscription").map(([, s]) => props(s));
    expect(subscriptions("branch")).toEqual([
      expect.objectContaining({ Protocol: "email", Endpoint: "hello@coralreefventures.com" }),
    ]);
    expect(subscriptions("sandbox")).toEqual([]);
    expect(props(ofType("branch", "AWS::SNS::Topic")[0]?.[1]).TopicName).toBe("crv-interest-submitted");
  });
});

describe("the WAF web ACL", () => {
  const [[, acl] = ["", { Type: "" }]] = ofType("branch", "AWS::WAFv2::WebACL");
  const rules = props(acl).Rules as {
    Name: string;
    Action: unknown;
    Statement: { RateBasedStatement: Record<string, unknown> };
  }[];

  it("is regional, keeps no samples, and is associated with the API", () => {
    expect(props(acl)).toMatchObject({ Scope: "REGIONAL", DefaultAction: { Allow: {} } });
    expect(JSON.stringify(props(acl))).not.toContain('"SampledRequestsEnabled":true');
    expect(ofType("branch", "AWS::WAFv2::WebACLAssociation")).toHaveLength(1);
  });

  it("blocks more than 10 submitInterest requests and more than 300 of any kind per address in 5 minutes", () => {
    // JS_DECODE: a JSON body can spell the field name with \u escapes. MATCH: WAF reads 8 KB of an AppSync body, and
    // a query padded past that must count as a submission rather than slip under the 300-request rule.
    expect(rules.map((rule) => rule.Name)).toEqual(["submit-interest-per-ip", "all-per-ip"]);
    const [submit, any] = rules;
    expect(submit?.Statement.RateBasedStatement).toMatchObject({
      Limit: 10,
      EvaluationWindowSec: 300,
      AggregateKeyType: "IP",
    });
    expect(submit?.Statement.RateBasedStatement.ScopeDownStatement).toEqual({
      ByteMatchStatement: {
        FieldToMatch: { Body: { OversizeHandling: "MATCH" } },
        PositionalConstraint: "CONTAINS",
        SearchString: "submitInterest",
        TextTransformations: [{ Priority: 0, Type: "JS_DECODE" }],
      },
    });
    expect(any?.Statement.RateBasedStatement).toMatchObject({ Limit: 300, EvaluationWindowSec: 300 });
    for (const rule of rules) expect(rule.Action).toEqual({ Block: {} });
  });
});

describe("the functions", () => {
  const functions = (type: "sandbox" | "branch") =>
    ofType(type, "AWS::Lambda::Function").filter(([id]) => id.startsWith("crv"));

  it("are the five, none reserving concurrency (the project's limit of 10 allows none)", () => {
    expect(
      functions("branch")
        .map(([id]) => id.replace(/lambda[0-9A-F]{8}$/, ""))
        .sort(),
    ).toEqual(["crvaccess", "crvinterest", "crvpresignup", "crvpretokengeneration", "crvretention"]);
    for (const [id, fn] of functions("branch")) {
      expect(props(fn).ReservedConcurrentExecutions, id).toBeUndefined();
      expect(props(fn).Runtime, id).toBe("nodejs24.x");
    }
  });

  it("log JSON and keep it one month", () => {
    const groups = ofType("branch", "AWS::Logs::LogGroup").filter(([id]) => id.startsWith("crv"));
    expect(groups).toHaveLength(5);
    for (const [id, group] of groups) expect(props(group).RetentionInDays, id).toBe(30);
    for (const [id, fn] of functions("branch")) {
      expect((props(fn).LoggingConfig as { LogFormat?: string })?.LogFormat, id).toBe("JSON");
    }
  });

  it("let crv-access sign out, disable, enable, read, delete and move between groups the pool's users, and no more", () => {
    const data = nested("branch", "data");
    const actions = resourcesOf(data, "AWS::IAM::Policy")
      .filter(([id]) => id.startsWith("crvaccess"))
      .flatMap(([, policy]) =>
        (props(policy).PolicyDocument as { Statement: { Action: string | string[] }[] }).Statement.flatMap((s) =>
          [s.Action].flat(),
        ),
      )
      .filter((action) => action.startsWith("cognito-idp:"));
    expect(new Set(actions)).toEqual(
      new Set([
        "cognito-idp:AdminUserGlobalSignOut",
        "cognito-idp:AdminDisableUser",
        "cognito-idp:AdminEnableUser",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminAddUserToGroup",
        "cognito-idp:AdminRemoveUserFromGroup",
        "cognito-idp:AdminDeleteUser",
      ]),
    );
  });

  it("let the triggers call mutations only, so neither can read a model through the API", () => {
    const data = nested("branch", "data");
    const graphql = (role: string) =>
      resourcesOf(data, "AWS::IAM::Policy")
        .filter(([, policy]) => JSON.stringify(props(policy).Roles).includes(role))
        .flatMap(([, policy]) => (props(policy).PolicyDocument as { Statement: object[] }).Statement)
        .filter((statement) => JSON.stringify(statement).includes("appsync:GraphQL"));
    for (const role of ["crvpresignup", "crvpretokengeneration"]) {
      const statements = JSON.stringify(graphql(role));
      expect(statements, role).toContain("/types/Mutation/*");
      expect(statements, role).not.toContain("/types/Query/");
    }
  });

  it("give crv-interest only PutItem on Submission and Activity, its counters and the topic", () => {
    const data = nested("branch", "data");
    const policies = resourcesOf(data, "AWS::IAM::Policy").filter(([id]) => id.startsWith("crvinterest"));
    const actions = policies.flatMap(([, policy]) =>
      (props(policy).PolicyDocument as { Statement: { Action: string | string[] }[] }).Statement.flatMap((s) =>
        [s.Action].flat(),
      ),
    );
    expect(new Set(actions)).toEqual(
      new Set(["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "sns:Publish"]),
    );
  });
});

describe("the alarms", () => {
  it("watch errors and throttles on the form and the access path, the project's concurrency and WAF blocks", () => {
    const alarms = ofType("branch", "AWS::CloudWatch::Alarm").map(([, alarm]) => props(alarm));
    expect(alarms).toHaveLength(10);
    for (const alarm of alarms) expect(JSON.stringify(alarm.AlarmActions)).toContain("InterestSubmitted");
    expect(alarms.filter((a) => a.MetricName === "Errors")).toHaveLength(4);
    expect(alarms.filter((a) => a.MetricName === "Throttles")).toHaveLength(4);
    expect(alarms.find((a) => a.MetricName === "ConcurrentExecutions")?.Threshold).toBe(8);
    expect(alarms.find((a) => a.MetricName === "BlockedRequests")?.Threshold).toBe(50);
  });
});
