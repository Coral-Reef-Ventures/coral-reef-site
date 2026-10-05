import { expiresAt, retention } from "../../../areas/retention.ts";
import { indexes } from "../../shared/models.ts";
import { type Cond, ConditionFailed, type Item, type Write } from "../../shared/store.ts";
import type { Caller } from "../caller.ts";
import { activity, type Deps, Refusal } from "../context.ts";
import { actorId, optionalText } from "./common.ts";

export const submissionStatuses = ["new", "reviewing", "invited", "declined", "archived"] as const;
const closed = new Set(["declined", "archived"]);

/**
 * Status and notes on a submission. A declined or archived one, with its Activity, expires 12 months after the change
 * (plan §2.3a); reopening it clears the expiry.
 *
 * `invited` belongs to invite: a submission reaches it only with an invitation, and never leaves it here, so a tab left
 * open from before the invite cannot send its old status back, undo the invite and set a 12-month expiry on a
 * submission now kept with its Person. Only what changed is written; a save that changes nothing writes nothing.
 */
export const updateSubmission = async (
  deps: Deps,
  caller: Caller,
  args: { id?: unknown; status?: unknown; notes?: unknown },
) => {
  const id = typeof args.id === "string" ? args.id : "";
  const submission = id ? await deps.store.get("Submission", { id }) : undefined;
  if (!submission) throw new Refusal("NO_SUBMISSION");
  const status = args.status === undefined || args.status === null ? undefined : String(args.status);
  if (status !== undefined && !(submissionStatuses as readonly string[]).includes(status)) {
    throw new Refusal("BAD_STATUS");
  }
  const notes = optionalText(args.notes, 4000);
  const statusChanged = status !== undefined && status !== submission.status;
  const notesChanged = notes !== undefined && notes !== (submission.notes ?? "");
  if (statusChanged && submission.status === "invited") throw new Refusal("INVITED");
  if (statusChanged && status === "invited") throw new Refusal("INVITE_REQUIRED");
  if (!statusChanged && !notesChanged) return submission;

  const now = deps.now();
  const at = now.toISOString();
  const actor = await actorId(deps, caller);
  const effective = statusChanged ? status : String(submission.status);
  const expiry = closed.has(effective) ? expiresAt(now, retention.closedSubmission) : undefined;

  const set: Item = { updatedAt: at };
  const remove: string[] = [];
  if (statusChanged) {
    Object.assign(set, { status, statusAt: at, reviewedBy: actor, reviewedAt: at });
    if (expiry === undefined) remove.push("expiresAt");
    else set.expiresAt = expiry;
  }
  if (notesChanged) set.notes = notes;

  // Conditioned on the status read above, so a change made since (an invite in another tab) is not overwritten.
  const when = { and: [{ exists: "id" }, { eq: ["status", String(submission.status)] }] } satisfies Cond;
  const writes: Write[] = [{ update: { table: "Submission", key: { id }, set, remove, when } }];
  if (statusChanged) {
    writes.push(
      activity(deps, {
        actorId: actor,
        kind: "interest.status_changed",
        subjectType: "Submission",
        subjectId: id,
        detail: { from: String(submission.status), to: effective },
        expiresAt: expiry,
      }),
    );
  }
  if (notesChanged) {
    writes.push(
      activity(deps, {
        actorId: actor,
        kind: "interest.note_added",
        subjectType: "Submission",
        subjectId: id,
        detail: { length: notes.length },
        expiresAt: expiry,
      }),
    );
  }
  try {
    await deps.store.transact(writes);
  } catch (error) {
    if (error instanceof ConditionFailed) throw new Refusal("CONFLICT");
    throw error;
  }

  if (statusChanged) {
    const index = indexes.activityBySubject;
    const rows = await deps.store.query({
      table: index.model,
      index: index.name,
      partition: [index.partition, id],
      sort: { name: index.sort },
    });
    for (const item of rows) {
      await deps.store.write({
        update:
          expiry === undefined
            ? { table: "Activity", key: { id: String(item.id) }, remove: ["expiresAt"] }
            : { table: "Activity", key: { id: String(item.id) }, set: { expiresAt: expiry } },
      });
    }
  }
  return deps.store.get("Submission", { id });
};
