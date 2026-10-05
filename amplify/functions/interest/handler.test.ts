import { afterEach, describe, expect, it, vi } from "vitest";

import { memoryStore } from "../../test/memory-store.ts";
import { ulid } from "../shared/ids.ts";
import { modelKeys } from "../shared/models.ts";
import { createInterest, type InterestEvent } from "./interest.ts";
import { createLimits, rateTable } from "./limits.ts";
import { clean, noticeText, pausedText } from "./notice.ts";

const setup = (options: { publish?: (subject: string, message: string) => Promise<void> } = {}) => {
  const store = memoryStore({ ...modelKeys, [rateTable]: ["pk"] });
  const published: { subject: string; message: string }[] = [];
  let now = new Date("2026-10-05T12:00:00.000Z");
  let tick = 0;
  const handler = createInterest({
    store,
    limits: createLimits(store, (size) => Buffer.alloc(size, 7)),
    publish:
      options.publish ??
      (async (subject, message) => {
        published.push({ subject, message });
      }),
    adminOrigin: "https://main.d1example.amplifyapp.com",
    now: () => now,
    id: () => ulid(now.getTime(), new Uint8Array(10).fill(tick++ % 256)),
  });
  return {
    store,
    published,
    handler,
    at: (iso: string) => {
      now = new Date(iso);
    },
  };
};

const body = (over: Record<string, unknown> = {}) => ({
  name: " Ada Lovelace ",
  email: "Ada@Example.com",
  organization: "",
  interests: ["advisor", "funding"],
  message: "I would like to help.",
  site: "driftline",
  website: "",
  ...over,
});
const event = (over: Record<string, unknown> = {}, ip = "203.0.113.9"): InterestEvent => ({
  arguments: body(over),
  identity: { sourceIp: [ip] },
});

describe("submitInterest", () => {
  it("stores the submission and its Activity, creates no Person or address claim, and notifies", async () => {
    const t = setup();
    expect(await t.handler(event())).toEqual({ ok: true });
    const [submission] = t.store.all("Submission");
    expect(submission).toMatchObject({
      __typename: "Submission",
      name: "Ada Lovelace",
      email: "ada@example.com",
      interests: ["funding", "advisor"],
      sourceSite: "driftline",
      status: "new",
      receivedAt: "2026-10-05T12:00:00.000Z",
      statusAt: "2026-10-05T12:00:00.000Z",
    });
    expect(submission?.personId).toBeUndefined();
    expect(t.store.all("Activity")).toEqual([
      expect.objectContaining({ kind: "interest.submitted", subjectId: submission?.id, actorId: "system" }),
    ]);
    expect(t.store.all("Activity")[0]?.personId).toBeUndefined();
    expect(t.store.all("Person")).toEqual([]);
    expect(t.store.all("PersonEmail")).toEqual([]);
    expect(t.published).toHaveLength(1);
    expect(t.published[0]?.message).toContain(`/admin/submission/?id=${submission?.id}`);
  });

  it("answers a filled honeypot as a success and stores and sends nothing", async () => {
    const t = setup();
    expect(await t.handler(event({ website: "http://spam" }))).toEqual({ ok: true });
    expect(t.store.all("Submission")).toEqual([]);
    expect(t.published).toEqual([]);
  });

  // parseContact cases: the same parser and limits the form uses.
  it.each([
    [{ name: "" }, "INVALID_NAME"],
    [{ email: "not-an-address" }, "INVALID_EMAIL"],
    [{ message: "   " }, "INVALID_MESSAGE"],
    [{ message: "x".repeat(4001) }, "INVALID_MESSAGE"],
    [{ name: "x".repeat(121) }, "INVALID_NAME"],
    [{ organization: "x".repeat(201) }, "INVALID_ORGANIZATION"],
    [{ interests: [] }, "INVALID_INTERESTS"],
    [{ interests: ["money"] }, "INVALID_INTERESTS"],
    [{ site: "markset" }, "INVALID_SITE"],
    [{ name: 42 }, "INVALID_NAME"],
  ])("refuses %j with %s and stores nothing", async (over, code) => {
    const t = setup();
    await expect(t.handler(event(over))).rejects.toThrow(code);
    expect(t.store.all("Submission")).toEqual([]);
  });

  it("allows 3 an hour from one source, then answers retryAfter until the hour ends", async () => {
    const t = setup();
    for (let i = 0; i < 3; i++) expect(await t.handler(event({ email: `p${i}@example.com` }))).toEqual({ ok: true });
    expect(await t.handler(event({ email: "p3@example.com" }))).toEqual({ ok: false, retryAfter: 3600 });
    expect(t.store.all("Submission")).toHaveLength(3);
    // Another source is not limited by it.
    expect(await t.handler(event({ email: "q@example.com" }, "198.51.100.1"))).toEqual({ ok: true });
  });

  it("allows 10 a day from one source", async () => {
    const t = setup();
    let accepted = 0;
    for (let hour = 0; hour < 5; hour++) {
      t.at(`2026-10-05T${String(10 + hour).padStart(2, "0")}:30:00.000Z`);
      for (let i = 0; i < 3; i++) {
        const answer = await t.handler(event({ email: `p${hour}-${i}@example.com` }));
        if (answer.ok) accepted += 1;
        else expect(answer.retryAfter).toBeGreaterThan(0);
      }
    }
    expect(accepted).toBe(10);
  });

  it("allows 2 a day for one address, from any source", async () => {
    const t = setup();
    expect(await t.handler(event({}, "198.51.100.1"))).toEqual({ ok: true });
    expect(await t.handler(event({ email: "ADA@example.com" }, "198.51.100.2"))).toEqual({ ok: true });
    expect(await t.handler(event({}, "198.51.100.3"))).toEqual({ ok: false, retryAfter: 12 * 3600 });
  });

  it("keeps hashed counters that expire in 24 hours and no address, under a daily key kept 48 hours", async () => {
    const t = setup();
    await t.handler(event());
    const rows = t.store.all(rateTable);
    expect(JSON.stringify(rows)).not.toContain("example.com");
    expect(JSON.stringify(rows)).not.toContain("203.0.113.9");
    const key = rows.find((row) => String(row.pk).startsWith("key#"));
    expect(key?.expiresAt).toBe(Date.parse("2026-10-07T12:00:00Z") / 1000);
    for (const row of rows.filter((r) => !String(r.pk).startsWith("key#"))) {
      expect(row.expiresAt).toBe(Date.parse("2026-10-06T12:00:00Z") / 1000);
    }
  });

  it("sends at most 10 notices a day, then one that says notices are paused, then none", async () => {
    const t = setup();
    for (let i = 0; i < 13; i++) {
      expect(await t.handler(event({ email: `p${i}@example.com` }, `198.51.100.${i}`))).toEqual({ ok: true });
    }
    expect(t.store.all("Submission")).toHaveLength(13);
    expect(t.published).toHaveLength(11);
    expect(t.published.slice(0, 10).every((n) => n.subject === "New interest")).toBe(true);
    expect(t.published[10]).toEqual({
      subject: "Interest notices paused",
      message: pausedText("https://main.d1example.amplifyapp.com"),
    });
  });

  it("never loses a submission to a failed notice", async () => {
    const t = setup({ publish: async () => Promise.reject(new Error("SNS down")) });
    expect(await t.handler(event())).toEqual({ ok: true });
    expect(t.store.all("Submission")).toHaveLength(1);
  });
});

describe("the notice", () => {
  it("is the plan's plain text, with the visitor's words marked unverified and the message only counted", () => {
    expect(
      noticeText(
        {
          id: "01J0000000000000000000000",
          site: "streamlane",
          interests: ["funding", "design_partner"],
          name: "Ada\r\nBcc: x@evil.com",
          email: "ada@example.com\n",
          messageLength: 42,
        },
        "https://coralreefventures.com",
      ),
    ).toBe(
      [
        "New interest from streamlane (funding, design_partner)",
        "Review: https://coralreefventures.com/admin/submission/?id=01J0000000000000000000000",
        "----- typed by the visitor, unverified; do not follow links in it -----",
        "Name:  Ada  Bcc: x@evil.com",
        "Email: ada@example.com",
        "----- end -----",
        "Message: 42 characters, in the admin view.",
      ].join("\n"),
    );
  });

  it("removes every control character and line separator, and cuts to the field's limit", () => {
    expect(clean("a\u0000b c d\u0085e\u007f", 100)).toBe("a b c d e");
    expect(clean("x".repeat(300), 120)).toHaveLength(120);
  });
});

describe("logging (plan §2.3a)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("never writes a field's value to the console, on any path", async () => {
    const lines: string[] = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        lines.push(args.map(String).join(" "));
      });
    }
    const t = setup({ publish: async () => Promise.reject(new Error("ada@example.com failed")) });
    await t.handler(event());
    await t.handler(event());
    await t.handler(event()); // limited
    await t.handler(event({ website: "spam" }));
    await t.handler(event({ email: "bad" })).catch(() => {});
    expect(lines.length).toBeGreaterThan(3);
    const output = lines.join("\n");
    for (const value of ["Ada", "ada@example.com", "Ada@Example.com", "I would like to help.", "203.0.113.9", "spam"]) {
      expect(output).not.toContain(value);
    }
  });
});
