import { retention } from "../../areas/retention.ts";
import { documents, graphql } from "../shared/data-client.ts";
import { errorName, log } from "../shared/log.ts";

export type Stale = { personId?: string | null };

export type RetentionDeps = {
  /** Invitations in `status` whose last change is before `before`, every page. */
  stale(status: "pending" | "revoked", before: string): Promise<Stale[]>;
  deletePerson(personId: string): Promise<void>;
  now(): Date;
};

/**
 * Deletes each Person whose invitation is still pending, or revoked, 12 months after its last change, with everything
 * deletePerson removes (their Cognito user included). One failure is logged and the sweep goes on; the next day's run
 * tries again. It logs counts and ids only.
 */
export const createRetention = (deps: RetentionDeps) => async () => {
  const before = new Date(deps.now().getTime() - retention.inactiveInvitation.seconds * 1000).toISOString();
  let deleted = 0;
  let failed = 0;
  for (const status of ["pending", "revoked"] as const) {
    for (const invitation of await deps.stale(status, before)) {
      if (typeof invitation.personId !== "string" || !invitation.personId) continue;
      try {
        await deps.deletePerson(invitation.personId);
        deleted += 1;
      } catch (error) {
        failed += 1;
        log("retention.failed", { personId: invitation.personId, error: errorName(error) });
      }
    }
  }
  log("retention.swept", { deleted, failed, status: failed ? "partial" : "ok" });
  return { deleted, failed };
};

type Page = { listInvitationsByStatus: { items: Stale[]; nextToken?: string | null } };

export const handler = createRetention({
  async stale(status, before) {
    const found: Stale[] = [];
    let nextToken: string | null | undefined;
    do {
      const { listInvitationsByStatus: page } = await graphql<Page>(documents.listInvitationsByStatus, {
        status,
        statusAt: { lt: before },
        nextToken,
      });
      found.push(...page.items);
      nextToken = page.nextToken;
    } while (nextToken);
    return found;
  },
  async deletePerson(personId) {
    await graphql(documents.deletePerson, { personId });
  },
  now: () => new Date(),
});
