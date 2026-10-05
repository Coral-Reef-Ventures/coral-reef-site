import { SUBMISSION_STATUSES, type Submission, type SubmissionStatus } from "../../../infrastructure/amplify/api.ts";

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

export type Review = { status: SubmissionStatus; notes: string };

/**
 * The review form's values after the submission changed under it (a save or an invite reloaded it). The form was
 * seeded from `base`; `server` is what the submission says now. The status always becomes the server's: the only
 * change to it from outside the form is an invite, and a status chosen before that was chosen against a submission
 * that no longer holds, so keeping it would let one Save undo the invite. Notes the admin has typed and not saved are
 * kept; untouched notes follow the server.
 */
export function rebaseReview(form: Review, base: Review, server: Review): Review {
  return { status: server.status, notes: form.notes === base.notes ? server.notes : form.notes };
}

/**
 * The statuses an admin may pick in the review form. `invited` is set by an invite and only by an invite, so it is
 * offered only to a submission that already has it, and a submission that has it offers nothing else: moving it to
 * `declined` or `archived` would give it a 12-month expiry although it must live as long as its Person (plan §2.3a).
 */
export function selectableStatuses(current: SubmissionStatus): SubmissionStatus[] {
  if (current === "invited") return ["invited"];
  return SUBMISSION_STATUSES.filter((s) => s !== "invited");
}
