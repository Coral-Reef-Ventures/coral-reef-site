import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { backupDays, retention } from "./retention.ts";

/** The privacy page quotes the retention periods (plan §2.3a); this fails when the two disagree. */
const privacy = readFileSync(fileURLToPath(new URL("../../apps/web/content/privacy.md", import.meta.url)), "utf8");

describe("the retention periods", () => {
  it.each([
    ["closedSubmission", "One we have declined or archived is deleted 12 months after that decision."],
    ["inactiveInvitation", "A pending or revoked one is deleted 12 months after its last change."],
    ["signedIn", "Sign-in records are kept for 12 months"],
    ["ticketIssued", "records that a site opened for you are kept for 90 days"],
    ["rateCounter", "A request limit keeps a count per source for 24 hours"],
    ["stateCookie", "one for 10 minutes when they send you here to sign in"],
    ["logs", "are deleted after 1 month"],
    ["backups", "Deleted records can remain in backups for up to 35 days."],
  ] as const)("%s is stated on the privacy page as its constant says", (name, sentence) => {
    expect(privacy).toContain(sentence);
    expect(sentence).toContain(retention[name].words);
  });

  it("says deletion happens within a few days after, as DynamoDB's TTL does", () => {
    expect(privacy).toContain("within a few days after");
  });

  it("measures each period in seconds that match its words", () => {
    const day = 86_400;
    expect(retention.closedSubmission.seconds).toBe(365 * day);
    expect(retention.ticketIssued.seconds).toBe(90 * day);
    expect(retention.rateCounter.seconds).toBe(day);
    expect(retention.stateCookie.seconds).toBe(600);
    expect(backupDays).toBe(35);
  });
});
