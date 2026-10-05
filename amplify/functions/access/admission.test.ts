import { describe, expect, it } from "vitest";

import { adminIdentity, fixture, invitedAndBound, roleIdentity, roles } from "../../test/access-fixture.ts";

/** The trigger-only operations (plan §2.2): an invitation binds to the first identity that accepts it. */

const check = (f: ReturnType<typeof fixture>, email: string) =>
  f.call("checkAdmission", { email, triggerSource: "PreSignUp_ExternalProvider" }, roleIdentity(roles.preSignUp));
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

  it("lets exactly one of two identities bind when both passed a pending pre sign-up", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    const results = await Promise.all([admit(f, "sub-1", "ada@example.com"), admit(f, "sub-2", "ada@example.com")]);
    expect(results.filter((r) => (r as { admitted: boolean }).admitted)).toHaveLength(1);
    expect(f.store.all("Invitation")).toHaveLength(1);
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

  it("admits an admin address when the tables cannot be read (break-glass), and nobody else", async () => {
    const f = fixture();
    f.store.failNext("query");
    expect(await admit(f, "gary-sub", "gary@coralreefventures.com")).toEqual({ admitted: true, admin: true });
    f.store.failNext("query");
    await expect(admit(f, "sub-1", "ada@example.com")).rejects.toThrow("INTERNAL");
  });
});
