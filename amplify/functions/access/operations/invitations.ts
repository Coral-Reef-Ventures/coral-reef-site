import { indexes, row } from "../../shared/models.ts";
import { ConditionFailed, type Item, type Write } from "../../shared/store.ts";
import type { Caller } from "../caller.ts";
import { activity, type Deps, Refusal } from "../context.ts";
import {
  activeSites,
  actorId,
  grantsOf,
  grantWrites,
  invitationText,
  invitationView,
  normalEmail,
  optionalText,
  resolveSites,
} from "./common.ts";

/** The admin's operations on invitations (plan §2.3). Each writes Activity naming the Person, never the address. */

const requireInvitation = async (deps: Deps, email: string): Promise<Item> => {
  const invitation = await deps.store.get("Invitation", { email });
  if (!invitation) throw new Refusal("NO_INVITATION");
  return invitation;
};

const personOf = (invitation: Item): string => {
  if (typeof invitation.personId !== "string") throw new Refusal("NO_PERSON");
  return invitation.personId;
};

const commit = async (deps: Deps, writes: Write[]): Promise<void> => {
  try {
    await deps.store.transact(writes);
  } catch (error) {
    if (error instanceof ConditionFailed) throw new Refusal("CONFLICT");
    throw error;
  }
};

export type InviteArgs = { email?: unknown; sites?: unknown; submissionId?: unknown; note?: unknown };

/**
 * Claims the address for a Person (creating one if it has none), creates a `pending` Invitation and its grants, and
 * marks the Submission it came from `invited`. Refuses an address whose invitation is already bound: that is
 * rebindInvitation's job. Returns the invitation text for "Copy invitation".
 */
export const invite = async (deps: Deps, caller: Caller, args: InviteArgs) => {
  const email = normalEmail(args.email);
  const sites = resolveSites(deps, args.sites);
  const note = optionalText(args.note, 500);
  const submissionId = optionalText(args.submissionId, 64) || undefined;

  const existing = await deps.store.get("Invitation", { email });
  if (typeof existing?.cognitoSub === "string") throw new Refusal("ALREADY_BOUND");
  const claim = await deps.store.get("PersonEmail", { email });
  const submission = submissionId ? await deps.store.get("Submission", { id: submissionId }) : undefined;
  if (submissionId && !submission) throw new Refusal("NO_SUBMISSION");

  const now = deps.now();
  const at = now.toISOString();
  const actor = await actorId(deps, caller);
  const known = typeof claim?.personId === "string" ? claim.personId : undefined;
  const personId = known ?? deps.id();
  const grants = known ? await grantsOf(deps, personId) : [];

  const writes: Write[] = [];
  if (!known) {
    writes.push({
      put: {
        table: "Person",
        item: row(
          "Person",
          {
            id: personId,
            email,
            name: typeof submission?.name === "string" ? submission.name : undefined,
            source: submission ? "interest" : "invitation",
          },
          now,
        ),
        when: { notExists: "id" },
      },
    });
  }
  writes.push(
    {
      put: {
        table: "PersonEmail",
        item: row("PersonEmail", { email, personId }, now),
        when: { or: [{ notExists: "email" }, { eq: ["personId", personId] }] },
      },
    },
    {
      put: {
        table: "Invitation",
        item: row(
          "Invitation",
          { email, personId, submissionId, status: "pending", statusAt: at, invitedBy: actor, invitedAt: at, note },
          now,
        ),
        when: { notExists: "cognitoSub" },
      },
    },
    ...grantWrites(deps, personId, grants, sites, { actor, source: "invitation", keep: true }),
    activity(deps, {
      personId,
      actorId: actor,
      kind: "access.invited",
      subjectType: "Person",
      subjectId: personId,
      detail: { sites: sites.map((site) => site.id), ...(submissionId ? { submissionId } : {}) },
    }),
  );
  if (submission && submissionId) {
    writes.push({
      update: {
        table: "Submission",
        key: { id: submissionId },
        set: { status: "invited", statusAt: at, personId, reviewedBy: actor, reviewedAt: at, updatedAt: at },
        remove: ["expiresAt"],
        when: { exists: "id" },
      },
    });
  }
  await commit(deps, writes);
  // A submission's Activity may have been set to expire when it was declined; invited, it is kept with the Person.
  if (submissionId) await keepSubmissionActivity(deps, submissionId);

  const invitation = await requireInvitation(deps, email);
  const view = await invitationView(deps, invitation);
  const covered = activeSites(deps, await grantsOf(deps, personId));
  return { invitation: view, ...invitationText(covered, email, deps.config.doorOrigin) };
};

const keepSubmissionActivity = async (deps: Deps, submissionId: string) => {
  const index = indexes.activityBySubject;
  const rows = await deps.store.query({
    table: index.model,
    index: index.name,
    partition: [index.partition, submissionId],
    sort: { name: index.sort },
  });
  for (const item of rows) {
    if (item.expiresAt !== undefined) {
      await deps.store.write({ update: { table: "Activity", key: { id: String(item.id) }, remove: ["expiresAt"] } });
    }
  }
};

/**
 * Revoke does four things at once (plan §1): the Invitation and its grants become `revoked`; the bound Cognito user is
 * signed out everywhere and disabled; pre token generation then refuses on every trigger source; and issueSiteTicket
 * refuses. A site cookie already issued lives at most an hour.
 */
export const revokeInvitation = async (deps: Deps, caller: Caller, args: { email?: unknown }) => {
  const email = normalEmail(args.email);
  const invitation = await requireInvitation(deps, email);
  if (invitation.status !== "revoked") {
    const personId = personOf(invitation);
    const now = deps.now();
    const at = now.toISOString();
    const actor = await actorId(deps, caller);
    const grants = (await grantsOf(deps, personId)).filter((grant) => grant.status === "active");
    await commit(deps, [
      {
        update: {
          table: "Invitation",
          key: { email },
          set: { status: "revoked", statusAt: at, revokedAt: at, revokedBy: actor, updatedAt: at },
          when: { exists: "email" },
        },
      },
      ...grants.map(
        (grant): Write => ({
          update: {
            table: "AccessGrant",
            key: { id: String(grant.id) },
            set: { status: "revoked", revokedAt: at, revokedBy: actor, updatedAt: at },
          },
        }),
      ),
      activity(deps, { personId, actorId: actor, kind: "access.revoked", subjectType: "Person", subjectId: personId }),
    ]);
    if (typeof invitation.cognitoUsername === "string") {
      await deps.directory.signOut(invitation.cognitoUsername);
      await deps.directory.disable(invitation.cognitoUsername);
    }
  }
  return invitationView(deps, await requireInvitation(deps, email));
};

/**
 * Restore undoes a revoke: `accepted` again and the Cognito user enabled if the invitation is bound, `pending` if it
 * never was. The grants revoked with it come back; any revoked separately stay revoked.
 */
export const restoreInvitation = async (deps: Deps, caller: Caller, args: { email?: unknown }) => {
  const email = normalEmail(args.email);
  const invitation = await requireInvitation(deps, email);
  if (invitation.status === "revoked") {
    const personId = personOf(invitation);
    const bound = typeof invitation.cognitoSub === "string";
    const now = deps.now();
    const at = now.toISOString();
    const actor = await actorId(deps, caller);
    const revokedTogether = (await grantsOf(deps, personId)).filter(
      (grant) => grant.status === "revoked" && grant.revokedAt === invitation.revokedAt,
    );
    await commit(deps, [
      {
        update: {
          table: "Invitation",
          key: { email },
          set: { status: bound ? "accepted" : "pending", statusAt: at, updatedAt: at },
          remove: ["revokedAt", "revokedBy"],
          when: { eq: ["status", "revoked"] },
        },
      },
      ...revokedTogether.map(
        (grant): Write => ({
          update: {
            table: "AccessGrant",
            key: { id: String(grant.id) },
            set: { status: "active", updatedAt: at },
            remove: ["revokedAt", "revokedBy"],
          },
        }),
      ),
      activity(deps, { personId, actorId: actor, kind: "access.restored", subjectType: "Person", subjectId: personId }),
    ]);
    if (bound && typeof invitation.cognitoUsername === "string") {
      await deps.directory.enable(invitation.cognitoUsername);
    }
  }
  return invitationView(deps, await requireInvitation(deps, email));
};

/** Makes the person's grants exactly the sites named: missing ones granted, others revoked. */
export const setGrants = async (deps: Deps, caller: Caller, args: { email?: unknown; sites?: unknown }) => {
  const email = normalEmail(args.email);
  const sites = resolveSites(deps, args.sites, true);
  const invitation = await requireInvitation(deps, email);
  const personId = personOf(invitation);
  const actor = await actorId(deps, caller);
  const writes = grantWrites(deps, personId, await grantsOf(deps, personId), sites, {
    actor,
    source: "admin",
    keep: false,
  });
  if (writes.length) {
    await commit(deps, [
      ...writes,
      activity(deps, {
        personId,
        actorId: actor,
        kind: "access.grants_set",
        subjectType: "Person",
        subjectId: personId,
        detail: { sites: sites.map((site) => site.id) },
      }),
    ]);
  }
  return invitationView(deps, invitation);
};

const identityFields = ["cognitoUsername", "cognitoSub", "googleSub"];

/**
 * The admin's answer to EMAIL_CHANGED (plan §2.2). With `newEmail`: the same person has a changed address, so the
 * Invitation and the address claim move to it and the identity stays. Without: the address now belongs to someone
 * else, so the binding is cleared, the old Cognito user is signed out and disabled, and the next first sign-in with the
 * address binds afresh.
 */
export const rebindInvitation = async (deps: Deps, caller: Caller, args: { email?: unknown; newEmail?: unknown }) => {
  const email = normalEmail(args.email);
  const newEmail = args.newEmail === undefined || args.newEmail === null ? undefined : normalEmail(args.newEmail);
  const invitation = await requireInvitation(deps, email);
  if (typeof invitation.cognitoSub !== "string") throw new Refusal("NOT_BOUND");
  const personId = personOf(invitation);
  const now = deps.now();
  const at = now.toISOString();
  const actor = await actorId(deps, caller);

  if (newEmail !== undefined) {
    if (newEmail === email) throw new Refusal("SAME_EMAIL");
    const moved: Item = { ...invitation, email: newEmail, statusAt: at, updatedAt: at };
    await commit(deps, [
      { put: { table: "Invitation", item: moved, when: { notExists: "email" } } },
      { delete: { table: "Invitation", key: { email }, when: { eq: ["cognitoSub", invitation.cognitoSub] } } },
      {
        put: {
          table: "PersonEmail",
          item: row("PersonEmail", { email: newEmail, personId }, now),
          when: { or: [{ notExists: "email" }, { eq: ["personId", personId] }] },
        },
      },
      { delete: { table: "PersonEmail", key: { email }, when: { eq: ["personId", personId] } } },
      { update: { table: "Person", key: { id: personId }, set: { email: newEmail, updatedAt: at } } },
      activity(deps, {
        personId,
        actorId: actor,
        kind: "access.rebound",
        subjectType: "Person",
        subjectId: personId,
        detail: { mode: "moved" },
      }),
    ]);
    return invitationView(deps, await requireInvitation(deps, newEmail));
  }

  await commit(deps, [
    {
      update: {
        table: "Invitation",
        key: { email },
        set: { status: "pending", statusAt: at, updatedAt: at },
        remove: [...identityFields, "acceptedAt"],
        when: { eq: ["cognitoSub", invitation.cognitoSub] },
      },
    },
    { update: { table: "Person", key: { id: personId }, set: { updatedAt: at }, remove: identityFields } },
    activity(deps, {
      personId,
      actorId: actor,
      kind: "access.rebound",
      subjectType: "Person",
      subjectId: personId,
      detail: { mode: "cleared" },
    }),
  ]);
  if (typeof invitation.cognitoUsername === "string") {
    await deps.directory.signOut(invitation.cognitoUsername);
    await deps.directory.disable(invitation.cognitoUsername);
  }
  return invitationView(deps, await requireInvitation(deps, email));
};
