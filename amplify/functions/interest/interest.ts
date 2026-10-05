import { parseContact } from "@coralreefventures/contact";

import { errorName, log } from "../shared/log.ts";
import type { Store } from "../shared/store.ts";
import { deliver } from "./deliver.ts";
import { contactConfig, interestValues, sourceSiteValues } from "./fields.ts";
import type { Limits } from "./limits.ts";
import { limits as caps } from "./limits.ts";
import { noticeSubject, noticeText, pausedSubject, pausedText } from "./notice.ts";

export type InterestDeps = {
  store: Store;
  limits: Limits;
  publish(subject: string, message: string): Promise<void>;
  adminOrigin: string;
  now(): Date;
  id(): string;
};

export type InterestEvent = {
  arguments?: Record<string, unknown>;
  identity?: { sourceIp?: string[] } | null;
};

export type InterestAnswer = { ok: boolean; retryAfter?: number };

/** A refusal reaches the caller as its code alone: which field, never what was in it. */
export class Invalid extends Error {
  constructor(field: string) {
    super(`INVALID_${field.toUpperCase()}`);
    this.name = "Invalid";
  }
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * The address the per-source limits are keyed on: the last entry of AppSync's `sourceIp`. AppSync lists the
 * addresses from the caller's `X-Forwarded-For` header first, in order and unchecked, and appends the TCP connection's
 * address (seen on the agent sandbox, 2026-10-05: `X-Forwarded-For: 198.51.100.77, 203.0.113.5` arrived as those two
 * and then the peer). Nothing sits in front of AppSync here, so every entry but the last is whatever the caller chose
 * to write. Keying on the first would give a caller a fresh source, and fresh limits, with every request.
 */
export const sourceAddress = (identity: InterestEvent["identity"]): string => identity?.sourceIp?.at(-1) ?? "unknown";

/**
 * The resolver for submitInterest, a guest mutation (plan §2.4). It answers only `{ ok, retryAfter? }` and reads
 * nothing back. A filled honeypot is answered as if it worked and goes nowhere. Over a limit, it answers with
 * `retryAfter` and writes nothing else. Otherwise it stores first and notifies second, so a failed notice never loses a
 * submission. It logs an event kind, the submission's id and a status, never a field's value.
 *
 * An invalid field reaches the guest as its code; any other failure, a DynamoDB or SNS error included, as `INTERNAL`
 * alone, as crv-access answers. An SDK error's message can carry a table name, a key or an attribute's value, and a
 * guest is the last caller that should see one; thrown out of the handler, the runtime would also log it whole.
 */
export const createInterest = (deps: InterestDeps) => {
  const submit = submitWith(deps);
  return async (event: InterestEvent): Promise<InterestAnswer> => {
    try {
      return await submit(event);
    } catch (error) {
      if (error instanceof Invalid) throw error;
      log("interest.failed", { status: "INTERNAL", error: errorName(error) });
      throw new Error("INTERNAL");
    }
  };
};

const submitWith =
  (deps: InterestDeps) =>
  async (event: InterestEvent): Promise<InterestAnswer> => {
    const args = event.arguments ?? {};
    if (text(args.website) !== "") {
      log("interest.honeypot", { status: "dropped" });
      return { ok: true };
    }
    const chosen = Array.isArray(args.interests) ? args.interests.map(text) : [];
    if (chosen.some((value) => !(interestValues as readonly string[]).includes(value))) throw new Invalid("interests");
    const interests = interestValues.filter((value) => chosen.includes(value));
    const site = text(args.site);
    if (!(sourceSiteValues as readonly string[]).includes(site)) throw new Invalid("site");
    const parsed = parseContact(
      {
        name: text(args.name),
        email: text(args.email),
        organization: text(args.organization),
        interests: interests.join(","),
        message: text(args.message),
        site,
      },
      contactConfig,
    );
    if ("error" in parsed) throw new Invalid(parsed.error.split(" ")[0] ?? "body");

    const now = deps.now();
    const email = parsed.email.toLowerCase();
    const verdict = await deps.limits.check(sourceAddress(event.identity), email, now);
    if (!verdict.ok) {
      log("interest.limited", { status: "limited", retryAfter: verdict.retryAfter });
      return { ok: false, retryAfter: verdict.retryAfter };
    }

    const id = deps.id();
    await deliver(
      deps.store,
      {
        id,
        name: parsed.name,
        email,
        organization: parsed.organization,
        interests: [...interests],
        message: parsed.message,
        sourceSite: site,
      },
      now,
      deps.id(),
    );
    log("interest.stored", { id, site, status: "stored" });

    try {
      const count = await deps.limits.nextNotice(now);
      if (count <= caps.noticesPerDay) {
        await deps.publish(
          noticeSubject,
          noticeText(
            { id, site, interests, name: parsed.name, email, messageLength: parsed.message.length },
            deps.adminOrigin,
          ),
        );
        log("interest.noticed", { id, status: "sent", count });
      } else if (count === caps.noticesPerDay + 1) {
        await deps.publish(pausedSubject, pausedText(deps.adminOrigin));
        log("interest.noticed", { id, status: "paused", count });
      } else {
        log("interest.noticed", { id, status: "capped", count });
      }
    } catch (error) {
      log("interest.notice_failed", { id, status: "failed", error: errorName(error) });
    }
    return { ok: true };
  };
