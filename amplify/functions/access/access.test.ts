import { afterEach, describe, expect, it, vi } from "vitest";

import {
  adminIdentity,
  fixture,
  guestIdentity,
  invitedAndBound,
  roleIdentity,
  roles,
  userIdentity,
} from "../../test/access-fixture.ts";
import { createAccess, operations } from "./access.ts";
import { callerOf } from "./caller.ts";

/**
 * Who may call each operation, decided by crv-access itself (plan §2.2): the policy `allow.resource` attaches covers
 * every operation, and a guest's role is an IAM identity too, so AppSync's rules are not the only check.
 */
const callers = {
  guest: guestIdentity(),
  nobody: undefined,
  user: userIdentity("user-sub"),
  admin: adminIdentity(),
  preSignUp: roleIdentity(roles.preSignUp),
  preTokenGeneration: roleIdentity(roles.preTokenGeneration),
  retention: roleIdentity(roles.retention),
  otherRole: roleIdentity("SomeOtherRole"),
} as const;

const allowed: Record<string, (keyof typeof callers)[]> = {
  enterDoor: ["user", "admin"],
  issueSiteTicket: ["user", "admin"],
  invite: ["admin"],
  revokeInvitation: ["admin"],
  restoreInvitation: ["admin"],
  setGrants: ["admin"],
  rebindInvitation: ["admin"],
  updateSubmission: ["admin"],
  deletePerson: ["admin", "retention"],
  eraseEmail: ["admin"],
  checkAdmission: ["preSignUp"],
  admitSignIn: ["preTokenGeneration"],
};

describe("authorization", () => {
  it("knows every operation the schema hands to crv-access, and no other", () => {
    expect(Object.keys(operations).sort()).toEqual(Object.keys(allowed).sort());
  });

  const cases = Object.entries(allowed).flatMap(([operation, who]) =>
    (Object.keys(callers) as (keyof typeof callers)[]).map(
      (caller) => [operation, caller, who.includes(caller)] as const,
    ),
  );
  it.each(cases)("%s from %s: allowed %s", async (operation, caller, ok) => {
    const f = fixture();
    // An allowed caller gets past the check and is then refused for its empty arguments, or answered.
    const outcome = await f.call(operation, {}, callers[caller]).then(
      () => "answered",
      (error: Error) => error.message,
    );
    if (ok) expect(outcome).not.toBe("FORBIDDEN");
    else expect(outcome).toBe("FORBIDDEN");
  });

  it("reads the operation from the top of the event, where Amplify's invoke step puts it, as well as from info", async () => {
    const f = fixture();
    const handler = createAccess(f.deps);
    const identity = roleIdentity(roles.preSignUp);
    const args = { email: "nobody@example.com", triggerSource: "PreSignUp_ExternalProvider" };
    const refused = { admitted: false, reason: "NOT_INVITED", admin: false };
    expect(await handler({ fieldName: "checkAdmission", arguments: args, identity })).toEqual(refused);
    expect(await handler({ info: { fieldName: "checkAdmission" }, arguments: args, identity })).toEqual(refused);
  });

  it("refuses an operation it does not know", async () => {
    await expect(fixture().call("listEverything", {}, callers.admin)).rejects.toThrow("UNKNOWN_OPERATION");
    await expect(fixture().call("constructor", {}, callers.admin)).rejects.toThrow("UNKNOWN_OPERATION");
  });

  it("reads a guest as nobody and a function's assumed role by its name", () => {
    expect(callerOf(callers.guest)).toEqual({ kind: "none" });
    expect(callerOf(callers.retention)).toEqual({ kind: "role", role: roles.retention });
    expect(callerOf(userIdentity("s", { email: "A@B.co", groups: ["admins"] }))).toEqual({
      kind: "user",
      sub: "s",
      username: "Google_s",
      email: "a@b.co",
      groups: ["admins"],
    });
    expect(callerOf({ userArn: "arn:aws:iam::123456789012:user/someone" })).toEqual({ kind: "none" });
  });
});

describe("errors", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reach the caller as a code, and an unexpected failure as INTERNAL with nothing from inside it", async () => {
    const f = fixture();
    f.store.failNext("get", new Error("Table Invitation-abc: ada@example.com is broken"));
    const failure = f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, callers.admin);
    await expect(failure).rejects.toThrow(/^INTERNAL$/);
  });
});

describe("logging (plan §2.3a)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("never writes an address, a name, a Google id or a ticket to the console, whatever the operation does", async () => {
    const lines: string[] = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      });
    }
    const f = fixture();
    const secrets = [
      "ada@example.com",
      "ada@new.example",
      "google-secret-id",
      "Google_sub-1",
      "gary@coralreefventures.com",
    ];
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await f.call(
      "admitSignIn",
      { userName: "Google_sub-1", sub: "sub-1", googleSub: "google-secret-id", email: "ada@example.com" },
      callers.preTokenGeneration,
    );
    await f.call("checkAdmission", { email: "ada@example.com", triggerSource: "x" }, callers.preSignUp);
    await f.call("enterDoor", {}, userIdentity("sub-1"));
    const { ticket } = (await f.call(
      "issueSiteTicket",
      { site: "driftline", host: "driftline.app", next: "/", state: "abcdefghijklmnopqrstuvwxyz" },
      userIdentity("sub-1"),
    )) as { ticket: string };
    await f
      .call("issueSiteTicket", { site: "driftline", host: "evil.com", next: "/", state: "x" }, userIdentity("sub-1"))
      .catch(() => {});
    await f.call("rebindInvitation", { email: "ada@example.com", newEmail: "ada@new.example" }, callers.admin);
    await f.call("revokeInvitation", { email: "ada@new.example" }, callers.admin);
    await f.call(
      "admitSignIn",
      { userName: "Google_g", sub: "g", googleSub: "", email: "gary@coralreefventures.com" },
      callers.preTokenGeneration,
    );
    await f.call("eraseEmail", { email: "ada@new.example" }, callers.admin);
    await f.call("invite", { email: "ada@example.com", sites: [] }, callers.user).catch(() => {});

    expect(lines.length).toBeGreaterThan(5);
    const output = lines.join("\n");
    for (const secret of [...secrets, ticket, ticket.split(".")[2] ?? "-"]) expect(output).not.toContain(secret);
  });
});
