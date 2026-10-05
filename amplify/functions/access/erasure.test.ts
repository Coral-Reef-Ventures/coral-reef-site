import { describe, expect, it } from "vitest";

import {
  adminIdentity,
  fixture,
  invitedAndBound,
  roleIdentity,
  roles,
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
