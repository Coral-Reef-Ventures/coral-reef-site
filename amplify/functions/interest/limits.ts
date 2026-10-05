import { createHmac, randomBytes } from "node:crypto";

import { expiresAt, retention } from "../../areas/retention.ts";
import { ConditionFailed, type Store } from "../shared/store.ts";

/**
 * The form's limits in the handler, behind WAF's (plan §2.4): 3 an hour and 10 a day per source address, and 2 a day
 * per email address, each a conditional ADD on a counter in crv-rate-limits that expires after 24 hours. Counters are
 * keyed by HMAC-SHA256 under a random key made once per UTC day in the same table and kept 48 hours; once it is gone,
 * its hashes cannot be reversed. No secret to set, and no address stored.
 */

export const limits = {
  perSourceHour: 3,
  perSourceDay: 10,
  perEmailDay: 2,
  noticesPerDay: 10,
  // WAF's rate rules in front of the API (backend.ts), per address in 5 minutes.
  wafSubmitPerFiveMinutes: 10,
  wafAllPerFiveMinutes: 300,
} as const;

/** The counters' table, as the store names it. */
export const rateTable = "RateLimits";

export type Verdict = { ok: true } | { ok: false; retryAfter: number };

const day = (now: Date) => now.toISOString().slice(0, 10);
const hour = (now: Date) => now.toISOString().slice(0, 13);
const secondsUntil = (now: Date, unit: "hour" | "day"): number => {
  const end = new Date(now);
  if (unit === "hour") end.setUTCMinutes(60, 0, 0);
  else end.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000));
};

export const createLimits = (store: Store, random: (size: number) => Buffer = randomBytes) => {
  /** Today's key: read it, or make it with a conditional put, and read again if another invocation won. */
  const dailyKey = async (now: Date): Promise<Buffer> => {
    const key = { pk: `key#${day(now)}` };
    const found = await store.get(rateTable, key);
    if (typeof found?.secret === "string") return Buffer.from(found.secret, "base64");
    try {
      const secret = random(32).toString("base64");
      await store.write({
        put: {
          table: rateTable,
          item: { ...key, secret, expiresAt: expiresAt(now, retention.rateKey) },
          when: { notExists: "pk" },
        },
      });
      return Buffer.from(secret, "base64");
    } catch (error) {
      if (!(error instanceof ConditionFailed)) throw error;
      const winner = await store.get(rateTable, key);
      if (typeof winner?.secret !== "string") throw error;
      return Buffer.from(winner.secret, "base64");
    }
  };

  const counted = async (pk: string, limit: number, now: Date): Promise<boolean> => {
    try {
      await store.add(
        rateTable,
        { pk },
        "n",
        1,
        { or: [{ notExists: "n" }, { lt: ["n", limit] }] },
        {
          expiresAt: expiresAt(now, retention.rateCounter),
        },
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionFailed) return false;
      throw error;
    }
  };

  return {
    /** Counts one submission against each limit in turn, stopping at the first that is full. */
    async check(sourceIp: string, email: string, now: Date): Promise<Verdict> {
      const secret = await dailyKey(now);
      const hash = (value: string) => createHmac("sha256", secret).update(value).digest("base64url");
      const source = hash(`ip:${sourceIp}`);
      const address = hash(`email:${email.toLowerCase()}`);
      if (!(await counted(`ip-hour#${source}#${hour(now)}`, limits.perSourceHour, now))) {
        return { ok: false, retryAfter: secondsUntil(now, "hour") };
      }
      if (!(await counted(`ip-day#${source}#${day(now)}`, limits.perSourceDay, now))) {
        return { ok: false, retryAfter: secondsUntil(now, "day") };
      }
      if (!(await counted(`email-day#${address}#${day(now)}`, limits.perEmailDay, now))) {
        return { ok: false, retryAfter: secondsUntil(now, "day") };
      }
      return { ok: true };
    },
    /** Today's notice count after this one: 1 to 10 send, 11 sends the pause message, more send nothing. */
    nextNotice: (now: Date): Promise<number> =>
      store.add(rateTable, { pk: `notice#${day(now)}` }, "n", 1, undefined, {
        expiresAt: expiresAt(now, retention.rateCounter),
      }),
  };
};

export type Limits = ReturnType<typeof createLimits>;
