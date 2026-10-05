import type { PreSignUpTriggerEvent } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPreSignUp } from "./handler.ts";

const event = (triggerSource: string, attributes: Record<string, string>) =>
  ({
    triggerSource,
    userName: "Google_1",
    request: { userAttributes: attributes },
    response: {},
  }) as unknown as PreSignUpTriggerEvent;

describe("crv-pre-sign-up", () => {
  const lines: string[] = [];
  const quiet = () => {
    lines.length = 0;
    vi.spyOn(console, "log").mockImplementation((line: unknown) => lines.push(String(line)));
  };
  afterEach(() => vi.restoreAllMocks());

  it("refuses password sign-up without asking", async () => {
    quiet();
    const check = vi.fn();
    await expect(createPreSignUp(check)(event("PreSignUp_SignUp", { email: "ada@example.com" }))).rejects.toThrow(
      "NOT_INVITED",
    );
    expect(check).not.toHaveBeenCalled();
  });

  it("requires Google to have verified the address", async () => {
    quiet();
    const check = vi.fn(async () => ({ admitted: true }));
    const handler = createPreSignUp(check);
    await expect(
      handler(event("PreSignUp_ExternalProvider", { email: "ada@example.com", email_verified: "false" })),
    ).rejects.toThrow("NOT_INVITED");
    expect(check).not.toHaveBeenCalled();
  });

  it("asks checkAdmission with the address lowercased, and admits a pending invitation", async () => {
    quiet();
    const check = vi.fn(async () => ({ admitted: true }));
    const e = event("PreSignUp_ExternalProvider", { email: " Ada@Example.COM ", email_verified: "true" });
    expect(await createPreSignUp(check)(e)).toBe(e);
    // With the username Cognito is about to create, which crv-access records on the invitation for erasure.
    expect(check).toHaveBeenCalledWith("ada@example.com", "Google_1", "PreSignUp_ExternalProvider");
  });

  it("refuses an address checkAdmission does not admit (an accepted invitation, or none)", async () => {
    quiet();
    const handler = createPreSignUp(async () => ({ admitted: false }));
    await expect(
      handler(event("PreSignUp_ExternalProvider", { email: "ada@example.com", email_verified: "true" })),
    ).rejects.toThrow("NOT_INVITED");
  });

  it("applies the same pending check to AdminCreateUser, which the e2e suite uses", async () => {
    quiet();
    const check = vi.fn(async () => ({ admitted: true }));
    await createPreSignUp(check)(event("PreSignUp_AdminCreateUser", { email: "e2e@example.com" }));
    expect(check).toHaveBeenCalledWith("e2e@example.com", "Google_1", "PreSignUp_AdminCreateUser");
  });

  it("counts a refusal as a metric and logs no address", async () => {
    quiet();
    const handler = createPreSignUp(async () => ({ admitted: false }));
    await handler(event("PreSignUp_ExternalProvider", { email: "ada@example.com", email_verified: "true" })).catch(
      () => {},
    );
    const output = lines.join("\n");
    expect(output).toContain('"DoorRefused":1');
    expect(output).not.toContain("ada@example.com");
  });
});
