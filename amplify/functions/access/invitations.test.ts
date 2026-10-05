import { describe, expect, it } from "vitest";

import {
  adminIdentity,
  fixture,
  invitedAndBound,
  roleIdentity,
  roles,
  signIn,
  signUp,
} from "../../test/access-fixture.ts";
import { row } from "../shared/models.ts";

const admin = adminIdentity();

const submission = (f: ReturnType<typeof fixture>, id: string, email: string, over: Record<string, unknown> = {}) =>
  f.store.write({
    put: {
      table: "Submission",
      item: row(
        "Submission",
        {
          id,
          name: "Ada Lovelace",
          email,
          interests: ["funding"],
          message: "Hello",
          sourceSite: "crv",
          status: "new",
          statusAt: "2026-10-01T00:00:00.000Z",
          receivedAt: "2026-10-01T00:00:00.000Z",
          ...over,
        },
        new Date("2026-10-01T00:00:00Z"),
      ),
    },
  });

describe("invite", () => {
  it("claims the address for a new Person, creates a pending invitation and its grants, and returns the text", async () => {
    const f = fixture();
    const result = (await f.call(
      "invite",
      { email: " Ada@Example.com ", sites: ["streamlane", "driftline.app"] },
      admin,
    )) as {
      invitation: Record<string, unknown>;
      subject: string;
      text: string;
    };
    const [person] = f.store.all("Person");
    expect(person).toMatchObject({ email: "ada@example.com", source: "invitation", __typename: "Person" });
    expect(f.store.all("PersonEmail")).toEqual([
      expect.objectContaining({ email: "ada@example.com", personId: person?.id }),
    ]);
    expect(result.invitation).toMatchObject({
      email: "ada@example.com",
      status: "pending",
      bound: false,
      personId: person?.id,
      sites: ["streamlane.app", "driftline.app"],
    });
    expect(result.subject).toBe("Your invitation to Streamlane and Driftline");
    expect(result.text).toContain("You are invited to Streamlane and Driftline, open for now only to invited guests.");
    expect(result.text).toContain(
      "go to https://main.d1example.amplifyapp.com/get-involved/#invited and sign in with Google using this address, ada@example.com.",
    );
    const [activity] = f.store.all("Activity");
    expect(activity).toMatchObject({ kind: "access.invited", subjectType: "Person", subjectId: person?.id });
    expect(JSON.stringify(activity)).not.toContain("ada@example.com");
  });

  it("invites from a submission: the Person takes its name, the submission is invited and kept", async () => {
    const f = fixture();
    await submission(f, "SUB1", "ada@example.com", { status: "declined", expiresAt: 1 });
    await f.store.write({
      put: { table: "Activity", item: { id: "ACT1", subjectId: "SUB1", at: "2026-10-01T00:00:00.000Z", expiresAt: 1 } },
    });
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"], submissionId: "SUB1" }, admin);
    const [person] = f.store.all("Person");
    expect(person).toMatchObject({ name: "Ada Lovelace", source: "interest" });
    const updated = await f.store.get("Submission", { id: "SUB1" });
    expect(updated).toMatchObject({ status: "invited", personId: person?.id });
    expect(updated?.expiresAt).toBeUndefined();
    expect((await f.store.get("Activity", { id: "ACT1" }))?.expiresAt).toBeUndefined();
  });

  it("refuses an address whose invitation is bound, an unknown site, no site and a missing submission", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await expect(f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin)).rejects.toThrow(
      "ALREADY_BOUND",
    );
    await expect(f.call("invite", { email: "b@example.com", sites: ["markset"] }, admin)).rejects.toThrow("BAD_SITES");
    await expect(f.call("invite", { email: "b@example.com", sites: [] }, admin)).rejects.toThrow("BAD_SITES");
    await expect(f.call("invite", { email: "not-an-address", sites: ["driftline"] }, admin)).rejects.toThrow(
      "BAD_EMAIL",
    );
    await expect(
      f.call("invite", { email: "b@example.com", sites: ["driftline"], submissionId: "NOPE" }, admin),
    ).rejects.toThrow("NO_SUBMISSION");
  });

  it("re-invites a revoked address that never bound, keeping its Person", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    await f.call("revokeInvitation", { email: "ada@example.com" }, admin);
    const again = (await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin)) as {
      invitation: { status: string; sites: string[] };
    };
    expect(again.invitation).toMatchObject({ status: "pending", sites: ["driftline.app"] });
    expect(f.store.all("Person")).toHaveLength(1);
  });

  it("keeps the usernames pre sign-up admitted under the invitation it replaces, for erasure", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    await signUp(f, "ada@example.com", "sub-1");
    await f.call("revokeInvitation", { email: "ada@example.com" }, admin);
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    expect(f.store.all("Invitation")[0]?.admittedUsernames).toEqual(["Google_sub-1"]);
  });
});

describe("revokeInvitation and restoreInvitation", () => {
  it("revoke marks the invitation and its grants revoked, and signs out and disables the bound user", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    const view = await f.call("revokeInvitation", { email: "ada@example.com" }, admin);
    expect(view).toMatchObject({ status: "revoked", sites: [], bound: true });
    expect(f.store.all("AccessGrant").every((g) => g.status === "revoked")).toBe(true);
    expect(f.directory.signOut).toHaveBeenCalledWith("Google_sub-1");
    expect(f.directory.disable).toHaveBeenCalledWith("Google_sub-1");
  });

  it("restore makes a bound invitation accepted again, enables the user and brings back the grants revoked with it", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1", ["driftline", "streamlane"]);
    await f.call("setGrants", { email: "ada@example.com", sites: ["driftline"] }, admin);
    f.at("2026-10-06T00:00:00.000Z");
    await f.call("revokeInvitation", { email: "ada@example.com" }, admin);
    const view = await f.call("restoreInvitation", { email: "ada@example.com" }, admin);
    expect(view).toMatchObject({ status: "accepted", sites: ["driftline.app"] });
    expect(f.directory.enable).toHaveBeenCalledWith("Google_sub-1");
  });

  it("restore makes an invitation that never bound pending again, with no user to enable", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    await f.call("revokeInvitation", { email: "ada@example.com" }, admin);
    expect(f.directory.signOut).not.toHaveBeenCalled();
    expect(await f.call("restoreInvitation", { email: "ada@example.com" }, admin)).toMatchObject({ status: "pending" });
    expect(f.directory.enable).not.toHaveBeenCalled();
  });
});

describe("setGrants", () => {
  it("makes the grants exactly the sites named", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    expect(await f.call("setGrants", { email: "ada@example.com", sites: ["streamlane"] }, admin)).toMatchObject({
      sites: ["streamlane.app"],
    });
    expect(f.store.all("Activity").at(-1)).toMatchObject({ kind: "access.grants_set" });
  });
});

describe("rebindInvitation", () => {
  it("with a new address moves the invitation and the claim, and keeps the identity", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    const view = await f.call("rebindInvitation", { email: "ada@example.com", newEmail: "Ada@New.example" }, admin);
    expect(view).toMatchObject({ email: "ada@new.example", status: "accepted", bound: true });
    expect(f.store.all("Invitation").map((i) => i.email)).toEqual(["ada@new.example"]);
    expect(f.store.all("PersonEmail").map((c) => c.email)).toEqual(["ada@new.example"]);
    expect(f.store.all("Person")[0]?.email).toBe("ada@new.example");
    // The same identity now signs in with the changed address.
    expect(
      await f.call(
        "admitSignIn",
        { userName: "Google_sub-1", sub: "sub-1", googleSub: "g-sub-1", email: "ada@new.example" },
        roleIdentity(roles.preTokenGeneration),
      ),
    ).toMatchObject({ admitted: true });
  });

  it("without one deletes the old user, clears the binding, and lets the next first sign-in bind afresh", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    const view = await f.call("rebindInvitation", { email: "ada@example.com" }, admin);
    expect(view).toMatchObject({ status: "pending", bound: false });
    expect(f.store.all("Person")[0]?.cognitoSub).toBeUndefined();
    expect(f.directory.signOut).toHaveBeenCalledWith("Google_sub-1");
    expect(f.directory.remove).toHaveBeenCalledWith("Google_sub-1");
    expect(f.directory.disable).not.toHaveBeenCalled();
    await signUp(f, "ada@example.com", "sub-2");
    expect(await signIn(f, "ada@example.com", "sub-2")).toMatchObject({ admitted: true });
    expect(f.store.all("Invitation")[0]?.cognitoSub).toBe("sub-2");
  });

  it("deletes the old user before clearing the binding, so a failure leaves the binding that names it", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    f.directory.remove.mockRejectedValueOnce(new Error("throttled"));
    await expect(f.call("rebindInvitation", { email: "ada@example.com" }, admin)).rejects.toThrow("INTERNAL");
    expect(f.store.all("Invitation")[0]).toMatchObject({ status: "accepted", cognitoUsername: "Google_sub-1" });
  });

  it("without one leaves a revoked invitation revoked, until restoreInvitation reopens it as pending", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await f.call("revokeInvitation", { email: "ada@example.com" }, admin);
    const revoked = f.store.all("Invitation")[0];
    const view = await f.call("rebindInvitation", { email: "ada@example.com" }, admin);
    expect(view).toMatchObject({ status: "revoked", bound: false, sites: [] });
    expect(f.store.all("Invitation")[0]).toMatchObject({ statusAt: revoked?.statusAt, revokedAt: revoked?.revokedAt });
    // Nobody can sign up or bind against it meanwhile.
    expect(await signUp(f, "ada@example.com", "sub-2")).toMatchObject({ admitted: false, reason: "REVOKED" });
    expect(await signIn(f, "ada@example.com", "sub-2")).toMatchObject({ admitted: false, reason: "REVOKED" });
    expect(await f.call("restoreInvitation", { email: "ada@example.com" }, admin)).toMatchObject({
      status: "pending",
      sites: ["streamlane.app", "driftline.app"],
    });
  });

  it("refuses an invitation that is not bound", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    await expect(f.call("rebindInvitation", { email: "ada@example.com" }, admin)).rejects.toThrow("NOT_BOUND");
  });
});

describe("updateSubmission", () => {
  it("declined: sets the status, the reviewer and a 12-month expiry on the submission and its Activity", async () => {
    const f = fixture();
    await submission(f, "SUB1", "ada@example.com");
    await f.store.write({ put: { table: "Activity", item: { id: "ACT1", subjectId: "SUB1", at: "2026-10-01" } } });
    const updated = await f.call("updateSubmission", { id: "SUB1", status: "declined", notes: "Not now" }, admin);
    const expiry = Date.parse("2027-10-05T12:00:00Z") / 1000;
    expect(updated).toMatchObject({
      status: "declined",
      notes: "Not now",
      expiresAt: expiry,
      statusAt: "2026-10-05T12:00:00.000Z",
    });
    for (const activity of f.store.all("Activity")) expect(activity.expiresAt).toBe(expiry);
    expect(
      f.store
        .all("Activity")
        .map((a) => String(a.kind ?? "earlier"))
        .sort(),
    ).toEqual(["earlier", "interest.note_added", "interest.status_changed"]);
  });

  it("reopened: clears the expiry again", async () => {
    const f = fixture();
    await submission(f, "SUB1", "ada@example.com");
    await f.call("updateSubmission", { id: "SUB1", status: "archived" }, admin);
    const reopened = await f.call("updateSubmission", { id: "SUB1", status: "reviewing" }, admin);
    expect((reopened as { expiresAt?: number }).expiresAt).toBeUndefined();
    for (const activity of f.store.all("Activity")) expect(activity.expiresAt).toBeUndefined();
  });

  it("never moves a submission out of invited, nor into it: invite sets that, with an invitation", async () => {
    const f = fixture();
    await submission(f, "SUB1", "ada@example.com");
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"], submissionId: "SUB1" }, admin);
    const before = await f.store.get("Submission", { id: "SUB1" });
    // A tab left open from before the invite sends the status it had.
    await expect(f.call("updateSubmission", { id: "SUB1", status: "declined" }, admin)).rejects.toThrow("INVITED");
    await expect(f.call("updateSubmission", { id: "SUB1", status: "new", notes: "x" }, admin)).rejects.toThrow(
      "INVITED",
    );
    expect(await f.store.get("Submission", { id: "SUB1" })).toEqual(before);
    // Notes on an invited submission are still the admin's, and sending `invited` back unchanged is no change.
    expect(await f.call("updateSubmission", { id: "SUB1", status: "invited", notes: "Met" }, admin)).toMatchObject({
      status: "invited",
      notes: "Met",
    });
    await submission(f, "SUB2", "bea@example.com");
    await expect(f.call("updateSubmission", { id: "SUB2", status: "invited" }, admin)).rejects.toThrow(
      "INVITE_REQUIRED",
    );
  });

  it("writes only what changed, and nothing at all when nothing did", async () => {
    const f = fixture();
    await submission(f, "SUB1", "ada@example.com", { notes: "Keep" });
    const before = await f.store.get("Submission", { id: "SUB1" });
    expect(await f.call("updateSubmission", { id: "SUB1", status: "new", notes: " Keep " }, admin)).toEqual(before);
    expect(await f.store.get("Submission", { id: "SUB1" })).toEqual(before);
    expect(f.store.all("Activity")).toEqual([]);

    f.at("2026-10-06T00:00:00.000Z");
    const noted = await f.call("updateSubmission", { id: "SUB1", status: "new", notes: "Called" }, admin);
    expect(noted).toMatchObject({ status: "new", statusAt: before?.statusAt, notes: "Called" });
    expect((noted as Record<string, unknown>).reviewedBy).toBeUndefined();
    expect(f.store.all("Activity").map((a) => a.kind)).toEqual(["interest.note_added"]);
  });

  it("refuses to overwrite a status changed since it was read", async () => {
    const f = fixture();
    await submission(f, "SUB1", "ada@example.com");
    const read = f.store.get.bind(f.store);
    // The invite lands between updateSubmission's read and its write.
    f.store.get = async (table, key) => {
      const item = await read(table, key);
      if (table === "Submission") {
        await f.store.write({ update: { table: "Submission", key: { id: "SUB1" }, set: { status: "invited" } } });
      }
      return item;
    };
    await expect(f.call("updateSubmission", { id: "SUB1", status: "declined" }, admin)).rejects.toThrow("CONFLICT");
    f.store.get = read;
    expect((await f.store.get("Submission", { id: "SUB1" }))?.status).toBe("invited");
  });

  it("refuses a missing submission, an unknown status and over-long notes", async () => {
    const f = fixture();
    await submission(f, "SUB1", "ada@example.com");
    await expect(f.call("updateSubmission", { id: "NOPE" }, admin)).rejects.toThrow("NO_SUBMISSION");
    await expect(f.call("updateSubmission", { id: "SUB1", status: "won" }, admin)).rejects.toThrow("BAD_STATUS");
    await expect(f.call("updateSubmission", { id: "SUB1", notes: "x".repeat(4001) }, admin)).rejects.toThrow(
      "TEXT_TOO_LONG",
    );
  });
});
