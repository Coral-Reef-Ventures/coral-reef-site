import { describe, expect, it } from "vitest";
import { createStubApi } from "./adminStub.ts";

const fixed = () => new Date("2026-10-05T12:00:00Z");

describe("the stub backend", () => {
  it("lists submissions by status, newest first", async () => {
    const api = createStubApi(fixed);
    expect((await api.listSubmissions("new")).map((s) => s.id)).toEqual(["01STUB-S1"]);
    expect((await api.listSubmissions()).length).toBe(3);
  });

  it("an invite from a submission marks it invited and returns text", async () => {
    const api = createStubApi(fixed);
    const { invitation, text } = await api.invite({
      email: " Ada@Example.com ",
      sites: ["driftline.app"],
      submissionId: "01STUB-S1",
    });
    expect(invitation.email).toBe("ada@example.com");
    expect(text).toContain("ada@example.com");
    expect((await api.getSubmission("01STUB-S1"))?.status).toBe("invited");
  });

  it("refuses to invite a bound address, a repeated one, or no sites", async () => {
    const api = createStubApi(fixed);
    await expect(api.invite({ email: "dee@example.com", sites: ["driftline.app"] })).rejects.toThrow("ALREADY_BOUND");
    await expect(api.invite({ email: "eli@example.com", sites: ["driftline.app"] })).rejects.toThrow("ALREADY_INVITED");
    await expect(api.invite({ email: "new@example.com", sites: [] })).rejects.toThrow("NO_SITES");
  });

  it("revokes and restores, and a bound invitation returns to accepted", async () => {
    const api = createStubApi(fixed);
    expect((await api.revokeInvitation("dee@example.com")).status).toBe("revoked");
    expect((await api.restoreInvitation("dee@example.com")).status).toBe("accepted");
    await expect(api.restoreInvitation("dee@example.com")).rejects.toThrow("NOT_REVOKED");
  });

  it("rebinds with a new address or clears the binding", async () => {
    const api = createStubApi(fixed);
    expect((await api.rebindInvitation("dee@example.com", "dee@new.example")).email).toBe("dee@new.example");
    const cleared = await api.rebindInvitation("dee@new.example");
    expect(cleared.bound).toBe(false);
    expect(cleared.status).toBe("pending");
    await expect(api.rebindInvitation("eli@example.com")).rejects.toThrow("NOT_BOUND");
  });

  it("erasing an address removes its submissions and its person", async () => {
    const api = createStubApi(fixed);
    await api.eraseEmail("ada@example.com");
    expect(await api.getSubmission("01STUB-S1")).toBeNull();
    await api.eraseEmail("dee@example.com");
    expect((await api.listInvitations()).map((i) => i.email)).toEqual(["eli@example.com"]);
    expect((await api.listActivity({ area: "people" })).map((a) => a.kind)).toEqual(["people.deleted"]);
  });

  it("records status and note changes as Activity", async () => {
    const api = createStubApi(fixed);
    await api.updateSubmission({ id: "01STUB-S1", status: "reviewing", notes: "Call booked" });
    const kinds = (await api.listActivity({ subjectId: "01STUB-S1" })).map((a) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(["interest.status_changed", "interest.note_added"]));
  });
});
