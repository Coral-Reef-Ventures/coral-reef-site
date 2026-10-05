import type { Submission, SubmissionStatus } from "../../../infrastructure/amplify/api.ts";

/** A submission still `new` or `reviewing` after this many days is flagged (plan §2.3a). */
export const STALE_AFTER_DAYS = 30;

export function isStale(submission: Pick<Submission, "status" | "receivedAt">, now: Date): boolean {
  if (submission.status !== "new" && submission.status !== "reviewing") return false;
  const received = new Date(submission.receivedAt).getTime();
  if (Number.isNaN(received)) return false;
  return now.getTime() - received > STALE_AFTER_DAYS * 86_400_000;
}

export function countByStatus(rows: readonly Submission[]): Record<SubmissionStatus, number> {
  const counts: Record<SubmissionStatus, number> = { new: 0, reviewing: 0, invited: 0, declined: 0, archived: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** The page's `?id=` value, or undefined when it is missing or not a plain id. */
export function readSubmissionId(search: string): string | undefined {
  const id = new URLSearchParams(search).get("id");
  return id && /^[0-9A-Za-z_-]{1,64}$/.test(id) ? id : undefined;
}
