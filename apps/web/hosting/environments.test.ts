import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { backendSettings, environments, isEnvironmentName, renderHeaders, withSignInDomain } from "./environments.ts";

const headers = readFileSync(fileURLToPath(new URL("./custom-headers.yml", import.meta.url)), "utf8");

describe("the environments", () => {
  it("are dev, staging and prod, each in its own account with its own app and Cognito prefix", () => {
    expect(Object.keys(environments)).toEqual(["dev", "staging", "prod"]);
    for (const key of ["account", "appId", "domainPrefix"] as const) {
      expect(new Set(Object.values(environments).map((env) => env[key])).size).toBe(3);
    }
    expect(isEnvironmentName("prod")).toBe(true);
    expect(isEnvironmentName("sandbox")).toBe(false);
  });

  it("only prod subscribes an inbox to the notices", () => {
    expect(backendSettings(environments.dev).CRV_NOTICE_EMAIL).toBe("");
    expect(backendSettings(environments.staging).CRV_NOTICE_EMAIL).toBe("");
    expect(backendSettings(environments.prod).CRV_NOTICE_EMAIL).toBe("hello@coralreefventures.com");
  });

  it("name each environment's own site hosts", () => {
    expect(backendSettings(environments.staging).CRV_DOOR_SITE_HOSTS).toBe(
      "streamlane=staging.streamlane.app,driftline=staging.driftline.app",
    );
  });

  it("name the production domains in prod", () => {
    expect(backendSettings(environments.prod).CRV_DOOR_SITE_HOSTS).toBe(
      "streamlane=streamlane.app,driftline=driftline.app",
    );
    expect(backendSettings(environments.prod).CRV_ADMIN_ORIGIN).toBe("https://coralreefventures.com");
  });

  it("call back to the environment's own origin", () => {
    expect(backendSettings(environments.dev).CRV_AUTH_CALLBACK_URLS).toBe(
      "https://dev.coralreefventures.com/signed-in/,https://dev.coralreefventures.com/signout/done/",
    );
  });

  it("each sign in at their own address under coralreefventures.com, with a us-east-1 certificate in their account", () => {
    for (const env of Object.values(environments)) {
      const settings = backendSettings(env);
      expect(settings.CRV_AUTH_DOMAIN).toMatch(/^auth(-dev|-staging)?\.coralreefventures\.com$/);
      expect(settings.CRV_AUTH_CERTIFICATE_ARN).toMatch(
        new RegExp(`^arn:aws:acm:us-east-1:${env.account}:certificate/`),
      );
    }
    expect(environments.prod.signInDomain.name).toBe("auth.coralreefventures.com");
  });

  it("point the outputs' sign-in at that address, leaving the rest", () => {
    const outputs = {
      auth: {
        user_pool_id: "p",
        oauth: { domain: "crv-door-prod.auth.us-east-2.amazoncognito.com", scopes: ["openid"] },
      },
    };
    expect(withSignInDomain(outputs, environments.prod)).toEqual({
      auth: { user_pool_id: "p", oauth: { domain: "auth.coralreefventures.com", scopes: ["openid"] } },
    });
    expect(() => withSignInDomain({}, environments.prod)).toThrow(/OAuth/);
  });

  it("render the headers flat, naming the environment's own hosted UI", () => {
    const dev = renderHeaders(headers, environments.dev);
    expect(dev.startsWith("customHeaders:\n")).toBe(true);
    expect(dev).toContain("https://auth-dev.coralreefventures.com");
    expect(dev).not.toContain("https://crv-door.auth.");
    expect(dev).toContain('  - pattern: "**"');
  });
});
