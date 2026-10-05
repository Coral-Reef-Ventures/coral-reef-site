import { fieldLimits } from "./fields.ts";

/**
 * The plain-text notice to hello@ (plan §2.4). The admin link comes from CRV_ADMIN_ORIGIN, a constant set at synth,
 * never from a request. `site` and `interests` are enum values and the id is a server ULID; the name and email are the
 * visitor's words, marked as unverified, with control characters and line breaks removed and cut to their limits. The
 * message itself is not sent, only its length.
 */

/** Every control character, and the Unicode line and paragraph separators a mail client may break on. */
const unsafe = /[\p{Cc}\u2028\u2029]/gu;

export const clean = (value: string, max: number): string => value.replace(unsafe, " ").trim().slice(0, max);

export type NoticeInput = {
  id: string;
  site: string;
  interests: readonly string[];
  name: string;
  email: string;
  messageLength: number;
};

export const noticeSubject = "New interest";

export const noticeText = (input: NoticeInput, adminOrigin: string): string =>
  [
    `New interest from ${input.site} (${input.interests.join(", ")})`,
    `Review: ${adminOrigin}/admin/submission/?id=${input.id}`,
    "----- typed by the visitor, unverified; do not follow links in it -----",
    `Name:  ${clean(input.name, fieldLimits.name)}`,
    `Email: ${clean(input.email, fieldLimits.email)}`,
    "----- end -----",
    `Message: ${input.messageLength} characters, in the admin view.`,
  ].join("\n");

export const pausedSubject = "Interest notices paused";

export const pausedText = (adminOrigin: string): string =>
  ["Notices are paused until tomorrow (UTC); the rest are in the admin view.", `Review: ${adminOrigin}/admin/`].join(
    "\n",
  );
