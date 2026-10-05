import { describe, expect, it } from "vitest";

import { nested, resourcesOf, templates } from "../test/templates.ts";

/**
 * The trigger wiring (plan §2.2): the auth nested stack must take nothing from the data stack, or the user pool's
 * triggers and AppSync's user-pool authorization close a cycle. The sandbox deploy is the final proof; this is the one
 * a branch meets first.
 */
describe.each(["sandbox", "branch"] as const)("the %s synth", (type) => {
  const root = templates(type)[0]?.template;
  const stacks = Object.entries(root?.Resources ?? {}).filter(([, r]) => r.Type === "AWS::CloudFormation::Stack");
  const authEntry = stacks.find(([id]) => id.startsWith("auth"));
  const dataEntry = stacks.find(([id]) => id.startsWith("data"));

  it("has an auth and a data stack", () => {
    expect(authEntry).toBeDefined();
    expect(dataEntry).toBeDefined();
  });

  it("passes no data-stack output or attribute into the auth stack, and does not order auth after data", () => {
    const [, auth] = authEntry ?? ["", { Type: "" }];
    const dataId = dataEntry?.[0] ?? "data";
    expect(JSON.stringify(auth.Properties ?? {})).not.toContain(dataId);
    expect([auth.DependsOn ?? []].flat()).not.toContain(dataId);
    // The auth stack's parameters are only the root's own (none here), never another stack's outputs.
    expect(JSON.stringify(auth.Properties?.Parameters ?? {})).not.toContain("Fn::GetAtt");
  });

  it("gives the triggers no table name and no data-stack value: only Amplify's SSM paths", () => {
    const functions = resourcesOf(nested(type, "auth"), "AWS::Lambda::Function").filter(([id]) =>
      id.startsWith("crvpre"),
    );
    expect(functions.map(([id]) => id.replace(/[0-9A-F]{8}$/, ""))).toEqual([
      "crvpresignuplambda",
      "crvpretokengenerationlambda",
    ]);
    for (const [, fn] of functions) {
      const variables = (fn.Properties?.Environment as { Variables?: Record<string, unknown> })?.Variables ?? {};
      // Amplify's SSM paths, and the data client's variables as placeholders its shim fills in at runtime.
      expect(Object.keys(variables).sort()).toEqual([
        "AMPLIFY_DATA_DEFAULT_NAME",
        "AMPLIFY_DATA_GRAPHQL_ENDPOINT",
        "AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_BUCKET_NAME",
        "AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_KEY",
        "AMPLIFY_SSM_ENV_CONFIG",
      ]);
      for (const [name, value] of Object.entries(variables)) {
        expect(typeof value, name).toBe("string");
        if (name !== "AMPLIFY_SSM_ENV_CONFIG") expect(value, name).toBe("<value will be resolved during runtime>");
      }
      expect(JSON.stringify(variables)).not.toMatch(/TABLE|Fn::|"Ref"/);
    }
  });

  it("puts the triggers on the user pool: pre sign-up and pre token generation, and no post confirmation", () => {
    const [[, pool] = ["", { Type: "" }]] = resourcesOf(nested(type, "auth"), "AWS::Cognito::UserPool");
    expect(Object.keys((pool.Properties?.LambdaConfig as object) ?? {}).sort()).toEqual([
      "PreSignUp",
      "PreTokenGeneration",
    ]);
  });

  it("uses the fixed Cognito prefix domain, which the outputs' oauth domain is built from", () => {
    const [[, domain] = ["", { Type: "" }]] = resourcesOf(nested(type, "auth"), "AWS::Cognito::UserPoolDomain");
    expect(domain.Properties?.Domain).toBe(type === "branch" ? "crv-door" : "crv-door-sandbox");
    const output = JSON.stringify((root?.Outputs as Record<string, unknown>)?.oauthCognitoDomain);
    expect(output).toContain("UserPoolDomain");
    expect(output).toContain(".amazoncognito.com");
  });
});
