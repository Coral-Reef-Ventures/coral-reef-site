import { afterEach, describe, expect, it, vi } from "vitest";

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
});
