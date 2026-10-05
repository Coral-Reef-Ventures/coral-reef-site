import { describe, expect, it } from "vitest";

import {
  adminIdentity,
  fixture,
  invitedAndBound,
  roleIdentity,
  roles,
  signIn,
  signUp,
  userIdentity,
} from "../../test/access-fixture.ts";
import { row } from "../shared/models.ts";

const admin = adminIdentity();

const submit = async (f: ReturnType<typeof fixture>, id: string, email: string) => {
  const now = new Date("2026-10-01T00:00:00Z");
  await f.store.write({
    put: {
      table: "Submission",
      item: row(
        "Submission",
        {
          id,
          name: "N",
          email,
          interests: ["other"],
          message: "m",
          sourceSite: "crv",
          status: "new",
          statusAt: now.toISOString(),
          receivedAt: now.toISOString(),
        },
        now,
      ),
    },
  });
  await f.store.write({
    put: {
      table: "Activity",
      item: row(
        "Activity",
        {
          id: `A-${id}`,
          actorId: "system",
          area: "interest",
          kind: "interest.submitted",
          subjectType: "Submission",
          subjectId: id,
          at: now.toISOString(),
        },
        now,
      ),
    },
  });
};

describe("deletePerson", () => {
  it("removes the Person, their address claim, invitation, grants, Activity, submissions and Cognito user", async () => {
    const f = fixture();
    await submit(f, "SUB1", "ada@example.com");
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await f.call("enterDoor", {}, userIdentity("sub-1"));
    const personId = String(f.store.all("Person")[0]?.id);

    expect(await f.call("deletePerson", { personId }, admin)).toEqual({ ok: true });
    for (const table of ["Person", "PersonEmail", "Invitation", "AccessGrant", "Submission"]) {
      expect(f.store.all(table), table).toEqual([]);
    }
    // Only the record of the deletion is left, and it names no Person and no address.
    const left = f.store.all("Activity");
    expect(left.map((a) => a.kind)).toEqual(["people.deleted"]);
    expect(left[0]?.personId).toBeUndefined();
    expect(JSON.stringify(left)).not.toContain("ada@example.com");
    expect(f.directory.remove).toHaveBeenCalledWith("Google_sub-1");
  });

  it("is what the retention sweep may call, and refuses a Person that does not exist", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    const personId = String(f.store.all("Person")[0]?.id);
    expect(await f.call("deletePerson", { personId }, roleIdentity(roles.retention))).toEqual({ ok: true });
    expect(f.directory.remove).not.toHaveBeenCalled();
    await expect(f.call("deletePerson", { personId }, admin)).rejects.toThrow("NO_PERSON");
  });

  it("leaves another person's address claim alone", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    const personId = String(f.store.all("Person")[0]?.id);
    await f.store.write({ put: { table: "PersonEmail", item: { email: "ada@example.com", personId: "SOMEONE" } } });
    await f.call("deletePerson", { personId }, admin);
    expect(f.store.all("PersonEmail")).toEqual([{ email: "ada@example.com", personId: "SOMEONE" }]);
  });
});

describe("every Cognito user the app created reaches erasure", () => {
  it("deletePerson after a cleared rebind: the old user went at the rebind, the new one goes now", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await f.call("rebindInvitation", { email: "ada@example.com" }, admin);
    await signUp(f, "ada@example.com", "sub-2");
    await signIn(f, "ada@example.com", "sub-2");
    const personId = String(f.store.all("Person")[0]?.id);
    await f.call("deletePerson", { personId }, admin);
    const removed = new Set(f.directory.remove.mock.calls.map(([username]) => username));
    expect(removed).toEqual(new Set(["Google_sub-1", "Google_sub-2"]));
    expect(f.store.all("Invitation")).toEqual([]);
  });

  it("a user pre sign-up created that never bound, the loser of two identities: deleted when it is refused", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    await signUp(f, "ada@example.com", "sub-1");
    await signUp(f, "ada@example.com", "sub-2");
    await signIn(f, "ada@example.com", "sub-1");
    expect(await signIn(f, "ada@example.com", "sub-2")).toMatchObject({ admitted: false });
    expect(f.directory.remove.mock.calls).toEqual([["Google_sub-2"]]);
    // And again, by name, when the person is erased, whether or not that first deletion worked.
    await f.call("eraseEmail", { email: "ada@example.com" }, admin);
    expect(new Set(f.directory.remove.mock.calls.slice(1).map(([u]) => u))).toEqual(
      new Set(["Google_sub-1", "Google_sub-2"]),
    );
  });

  it("a user whose pre token generation never ran, its invitation then revoked: the retention sweep deletes it", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    await signUp(f, "ada@example.com", "sub-1");
    await f.call("revokeInvitation", { email: "ada@example.com" }, admin);
    const personId = String(f.store.all("Person")[0]?.id);
    await f.call("deletePerson", { personId }, roleIdentity(roles.retention));
    expect(f.directory.remove).toHaveBeenCalledWith("Google_sub-1");
  });

  it("eraseEmail reaches a never-bound user on an invitation whose Person is gone", async () => {
    const f = fixture();
    await f.call("invite", { email: "ada@example.com", sites: ["driftline"] }, admin);
    await signUp(f, "ada@example.com", "sub-1");
    await f.store.write({ delete: { table: "PersonEmail", key: { email: "ada@example.com" } } });
    await f.call("eraseEmail", { email: "ada@example.com" }, admin);
    expect(f.directory.remove).toHaveBeenCalledWith("Google_sub-1");
    expect(f.store.all("Invitation")).toEqual([]);
  });

  it("deletes the users before the rows that name them, so a failure can be retried", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    const personId = String(f.store.all("Person")[0]?.id);
    f.directory.remove.mockRejectedValueOnce(new Error("throttled"));
    await expect(f.call("deletePerson", { personId }, admin)).rejects.toThrow("INTERNAL");
    expect(f.store.all("Invitation")[0]?.cognitoUsername).toBe("Google_sub-1");
    expect(await f.call("deletePerson", { personId }, admin)).toEqual({ ok: true });
    expect(f.directory.remove).toHaveBeenLastCalledWith("Google_sub-1");
  });
});

describe("eraseEmail", () => {
  it("erases an address someone else submitted: its submissions and their Activity, with no Person to delete", async () => {
    const f = fixture();
    await submit(f, "SUB1", "third@example.com");
    await submit(f, "SUB2", "third@example.com");
    await submit(f, "SUB3", "other@example.com");
    expect(await f.call("eraseEmail", { email: "Third@Example.com" }, admin)).toEqual({ ok: true });
    expect(f.store.all("Submission").map((s) => s.id)).toEqual(["SUB3"]);
    expect(
      f.store
        .all("Activity")
        .map((a) => a.kind)
        .sort(),
    ).toEqual(["interest.submitted", "people.deleted"]);
    expect(f.store.all("Activity").find((a) => a.kind === "people.deleted")?.detail).toEqual({ submissions: 2 });
  });

  it("deletes the Person too when the address is claimed", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await f.call("eraseEmail", { email: "ada@example.com" }, admin);
    for (const table of ["Person", "PersonEmail", "Invitation", "AccessGrant"])
      expect(f.store.all(table), table).toEqual([]);
    expect(f.directory.remove).toHaveBeenCalledWith("Google_sub-1");
  });
});
