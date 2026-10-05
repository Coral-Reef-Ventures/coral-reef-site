import { verify } from "node:crypto";

import { describe, expect, it } from "vitest";

import { doorSites } from "../../areas/access/sites.ts";
import { adminIdentity, doorKeys, fixture, invitedAndBound, userIdentity } from "../../test/access-fixture.ts";

const state = "abcdefghijklmnopqrstuvwxyz012345";
const ticketArgs = (over: Record<string, unknown> = {}) => ({
  site: "driftline",
  host: "driftline.app",
  next: "/docs/?a=1#frag",
  state,
  ...over,
});

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("enterDoor", () => {
  it("says an invitee is invited, lists the sites their grants open, and records the sign-in for 12 months", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1", ["driftline"]);
    const answer = await f.call("enterDoor", {}, userIdentity("sub-1"));
    expect(answer).toEqual({ invited: true, grants: [{ site: "driftline", host: "driftline.app" }], admin: false });
    const signedIn = f.store.all("Activity").find((a) => a.kind === "access.signed_in");
    expect(signedIn?.expiresAt).toBe(Date.parse("2027-10-05T12:00:00Z") / 1000);
  });

  it("names the admin group, and creates no Person for a caller who is not bound", async () => {
    const f = fixture();
    expect(await f.call("enterDoor", {}, userIdentity("sub-x", { groups: ["admins"] }))).toEqual({
      invited: false,
      grants: [],
      admin: true,
      reason: "NOT_BOUND",
    });
    expect(f.store.all("Person")).toEqual([]);
  });

  it("refuses a revoked invitee and one whose email changed (read from the user pool when the token has none)", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    f.directory.emails.set("Google_sub-1", "ada@new.example");
    expect(await f.call("enterDoor", {}, userIdentity("sub-1"))).toMatchObject({ reason: "EMAIL_CHANGED" });
    expect(await f.call("enterDoor", {}, userIdentity("sub-1", { email: "ada@example.com" }))).toMatchObject({
      invited: true,
    });
    await f.call("revokeInvitation", { email: "ada@example.com" }, adminIdentity());
    expect(await f.call("enterDoor", {}, userIdentity("sub-1"))).toMatchObject({ invited: false, reason: "REVOKED" });
  });
});

describe("issueSiteTicket", () => {
  it("signs an ES256 ticket with the door key that verifies with its public key alone", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1", ["driftline"]);
    const answer = (await f.call("issueSiteTicket", ticketArgs(), userIdentity("sub-1"))) as {
      action: string;
      ticket: string;
    };
    expect(answer.action).toBe("https://driftline.app/_door");
    const [header, payload, signature] = answer.ticket.split(".") as [string, string, string];
    expect(decode(header)).toEqual({ alg: "ES256", typ: "JWT", kid: f.deps.config.kid });
    const claims = decode(payload);
    const [person] = f.store.all("Person");
    const [grant] = f.store.all("AccessGrant");
    expect(claims).toEqual({
      iss: "https://coralreefventures.com",
      aud: "driftline.app",
      sub: person?.id,
      gid: grant?.id,
      jti: expect.any(String),
      iat: Date.parse("2026-10-05T12:00:00Z") / 1000,
      exp: Date.parse("2026-10-05T13:00:00Z") / 1000,
      st: state,
      next: "/docs/?a=1",
      kid: f.deps.config.kid,
    });
    const raw = Buffer.from(signature, "base64url");
    expect(raw).toHaveLength(64);
    expect(
      verify(
        "sha256",
        Buffer.from(`${header}.${payload}`),
        { key: doorKeys.publicKey, dsaEncoding: "ieee-p1363" },
        raw,
      ),
    ).toBe(true);
  });

  it("records the ticket for 90 days, with ids and the host, never the ticket", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1", ["driftline"]);
    const { ticket } = (await f.call("issueSiteTicket", ticketArgs(), userIdentity("sub-1"))) as { ticket: string };
    const issued = f.store.all("Activity").find((a) => a.kind === "access.ticket_issued");
    expect(issued?.expiresAt).toBe(Date.parse("2027-01-03T12:00:00Z") / 1000);
    expect(issued?.detail).toMatchObject({ site: "driftline", host: "driftline.app" });
    expect(JSON.stringify(f.store.all("Activity"))).not.toContain(ticket);
  });

  it.each([
    ["an unregistered host", { host: "evil.com" }, "UNKNOWN_SITE"],
    ["another site's host", { host: "streamlane.app" }, "UNKNOWN_SITE"],
    ["an unknown site", { site: "markset" }, "UNKNOWN_SITE"],
    ["a short state", { state: "abc" }, "BAD_STATE"],
    ["a state with odd characters", { state: `${"a".repeat(30)}!!` }, "BAD_STATE"],
  ])("refuses %s", async (_name, over, code) => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await expect(f.call("issueSiteTicket", ticketArgs(over), userIdentity("sub-1"))).rejects.toThrow(code);
  });

  // The plan's *Canonical next* cases (§3), refused here rather than reduced.
  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r\nSet-Cookie:x",
    "/.//evil.com",
    "/..//evil.com",
    "https://evil.com",
  ])("refuses next %j", async (next) => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await expect(f.call("issueSiteTicket", ticketArgs({ next }), userIdentity("sub-1"))).rejects.toThrow("BAD_NEXT");
  });

  it("keeps an encoded path, which is still a path", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1");
    const { ticket } = (await f.call(
      "issueSiteTicket",
      ticketArgs({ next: "/%2F%2Fevil.com" }),
      userIdentity("sub-1"),
    )) as { ticket: string };
    expect(decode(ticket.split(".")[1] ?? "").next).toBe("/%2F%2Fevil.com");
  });

  it("refuses a site the grants do not cover, a revoked grant and a revoked invitation", async () => {
    const f = fixture();
    await invitedAndBound(f, "ada@example.com", "sub-1", ["streamlane"]);
    await expect(f.call("issueSiteTicket", ticketArgs(), userIdentity("sub-1"))).rejects.toThrow("NO_GRANT");
    await f.call("setGrants", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    await f.call("issueSiteTicket", ticketArgs(), userIdentity("sub-1"));
    await f.call("setGrants", { email: "ada@example.com", sites: [] }, adminIdentity());
    await expect(f.call("issueSiteTicket", ticketArgs(), userIdentity("sub-1"))).rejects.toThrow("NO_GRANT");
    await f.call("setGrants", { email: "ada@example.com", sites: ["driftline"] }, adminIdentity());
    await f.call("revokeInvitation", { email: "ada@example.com" }, adminIdentity());
    await expect(f.call("issueSiteTicket", ticketArgs(), userIdentity("sub-1"))).rejects.toThrow("REVOKED");
  });

  it("refuses a caller who is not bound, and one whose email changed", async () => {
    const f = fixture();
    await expect(f.call("issueSiteTicket", ticketArgs(), userIdentity("nobody"))).rejects.toThrow("NOT_BOUND");
    await invitedAndBound(f, "ada@example.com", "sub-1");
    await expect(
      f.call("issueSiteTicket", ticketArgs(), userIdentity("sub-1", { email: "ada@new.example" })),
    ).rejects.toThrow("EMAIL_CHANGED");
  });

  it("issues for a temporary host listed in CRV_DOOR_TEST_HOSTS, under the site's own grant", async () => {
    const f = fixture({ sites: doorSites("driftline:main.d123.amplifyapp.com") });
    await invitedAndBound(f, "ada@example.com", "sub-1", ["driftline"]);
    const answer = (await f.call(
      "issueSiteTicket",
      ticketArgs({ host: "main.d123.amplifyapp.com" }),
      userIdentity("sub-1"),
    )) as { action: string; ticket: string };
    expect(answer.action).toBe("https://main.d123.amplifyapp.com/_door");
    expect(decode(answer.ticket.split(".")[1] ?? "").aud).toBe("main.d123.amplifyapp.com");
  });
});
