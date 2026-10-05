import { describe, expect, it, vi } from "vitest";

import { sourceSite, submit, validate, waitPhrase, type FormValues } from "./submit.ts";

const values = (over: Partial<FormValues> = {}): FormValues => ({
  name: " Ada ",
  email: "ada@example.com",
  organization: "",
  interests: ["funding", "advisor"],
  message: "Hello",
  site: "driftline",
  website: "",
  ...over,
});

describe("validate", () => {
  it("trims, joins the interests and names the site", () => {
    const result = validate(values());
    expect(result).toEqual({
      ok: true,
      body: {
        name: "Ada",
        email: "ada@example.com",
        organization: "",
        interests: "funding,advisor",
        message: "Hello",
        site: "driftline",
      },
    });
  });
  it.each([
    [{ name: "" }, "name", "Your name is required."],
    [{ email: "x" }, "email", "Enter a valid email address."],
    [{ interests: [] }, "interests", "Choose at least one way to take part."],
    [{ message: " " }, "message", "Message is required."],
    [{ message: "x".repeat(4001) }, "message", "Message is too long."],
  ] as const)("refuses %j", (over, field, message) => {
    expect(validate(values(over))).toEqual({ ok: false, invalid: { field, message } });
  });
  it("sends crv for a site it does not know", () => {
    const result = validate(values({ site: "<script>" }));
    expect(result.ok && result.body.site).toBe("crv");
  });
});

describe("submit", () => {
  it("sends once and says so", async () => {
    const api = { submitInterest: vi.fn().mockResolvedValue({ ok: true }) };
    expect(await submit(api, values())).toEqual({ kind: "sent" });
    expect(api.submitInterest).toHaveBeenCalledTimes(1);
    expect(api.submitInterest.mock.calls[0]?.[0]).toMatchObject({ interests: "funding,advisor", website: "" });
  });
  it("answers a filled honeypot as a success without sending", async () => {
    const api = { submitInterest: vi.fn() };
    expect(await submit(api, values({ website: "spam" }))).toEqual({ kind: "sent" });
    expect(api.submitInterest).not.toHaveBeenCalled();
  });
  it("does not send an invalid form", async () => {
    const api = { submitInterest: vi.fn() };
    expect((await submit(api, values({ name: "" }))).kind).toBe("invalid");
    expect(api.submitInterest).not.toHaveBeenCalled();
  });
  it("passes on a rate-limited answer", async () => {
    const api = { submitInterest: vi.fn().mockResolvedValue({ ok: false, retryAfter: 600 }) };
    expect(await submit(api, values())).toEqual({ kind: "limited", retryAfter: 600 });
  });
  it("reports a failure", async () => {
    const api = { submitInterest: vi.fn().mockRejectedValue(new Error("x")) };
    expect(await submit(api, values())).toEqual({ kind: "failed" });
  });
});

it("phrases a wait", () => {
  expect(waitPhrase(60)).toBe("in about 1 minute");
  expect(waitPhrase(1200)).toBe("in about 20 minutes");
  expect(waitPhrase(3600)).toBe("in about 1 hour");
  expect(waitPhrase(null)).toBe("later");
});

it("knows the three sites a form is reached from", () => {
  expect([
    sourceSite("streamlane"),
    sourceSite("driftline"),
    sourceSite("crv"),
    sourceSite("x"),
    sourceSite(null),
  ]).toEqual(["streamlane", "driftline", "crv", "crv", "crv"]);
});
