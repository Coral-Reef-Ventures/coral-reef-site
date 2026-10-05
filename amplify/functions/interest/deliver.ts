import { row } from "../shared/models.ts";
import type { Store } from "../shared/store.ts";

export type Submission = {
  id: string;
  name: string;
  email: string;
  organization: string;
  interests: string[];
  message: string;
  sourceSite: string;
};

/**
 * Stores a submission and its Activity `interest.submitted` in one transaction (plan §2.4). It never claims a
 * PersonEmail or creates a Person: an address typed into a form is unverified, so it stays out of the spine until an
 * admin invites it.
 */
export const deliver = async (store: Store, submission: Submission, now: Date, activityId: string): Promise<void> => {
  const at = now.toISOString();
  await store.transact([
    {
      put: {
        table: "Submission",
        item: row("Submission", { ...submission, status: "new", statusAt: at, receivedAt: at }, now),
        when: { notExists: "id" },
      },
    },
    {
      put: {
        table: "Activity",
        item: row(
          "Activity",
          {
            id: activityId,
            actorId: "system",
            area: "interest",
            kind: "interest.submitted",
            subjectType: "Submission",
            subjectId: submission.id,
            at,
            detail: { site: submission.sourceSite, interests: submission.interests },
          },
          now,
        ),
        when: { notExists: "id" },
      },
    },
  ]);
};
