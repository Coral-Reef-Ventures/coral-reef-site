import { describe, expect, it, vi } from "vitest";

import type { DoorApi } from "../../../infrastructure/amplify/types.ts";
import {
  decodeAdminReturn,
  decodeRequest,
  encodeAdminReturn,
  encodeRequest,
  enter,
  isDoorAction,
  readDoorRequest,
} from "./enter.ts";
import { canonicalNext } from "./next.ts";
import { postTicket } from "./postTicket.ts";
import { signoutChainStart } from "./sites.ts";

const state = "abcdefghijklmnopqrstuv";
const query = (extra: Record<string, string> = {}) =>
  new URLSearchParams({ site: "driftline", host: "driftline.app", next: "/docs/", state, ...extra }).toString();

describe("canonicalNext", () => {
  const host = "driftline.app";
  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r\nSet-Cookie:x",
    "https://evil.com",
    "",
    "x",
  ])("refuses %j", (next) => expect(canonicalNext(next, host)).toBe("/"));
  it("reduces to a path and keeps the query", () => {
    expect(canonicalNext("/docs/?a=1#frag", host)).toBe("/docs/?a=1");
    expect(canonicalNext("/.//evil.com", host)).toBe("/");
    expect(canonicalNext("/..//evil.com", host)).toBe("/");
    expect(canonicalNext("/%2F%2Fevil.com", host)).toBe("/%2F%2Fevil.com");
  });
  it("refuses more than 512 characters", () => expect(canonicalNext(`/${"a".repeat(512)}`, host)).toBe("/"));
});

describe("readDoorRequest", () => {
  it("reads the gate's redirect", () => {
    const request = readDoorRequest(query());
    expect(request?.site.id).toBe("driftline");
    expect(request?.next).toBe("/docs/");
  });
  it.each([
    ["an unknown site", { site: "markset" }],
    ["a host that is not the site's", { host: "evil.com" }],
    ["a short state", { state: "abc" }],
    ["a state with odd characters", { state: `${"a".repeat(21)}!` }],
  ])("is not a request with %s", (_name, extra) => expect(readDoorRequest(query(extra))).toBeNull());
  it("survives the trip through Google", () => {
    const request = readDoorRequest(query());
    expect(request && decodeRequest(encodeRequest(request))).toEqual(request);
    expect(decodeRequest("not json")).toBeNull();
  });
});

const api = (over: Partial<DoorApi>): DoorApi => ({
  submitInterest: vi.fn(),
  hasSession: vi.fn(),
  completeRedirect: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  enterDoor: vi.fn(),
  issueSiteTicket: vi.fn(),
  ...over,
});

const grants = [
  { site: "driftline", host: "driftline.app" },
  { site: "streamlane", host: "streamlane.app" },
];

describe("enter", () => {
  const request = readDoorRequest(query());

  it("gets a ticket for the site that asked, when the grant covers it", async () => {
    const issue = vi.fn().mockResolvedValue({ action: "https://driftline.app/_door", ticket: "t" });
    const result = await enter(
      api({ enterDoor: async () => ({ invited: true, grants, admin: false }), issueSiteTicket: issue }),
      request,
    );
    expect(result).toEqual({
      kind: "ticket",
      ticket: { action: "https://driftline.app/_door", ticket: "t", next: "/docs/" },
    });
    expect(issue).toHaveBeenCalledWith({ site: "driftline", host: "driftline.app", next: "/docs/", state });
  });

  it("lists the sites to continue to when nothing asked", async () => {
    const result = await enter(api({ enterDoor: async () => ({ invited: true, grants, admin: true }) }), null);
    expect(result.kind).toBe("continue");
    if (result.kind === "continue") {
      expect(result.grants.map((site) => site.id)).toEqual(["driftline", "streamlane"]);
      expect(result.admin).toBe(true);
    }
  });

  it("does not ask for a ticket for a site the invitation does not cover", async () => {
    const issue = vi.fn();
    const result = await enter(
      api({
        enterDoor: async () => ({ invited: true, grants: grants.slice(1), admin: false }),
        issueSiteTicket: issue,
      }),
      request,
    );
    expect(result.kind).toBe("continue");
    expect(issue).not.toHaveBeenCalled();
  });

  it("reports why a person is not admitted", async () => {
    const result = await enter(
      api({ enterDoor: async () => ({ invited: false, grants: [], admin: false, reason: "REVOKED" }) }),
      request,
    );
    expect(result).toEqual({ kind: "not-invited", reason: "REVOKED" });
  });

  it("refuses a ticket that points anywhere but the site that asked", async () => {
    const wrong = api({
      enterDoor: async () => ({ invited: true, grants, admin: false }),
      issueSiteTicket: async () => ({ action: "https://streamlane.app/_door", ticket: "t" }),
    });
    await expect(enter(wrong, request)).rejects.toThrow();
  });
});

describe("the admin page a sign-in returns to", () => {
  it.each(["/admin/", "/admin/invitations/", "/admin/activity/", "/admin/submission/?id=01K6ABCDEF"])(
    "carries %s through Google and back",
    (path) => expect(decodeAdminReturn(encodeAdminReturn(path))).toBe(path),
  );

  it.each([
    "//evil.example/",
    "https://evil.example/admin/",
    "/admin/../signout/",
    "/admin//evil",
    "/x/",
    "/admin/a?next=//e",
  ])("never carries %j, only the admin views' own paths", (path) => {
    expect(decodeAdminReturn(encodeAdminReturn(path))).toBe("/admin/");
    expect(decodeAdminReturn(JSON.stringify({ admin: path }))).toBeNull();
  });

  it("is not a site's request, and a site's request is not one", () => {
    expect(decodeRequest(encodeAdminReturn("/admin/"))).toBeNull();
    expect(
      decodeAdminReturn(JSON.stringify({ site: "driftline", host: "driftline.app", next: "/", state })),
    ).toBeNull();
    expect(decodeAdminReturn(undefined)).toBeNull();
    expect(decodeAdminReturn("not json")).toBeNull();
    expect(decodeAdminReturn("null")).toBeNull();
  });
});

describe("isDoorAction", () => {
  it.each(["https://driftline.app/_door", "https://streamlane.app/_door"])("accepts %s", (a) =>
    expect(isDoorAction(a)).toBe(true),
  );
  it.each([
    "http://driftline.app/_door",
    "https://evil.com/_door",
    "https://driftline.app.evil.com/_door",
    "https://driftline.app/other",
    "https://driftline.app/_door?next=1",
    "https://user@driftline.app/_door",
    "https://driftline.app:8443/_door",
    "javascript:alert(1)",
    "/_door",
  ])("refuses %s", (a) => expect(isDoorAction(a)).toBe(false));
});

describe("postTicket", () => {
  const stand = () => {
    const made: Record<string, unknown>[] = [];
    const doc = {
      createElement: (tag: string) => {
        const el: Record<string, unknown> = {
          tag,
          children: [],
          appendChild(c: unknown) {
            (el.children as unknown[]).push(c);
          },
          submit: vi.fn(),
        };
        made.push(el);
        return el;
      },
      body: { appendChild: vi.fn() },
    };
    return { doc, made };
  };

  it("posts the ticket and next as a hidden form, never in the address", () => {
    const { doc, made } = stand();
    postTicket({ action: "https://driftline.app/_door", ticket: "t.t.t", next: "/docs/" }, doc as never);
    const form = made[0] as {
      method: string;
      action: string;
      children: { name: string; value: string }[];
      submit: () => void;
    };
    expect(form.method).toBe("POST");
    expect(form.action).toBe("https://driftline.app/_door");
    expect(form.children.map((c) => [c.name, c.value])).toEqual([
      ["ticket", "t.t.t"],
      ["next", "/docs/"],
    ]);
    expect(form.submit).toHaveBeenCalled();
  });

  it("posts nothing to another address", () => {
    const { doc } = stand();
    expect(() => postTicket({ action: "https://evil.com/_door", ticket: "t", next: "/" }, doc as never)).toThrow();
    expect(doc.body.appendChild).not.toHaveBeenCalled();
  });
});

it("starts the sign-out walk at a fixed address on the first locked site", () => {
  expect(signoutChainStart()).toBe("https://driftline.app/_door/signout?then=streamlane");
});
