import { afterEach, describe, expect, it, vi } from "vitest";

import { adminIdentity, fixture, roleIdentity, roles, submit } from "../../test/access-fixture.ts";
import { indexes } from "../shared/models.ts";
import { createRetention } from "./handler.ts";

describe("crv-retention", () => {
  afterEach(() => vi.restoreAllMocks());

  it("deletes everyone whose invitation has been pending or revoked for 12 months, and carries on past a failure", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => lines.push(String(line)));
    const stale = vi.fn(async (status: "pending" | "revoked") =>
      status === "pending" ? [{ personId: "P1" }, { personId: null }] : [{ personId: "P2" }, { personId: "P3" }],
    );
    const deletePerson = vi.fn(async (id: string) => {
      if (id === "P2") throw new Error("boom");
    });
    const sweep = createRetention({ stale, deletePerson, now: () => new Date("2026-10-05T03:00:00.000Z") });
    expect(await sweep()).toEqual({ deleted: 2, failed: 1 });
    expect(stale.mock.calls).toEqual([
      ["pending", "2025-10-05T03:00:00.000Z"],
      ["revoked", "2025-10-05T03:00:00.000Z"],
    ]);
    expect(deletePerson.mock.calls.map(([id]) => id)).toEqual(["P1", "P2", "P3"]);
    // Counts, ids and an error's name: never the error's message.
    expect(lines.join("\n")).not.toContain("boom");
    expect(lines.at(-1)).toBe(JSON.stringify({ kind: "retention.swept", deleted: 2, failed: 1, status: "partial" }));
  });

  it("takes a stale invitee's submission with them, though it was sent from another address", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const f = fixture();
    await submit(f, "SUB1", "ada@example.com");
    await submit(f, "SUB2", "bob@example.com");
    // Invited at a work address from what she sent from home, and never signed in.
    await f.call("invite", { email: "ada@work.example", sites: ["driftline"], submissionId: "SUB1" }, adminIdentity());
    f.at("2027-10-06T03:00:00.000Z");
    const index = indexes.invitationByStatus;
    const sweep = createRetention({
      // The query the real sweep sends, Invitation.byStatus below the cutoff, run against the fixture's tables.
      stale: async (status, before) =>
        f.store.query({
          table: index.model,
          index: index.name,
          partition: [index.partition, status],
          sort: { name: index.sort, below: before },
        }),
      deletePerson: async (personId) => {
        await f.call("deletePerson", { personId }, roleIdentity(roles.retention));
      },
      now: () => f.deps.now(),
    });

    expect(await sweep()).toEqual({ deleted: 1, failed: 0 });
    for (const table of ["Person", "PersonEmail", "Invitation", "AccessGrant"]) {
      expect(f.store.all(table), table).toEqual([]);
    }
    expect(f.store.all("Submission").map((s) => s.id)).toEqual(["SUB2"]);
    expect(
      f.store
        .all("Activity")
        .map((a) => a.kind)
        .sort(),
    ).toEqual(["interest.submitted", "people.deleted"]);
    expect(f.store.all("Activity").find((a) => a.kind === "interest.submitted")?.subjectId).toBe("SUB2");
  });
});
