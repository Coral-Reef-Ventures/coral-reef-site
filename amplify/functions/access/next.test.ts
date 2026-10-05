import { describe, expect, it } from "vitest";

import { canonicalNext } from "./next.ts";

/** *Canonical next* (plan §3): each case refused, or reduced to a same-origin path. The gate tests the same cases. */
describe("canonicalNext", () => {
  const host = "driftline.app";

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
    "",
    "docs",
    "/\u007f",
    "/\u0000",
  ])("refuses %j", (next) => expect(canonicalNext(next, host)).toBeUndefined());

  it("keeps an encoded path, which is still a path", () => {
    expect(canonicalNext("/%2F%2Fevil.com", host)).toBe("/%2F%2Fevil.com");
  });

  it("re-serialises as path and query, dropping the fragment and resolving dot segments", () => {
    expect(canonicalNext("/docs/?a=1#frag", host)).toBe("/docs/?a=1");
    expect(canonicalNext("/a/../b/", host)).toBe("/b/");
    expect(canonicalNext("/", host)).toBe("/");
  });

  it("refuses more than 512 characters and accepts 512", () => {
    expect(canonicalNext(`/${"a".repeat(511)}`, host)).toBe(`/${"a".repeat(511)}`);
    expect(canonicalNext(`/${"a".repeat(512)}`, host)).toBeUndefined();
  });
});
