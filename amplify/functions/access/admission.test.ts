import { describe, expect, it, vi } from "vitest";

import {
  adminIdentity,
  fixture,
  invitedAndBound,
  roleIdentity,
  roles,
  signIn,
  signUp,
} from "../../test/access-fixture.ts";

/** The trigger-only operations (plan §2.2): an invitation binds to the first identity that accepts it. */

const check = (f: ReturnType<typeof fixture>, email: string, userName = "Google_new") =>
  f.call(
    "checkAdmission",
    { email, userName, triggerSource: "PreSignUp_ExternalProvider" },
    roleIdentity(roles.preSignUp),
  );
const admit = (f: ReturnType<typeof fixture>, sub: string, email: string, googleSub = `g-${sub}`) =>
  f.call("admitSignIn", { userName: `Google_${sub}`, sub, googleSub, email }, roleIdentity(roles.preTokenGeneration));

describe("checkAdmission (pre sign-up)", () => {
  it("admits an address whose invitation is pending, whatever its case", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    expect(await check(f, "Ada@Example.com")).toEqual({ admitted: true, admin: false });
  });

  it("refuses an accepted invitation, which already belongs to an identity", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    expect(await check(f, "ada@example.com")).toEqual({ admitted: false, reason: "NOT_INVITED", admin: false });
  });

  it("refuses a revoked invitation and an address with none", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    await f.call("revokeInvitation", { email: "ada@example.com" }, adminIdentity());
    expect(await check(f, "ada@example.com")).toMatchObject({ admitted: false, reason: "REVOKED" });
    expect(await check(f, "stranger@example.com")).toMatchObject({ admitted: false, reason: "NOT_INVITED" });
  });

  it("admits a CRV_ADMIN_EMAILS address with no invitation, and refuses one already bound", async () => {
    const f = fixture();
    expect(await check(f, "gary@coralreefventures.com")).toEqual({ admitted: true, admin: true });
    await admit(f, "gary-sub", "gary@coralreefventures.com");
    expect(await check(f, "gary@coralreefventures.com")).toMatchObject({ admitted: false });
  });

  it("records each username it admits on the pending invitation, once, so erasure can find a user that never binds", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    expect(await check(f, "ada@example.com", "Google_1")).toMatchObject({ admitted: true });
    expect(await check(f, "ada@example.com", "Google_2")).toMatchObject({ admitted: true });
    expect(await check(f, "ada@example.com", "Google_1")).toMatchObject({ admitted: true });
    expect(f.store.all("Invitation")[0]?.admittedUsernames).toEqual(["Google_1", "Google_2"]);
  });

  it("keeps both names when two sign-ups record at once", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    const answers = await Promise.all([
      check(f, "ada@example.com", "Google_1"),
      check(f, "ada@example.com", "Google_2"),
    ]);
    expect(answers).toEqual([
      { admitted: true, admin: false },
      { admitted: true, admin: false },
    ]);
    expect([...((f.store.all("Invitation")[0]?.admittedUsernames as string[]) ?? [])].sort()).toEqual([
      "Google_1",
      "Google_2",
    ]);
  });

  it("refuses a call that does not say which username Cognito is creating", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    expect(await check(f, "ada@example.com", "")).toMatchObject({ admitted: false, reason: "NOT_INVITED" });
  });

  it("admits an admin address when the invitation table cannot be read (break-glass), and nobody else", async () => {
    const f = fixture();
    f.store.failNext("get");
    expect(await check(f, "gary@coralreefventures.com")).toEqual({ admitted: true, admin: true });
    f.store.failNext("get");
    await expect(check(f, "ada@example.com")).rejects.toThrow("INTERNAL");
  });
});

describe("admitSignIn (pre token generation)", () => {
  it("binds a pending invitation on the first sign-in: invitation, address claim and person, in one go", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    expect(await admit(f, "sub-1", "ada@example.com", "google-1")).toEqual({ admitted: true, admin: false });

    const [invitation] = f.store.all("Invitation");
    expect(invitation).toMatchObject({
      email: "ada@example.com",
      status: "accepted",
      cognitoUsername: "Google_sub-1",
      cognitoSub: "sub-1",
      googleSub: "google-1",
      acceptedAt: "2026-10-05T12:00:00.000Z",
      statusAt: "2026-10-05T12:00:00.000Z",
    });
    const [person] = f.store.all("Person");
    expect(person).toMatchObject({ id: invitation?.personId, cognitoSub: "sub-1", googleSub: "google-1" });
    expect(f.store.all("PersonEmail")).toEqual([
      expect.objectContaining({ email: "ada@example.com", personId: person?.id }),
    ]);
    expect(f.store.all("Activity").map((a) => a.kind)).toEqual(["access.invited", "access.signed_up"]);
    expect(f.directory.addToAdmins).not.toHaveBeenCalled();
  });

  it("admits the bound identity again, on every later sign-in and refresh", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    expect(await admit(f, "sub-1", "ada@example.com")).toEqual({ admitted: true, admin: false });
  });

  it("refuses a second Google identity with the invitee's address", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    expect(await admit(f, "sub-2", "ada@example.com")).toEqual({
      admitted: false,
      reason: "NOT_INVITED",
      admin: false,
    });
    expect(f.store.all("Invitation")[0]?.cognitoSub).toBe("sub-1");
  });

  it("lets exactly one of two identities bind when both passed a pending pre sign-up, and deletes the other's user", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    await signUp(f, "ada@example.com", "sub-1");
    await signUp(f, "ada@example.com", "sub-2");
    const results = await Promise.all([admit(f, "sub-1", "ada@example.com"), admit(f, "sub-2", "ada@example.com")]);
    expect(results.filter((r) => (r as { admitted: boolean }).admitted)).toHaveLength(1);
    expect(f.store.all("Invitation")).toHaveLength(1);
    const winner = f.store.all("Invitation")[0]?.cognitoUsername;
    const loser = winner === "Google_sub-1" ? "Google_sub-2" : "Google_sub-1";
    expect(f.directory.remove.mock.calls).toEqual([[loser]]);
  });

  it("deletes an unbound user it refuses: invitation revoked or erased after pre sign-up, or none at all", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    await signUp(f, "ada@example.com", "sub-1");
    await f.call("revokeInvitation", { email: "ada@example.com" }, adminIdentity());
    expect(await admit(f, "sub-1", "ada@example.com")).toMatchObject({ admitted: false, reason: "REVOKED" });
    expect(f.directory.remove).toHaveBeenLastCalledWith("Google_sub-1");

    await f.call("invite", { email: "bea@example.com", sites: ["driftline"] }, adminIdentity());
    await signUp(f, "bea@example.com", "sub-2");
    await f.call("eraseEmail", { email: "bea@example.com" }, adminIdentity());
    f.directory.remove.mockClear();
    expect(await admit(f, "sub-2", "bea@example.com")).toMatchObject({ admitted: false, reason: "NOT_INVITED" });
    expect(f.directory.remove).toHaveBeenCalledWith("Google_sub-2");
  });

  it("keeps the refusal when deleting the unbound user fails, and logs no address or username", async () => {
    const f = fixture();
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => lines.push(String(line)));
    f.directory.remove.mockRejectedValueOnce(
      Object.assign(new Error("throttled"), { name: "TooManyRequestsException" }),
    );
    expect(await admit(f, "sub-9", "stranger@example.com")).toMatchObject({ admitted: false, reason: "NOT_INVITED" });
    spy.mockRestore();
    expect(lines.join("\n")).toContain("access.unbound_user_kept");
    expect(lines.join("\n")).not.toMatch(/stranger|sub-9/);
  });

  it("never deletes a bound user it refuses: revoking and rebinding are the admin's", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await f.call("revokeInvitation", { email: "ada@example.com" }, adminIdentity());
    expect(await admit(f, "sub-1", "ada@example.com")).toMatchObject({ admitted: false, reason: "REVOKED" });
    expect(await admit(f, "sub-1", "ada@new.example")).toMatchObject({ admitted: false });
    expect(f.directory.remove).not.toHaveBeenCalled();
  });

  it("admits a just-bound identity the bySub index does not show yet, and deletes nothing", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    const query = f.store.query.bind(f.store);
    // The index lags the bind: the address's invitation, read consistently, already names this identity.
    f.store.query = async (q) => (q.index?.toLowerCase().includes("sub") ? [] : query(q));
    expect(await admit(f, "sub-1", "ada@example.com")).toMatchObject({ admitted: true });
    expect(f.directory.remove).not.toHaveBeenCalled();
  });

  it("refuses, and deletes nothing, when the index shows the binding only on a second look", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await f.call("rebindInvitation", { email: "ada@example.com", newEmail: "ada@new.example" }, adminIdentity());
    const query = f.store.query.bind(f.store);
    let looks = 0;
    // Moved to a new address a moment ago, and signing in under the old one: the first lookup by sub misses.
    f.store.query = async (q) => (q.index?.toLowerCase().includes("sub") && looks++ === 0 ? [] : query(q));
    expect(await admit(f, "sub-1", "ada@example.com")).toMatchObject({ admitted: false });
    expect(f.directory.remove).not.toHaveBeenCalled();
  });

  it("admits the same identity once bound by a sign-in running beside it, and deletes nothing", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    await signUp(f, "ada@example.com", "sub-1");
    const results = await Promise.all([admit(f, "sub-1", "ada@example.com"), admit(f, "sub-1", "ada@example.com")]);
    expect(results.every((r) => (r as { admitted: boolean }).admitted)).toBe(true);
    expect(f.directory.remove).not.toHaveBeenCalled();
  });

  it("refuses a bound invitee whose Google email changed, until an admin rebinds", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    expect(await admit(f, "sub-1", "ada@new.example")).toEqual({
      admitted: false,
      reason: "EMAIL_CHANGED",
      admin: false,
    });
  });

  it("refuses a revoked invitee on every trigger source", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await f.call("revokeInvitation", { email: "ada@example.com" }, adminIdentity());
    expect(await admit(f, "sub-1", "ada@example.com")).toEqual({ admitted: false, reason: "REVOKED", admin: false });
  });

  it("refuses an address with no invitation, and stores nothing for it", async () => {
    const f = fixture();
    expect(await admit(f, "sub-9", "stranger@example.com")).toMatchObject({ admitted: false, reason: "NOT_INVITED" });
    for (const table of ["Person", "PersonEmail", "Invitation", "Activity"]) expect(f.store.all(table)).toEqual([]);
  });

  it("bootstraps a CRV_ADMIN_EMAILS address with no invitation: person, accepted invitation, both grants, admins", async () => {
    const f = fixture();
    expect(await admit(f, "gary-sub", "gary@coralreefventures.com")).toEqual({ admitted: true, admin: true });
    expect(f.store.all("Invitation")).toEqual([
      expect.objectContaining({ status: "accepted", cognitoSub: "gary-sub", invitedBy: "system" }),
    ]);
    expect(f.store.all("Person")).toEqual([expect.objectContaining({ source: "admin", cognitoSub: "gary-sub" })]);
    expect(
      f.store
        .all("AccessGrant")
        .map((g) => [g.resource, g.status, g.source])
        .sort(),
    ).toEqual([
      ["site:driftline.app", "active", "admin-bootstrap"],
      ["site:streamlane.app", "active", "admin-bootstrap"],
    ]);
    expect(f.directory.addToAdmins).toHaveBeenCalledWith("Google_gary-sub");
  });

  it("binds an admin's pending invitation and adds the missing grant", async () => {
    const f = fixture();
    await f.call("invite", { email: "gary@coralreefventures.com", sites: ["driftline"] }, adminIdentity());
    expect(await admit(f, "gary-sub", "gary@coralreefventures.com")).toEqual({ admitted: true, admin: true });
    expect(
      f.store
        .all("AccessGrant")
        .map((g) => g.resource)
        .sort(),
    ).toEqual(["site:driftline.app", "site:streamlane.app"]);
  });

  it("takes an address out of admins at its next sign-in once it is off CRV_ADMIN_EMAILS", async () => {
    const f = fixture();
    expect(await signIn(f, "gary@coralreefventures.com", "gary-sub")).toMatchObject({ admin: true });
    // CRV_ADMIN_EMAILS changes, and crv-access is redeployed with the new list.
    f.deps.config = { ...f.deps.config, adminEmails: ["someone@coralreefventures.com"] };
    expect(await signIn(f, "gary@coralreefventures.com", "gary-sub", true)).toEqual({ admitted: true, admin: false });
    expect(f.directory.removeFromAdmins).toHaveBeenCalledWith("Google_gary-sub");
    // Once out of the group, nothing more is done.
    f.directory.removeFromAdmins.mockClear();
    f.directory.addToAdmins.mockClear();
    await signIn(f, "gary@coralreefventures.com", "gary-sub", false);
    expect(f.directory.removeFromAdmins).not.toHaveBeenCalled();
    expect(f.directory.addToAdmins).not.toHaveBeenCalled();
  });

  it("puts a listed address back in admins if its token comes without the group, and leaves it if it has it", async () => {
    const f = fixture();
    await signIn(f, "gary@coralreefventures.com", "gary-sub");
    f.directory.addToAdmins.mockClear();
    await signIn(f, "gary@coralreefventures.com", "gary-sub", true);
    expect(f.directory.addToAdmins).not.toHaveBeenCalled();
    await signIn(f, "gary@coralreefventures.com", "gary-sub", false);
    expect(f.directory.addToAdmins).toHaveBeenCalledWith("Google_gary-sub");
    expect(f.directory.removeFromAdmins).not.toHaveBeenCalled();
  });

  it("still admits when the group cannot be changed: the token already leaves admins out", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    f.directory.removeFromAdmins.mockRejectedValueOnce(new Error("throttled"));
    expect(await signIn(f, "ada@example.com", "sub-1", true)).toEqual({ admitted: true, admin: false });
  });

  it("admits an admin address when the tables cannot be read (break-glass), and nobody else", async () => {
    const f = fixture();
    f.store.failNext("query");
    expect(await admit(f, "gary-sub", "gary@coralreefventures.com")).toEqual({ admitted: true, admin: true });
    f.store.failNext("query");
    await expect(admit(f, "sub-1", "ada@example.com")).rejects.toThrow("INTERNAL");
  });
});
