/**
 * How long each kind of record is kept (plan §2.3a). The privacy page (`apps/web/content/privacy.md`) quotes these, and
 * `retention.test.ts` fails if the two disagree. Changing a period here is not a schema change, but it is a decision
 * (D3) and changes the privacy page with it, in the same commit.
 *
 * DynamoDB deletes an expired TTL item within a few days of its `expiresAt`, which is why the privacy page says
 * "within a few days after".
 */

const day = 24 * 60 * 60;

/** A period, in seconds and in the words the privacy page uses. */
export type Period = { seconds: number; words: string };

export const retention = {
  /** A declined or archived Submission and its Activity, after the status change. */
  closedSubmission: { seconds: 365 * day, words: "12 months" },
  /** Person, PersonEmail, Invitation, grants and the Cognito user, after a revoked or pending invitation's last change. */
  inactiveInvitation: { seconds: 365 * day, words: "12 months" },
  /** Activity `access.signed_in`. */
  signedIn: { seconds: 365 * day, words: "12 months" },
  /** Activity `access.ticket_issued`. */
  ticketIssued: { seconds: 90 * day, words: "90 days" },
  /** Rate-limit counters. */
  rateCounter: { seconds: 1 * day, words: "24 hours" },
  /** The daily key that rate-limit counters are hashed under: a day of use and a day of grace. */
  rateKey: { seconds: 2 * day, words: "48 hours" },
  /** The locked sites' state cookie, set while the visitor signs in. */
  stateCookie: { seconds: 10 * 60, words: "10 minutes" },
  /** CloudWatch logs of every function and trigger. */
  logs: { seconds: 30 * day, words: "1 month" },
  /** Deleted rows in point-in-time backups: PITR's recovery period. */
  backups: { seconds: 35 * day, words: "35 days" },
} as const satisfies Record<string, Period>;

/** The recovery period every table's point-in-time recovery is set to, in days. */
export const backupDays = retention.backups.seconds / day;

/** A submission still `new` or `reviewing` after this many days is flagged in the admin view. */
export const staleSubmissionDays = 30;

/** The `expiresAt` (epoch seconds) of a record that is kept for `period` from `from`. */
export const expiresAt = (from: Date, period: Period): number => Math.floor(from.getTime() / 1000) + period.seconds;
