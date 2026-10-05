import type { PreTokenGenerationTriggerEvent } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPreTokenGeneration, googleSubOf } from "./handler.ts";

const event = (triggerSource: string, groups: string[] = []) =>
  ({
    triggerSource,
    userName: "Google_1234",
    request: {
      userAttributes: {
        sub: "sub-1",
        email: "Ada@Example.com",
        identities: JSON.stringify([{ providerName: "Google", userId: "1234" }]),
      },
      groupConfiguration: { groupsToOverride: groups, iamRolesToOverride: [], preferredRole: undefined },
    },
    response: { claimsOverrideDetails: {} },
  }) as unknown as PreTokenGenerationTriggerEvent;

describe("crv-pre-token-generation", () => {
  const lines: string[] = [];
  const quiet = () => {
    lines.length = 0;
    vi.spyOn(console, "log").mockImplementation((line: unknown) => lines.push(String(line)));
  };
  afterEach(() => vi.restoreAllMocks());

  it.each(["TokenGeneration_HostedAuth", "TokenGeneration_RefreshTokens", "TokenGeneration_Authentication"])(
    "asks admitSignIn on %s with the username, sub, Google id and lowercased email",
    async (source) => {
      quiet();
      const admit = vi.fn(async () => ({ admitted: true, admin: false }));
      await createPreTokenGeneration(admit)(event(source));
      expect(admit).toHaveBeenCalledWith({
        userName: "Google_1234",
        sub: "sub-1",
        googleSub: "1234",
        email: "ada@example.com",
      });
    },
  );

  it("throws the reason, so Cognito issues no token, and logs no address", async () => {
    quiet();
    const handler = createPreTokenGeneration(async () => ({ admitted: false, reason: "REVOKED" }));
    await expect(handler(event("TokenGeneration_RefreshTokens"))).rejects.toThrow("REVOKED");
    expect(lines.join("\n")).not.toMatch(/example\.com/i);
  });

  it("puts an admin in the admins group in this very token, and leaves an invitee's groups alone", async () => {
    quiet();
    const admin = await createPreTokenGeneration(async () => ({ admitted: true, admin: true }))(
      event("TokenGeneration_HostedAuth", ["other"]),
    );
    expect(admin.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual(["other", "admins"]);
    const invitee = await createPreTokenGeneration(async () => ({ admitted: true, admin: false }))(
      event("TokenGeneration_HostedAuth"),
    );
    expect(invitee.response.claimsOverrideDetails?.groupOverrideDetails).toBeUndefined();
  });

  it("reads the Google id from the identities attribute, and nothing from anything else", () => {
    expect(googleSubOf(JSON.stringify([{ providerName: "Google", userId: "42" }]))).toBe("42");
    expect(googleSubOf(JSON.stringify([{ providerName: "Facebook", userId: "42" }]))).toBe("");
    expect(googleSubOf("not json")).toBe("");
    expect(googleSubOf(undefined)).toBe("");
  });
});
