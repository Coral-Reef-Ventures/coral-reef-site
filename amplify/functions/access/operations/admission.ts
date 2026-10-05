import { errorName, log } from "../../shared/log.ts";
import { changes, row } from "../../shared/models.ts";
import { ConditionFailed, type Item, type Write } from "../../shared/store.ts";
import { activity, type Deps } from "../context.ts";
import { boundInvitation, grantsOf, grantWrites } from "./common.ts";

/**
 * The two trigger-only operations (plan §2.2). An invitation binds to the first Cognito and Google identity that
 * accepts it, never to an address alone: pre sign-up admits only a `pending` invitation, and pre token generation
 * binds it in one conditional transaction, then admits only that identity, while the invitation is `accepted` and the
 * token's email is the bound one.
 */

export type Admission = { admitted: boolean; reason?: string; admin: boolean };

const refused = (reason: string): Admission => ({ admitted: false, reason, admin: false });

/** The break-glass path: a CRV_ADMIN_EMAILS address when the invitation table cannot be read at all. */
const breakGlass = (operation: string): Admission => {
  log("access.break_glass", { operation, status: "BREAK_GLASS" });
  return { admitted: true, admin: true };
};

const lower = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");

/** The Cognito usernames pre sign-up has admitted for an invitation, bound or not. */
export const admittedUsernames = (invitation: Item | undefined): string[] =>
  Array.isArray(invitation?.admittedUsernames)
    ? invitation.admittedUsernames.filter((name): name is string => typeof name === "string" && name !== "")
    : [];

/**
 * Notes on the pending invitation that pre sign-up is about to let Cognito create this user, before it exists. A user
 * that never binds (the losing identity of two that share an address, or one whose pre token generation never ran) is
 * otherwise recorded nowhere, and erasure and the retention sweep could not reach it. The name is appended atomically,
 * so two sign-ups at once each keep theirs; it returns false when the invitation stopped being pending in the meantime.
 */
const recordSignUp = async (deps: Deps, invitation: Item, userName: string): Promise<boolean> => {
  if (admittedUsernames(invitation).includes(userName)) return true;
  try {
    await deps.store.write({
      update: {
        table: "Invitation",
        key: { email: String(invitation.email) },
        set: { updatedAt: deps.now().toISOString() },
        append: { admittedUsernames: [userName] },
        when: { and: [{ eq: ["status", "pending"] }, { notExists: "cognitoSub" }] },
      },
    });
    return true;
  } catch (error) {
    if (error instanceof ConditionFailed) return false;
    throw error;
  }
};

/**
 * Pre sign-up's question: may this verified address get a Cognito user? Only if its Invitation is `pending` (an
 * `accepted` one already belongs to an identity), or if it is an admin address with no invitation at all. Admitting an
 * invitee records the username Cognito is about to create on the invitation, so erasure can always find it.
 */
export const checkAdmission = async (deps: Deps, args: { email?: unknown; userName?: unknown }): Promise<Admission> => {
  const email = lower(args.email);
  const userName = typeof args.userName === "string" ? args.userName : "";
  if (!email || !userName) return refused("NOT_INVITED");
  const admin = deps.config.adminEmails.includes(email);
  let invitation: Item | undefined;
  try {
    invitation = await deps.store.get("Invitation", { email });
  } catch (error) {
    if (admin) return breakGlass("checkAdmission");
    throw error;
  }
  if (invitation === undefined) return admin ? { admitted: true, admin } : refused("NOT_INVITED");
  if (invitation.status === "pending" && invitation.cognitoSub === undefined) {
    let recorded: boolean;
    try {
      recorded = await recordSignUp(deps, invitation, userName);
    } catch (error) {
      if (admin) return breakGlass("checkAdmission");
      throw error;
    }
    return recorded ? { admitted: true, admin } : refused("NOT_INVITED");
  }
  return refused(invitation.status === "revoked" ? "REVOKED" : "NOT_INVITED");
};

export type SignIn = { userName?: unknown; sub?: unknown; googleSub?: unknown; email?: unknown; inAdmins?: unknown };

/**
 * Deletes a Cognito user pre token generation is refusing and that no invitation is bound to: the losing identity of two
 * that share an address, or one whose invitation was revoked or erased between pre sign-up and now. Nothing would ever
 * let it sign in, and it holds a Google name, address and id that erasure could not otherwise reach. A failure is
 * logged and the refusal stands; the username is also on the invitation pre sign-up admitted it for. A bound identity
 * is never deleted here: revoking and rebinding one are the admin's.
 */
const discardUnbound = async (deps: Deps, sub: string, userName: string, reason: string): Promise<Admission> => {
  try {
    // Asked once more before anything is deleted: the bySub index is eventually consistent, so an identity bound a
    // moment ago (or moved to a new address by rebindInvitation) can look unbound. Refusing it costs one retry;
    // deleting it would lock a real invitee out.
    if (await boundInvitation(deps, sub)) {
      log("access.unbound_user_kept", { status: reason, error: "BOUND" });
      return refused(reason);
    }
    await deps.directory.remove(userName);
    log("access.unbound_user_deleted", { status: reason });
  } catch (error) {
    log("access.unbound_user_kept", { status: reason, error: errorName(error) });
  }
  return refused(reason);
};

/**
 * Keeps the `admins` group in step with CRV_ADMIN_EMAILS for a bound identity, from the groups its token is being issued
 * with (`inAdmins`, absent when the trigger did not say). The trigger itself already leaves `admins` out of the token of
 * an address no longer on the list, so a failure here is logged and costs nothing but a stale group.
 */
const syncAdmins = async (deps: Deps, userName: string, admin: boolean, inAdmins: unknown) => {
  if (typeof inAdmins !== "boolean" || inAdmins === admin) return;
  try {
    if (admin) await deps.directory.addToAdmins(userName);
    else await deps.directory.removeFromAdmins(userName);
    log("access.admins_synced", { status: admin ? "added" : "removed" });
  } catch (error) {
    log("access.admins_sync_failed", { status: admin ? "add" : "remove", error: errorName(error) });
  }
};

/**
 * Pre token generation's question, on every trigger source, refresh included. Bound: admit only that identity, only
 * while accepted, only with the bound email. Not bound: bind the address's pending invitation, or bootstrap an admin
 * address that has none. Anything else is refused, and an unbound identity that is refused is deleted.
 */
export const admitSignIn = async (deps: Deps, args: SignIn): Promise<Admission> => {
  const email = lower(args.email);
  const sub = typeof args.sub === "string" ? args.sub : "";
  const userName = typeof args.userName === "string" ? args.userName : "";
  const googleSub = typeof args.googleSub === "string" && args.googleSub ? args.googleSub : undefined;
  if (!email || !sub || !userName) return refused("NOT_INVITED");
  const admin = deps.config.adminEmails.includes(email);

  let bound: Item | undefined;
  let invitation: Item | undefined;
  try {
    bound = await boundInvitation(deps, sub);
    if (!bound) invitation = await deps.store.get("Invitation", { email });
  } catch (error) {
    if (admin) return breakGlass("admitSignIn");
    throw error;
  }

  // The address's invitation is read consistently (Store.get always is), so it can show a binding to this identity the
  // index does not yet.
  if (!bound && invitation?.cognitoSub === sub) bound = invitation;
  if (bound) {
    if (bound.status !== "accepted") return refused("REVOKED");
    if (bound.email !== email) return refused("EMAIL_CHANGED");
    await syncAdmins(deps, userName, admin, args.inAdmins);
    return { admitted: true, admin };
  }

  const identity = { cognitoUsername: userName, cognitoSub: sub, googleSub };
  try {
    if (invitation) {
      if (invitation.status !== "pending" || invitation.cognitoSub !== undefined) {
        return discardUnbound(deps, sub, userName, invitation.status === "revoked" ? "REVOKED" : "NOT_INVITED");
      }
      await deps.store.transact(await bindWrites(deps, invitation, identity, admin));
    } else if (admin) {
      await deps.store.transact(bootstrapWrites(deps, email, identity));
    } else {
      return discardUnbound(deps, sub, userName, "NOT_INVITED");
    }
  } catch (error) {
    // Another identity bound the address first: exactly one wins, and this one never gets a token.
    // The same identity in two sign-ins at once binds once: the one that lost reads, consistently, the binding it would
    // have made, so it is admitted rather than deleted.
    if (error instanceof ConditionFailed) {
      const current = await deps.store.get("Invitation", { email });
      if (current?.cognitoSub === sub && current.status === "accepted") return { admitted: true, admin };
      return discardUnbound(deps, sub, userName, "NOT_INVITED");
    }
    throw error;
  }
  if (admin) await deps.directory.addToAdmins(userName);
  log("access.bound", { status: admin ? "admin" : "invitee" });
  return { admitted: true, admin };
};

type Identity = { cognitoUsername: string; cognitoSub: string; googleSub: string | undefined };

/** Accept the pending invitation and bind it, its address and its Person to this identity, all or nothing. */
const bindWrites = async (deps: Deps, invitation: Item, identity: Identity, admin: boolean): Promise<Write[]> => {
  const now = deps.now();
  const at = now.toISOString();
  const email = String(invitation.email);
  const existingPerson = typeof invitation.personId === "string" ? invitation.personId : undefined;
  const personId = existingPerson ?? deps.id();
  const writes: Write[] = [
    {
      update: {
        table: "Invitation",
        key: { email },
        set: changes({ status: "accepted", statusAt: at, acceptedAt: at, personId, ...identity }, now),
        when: { and: [{ eq: ["status", "pending"] }, { notExists: "cognitoSub" }] },
      },
    },
    {
      put: {
        table: "PersonEmail",
        item: row("PersonEmail", { email, personId }, now),
        when: { or: [{ notExists: "email" }, { eq: ["personId", personId] }] },
      },
    },
    existingPerson
      ? {
          update: {
            table: "Person",
            key: { id: personId },
            set: changes(identity, now),
            when: {
              and: [
                { exists: "id" },
                { or: [{ notExists: "cognitoSub" }, { eq: ["cognitoSub", identity.cognitoSub] }] },
              ],
            },
          },
        }
      : {
          put: {
            table: "Person",
            item: row("Person", { id: personId, email, source: "invitation", ...identity }, now),
            when: { notExists: "id" },
          },
        },
    activity(deps, {
      personId,
      actorId: personId,
      kind: "access.signed_up",
      subjectType: "Person",
      subjectId: personId,
      detail: { source: admin ? "admin-bootstrap" : "invitation" },
    }),
  ];
  if (admin) {
    const grants = existingPerson ? await grantsOf(deps, personId) : [];
    writes.push(
      ...grantWrites(deps, personId, grants, deps.config.sites, {
        actor: "system",
        source: "admin-bootstrap",
        keep: true,
      }),
    );
  }
  return writes;
};

/** An admin address with no invitation: a Person, its address, an accepted Invitation and both sites' grants. */
const bootstrapWrites = (deps: Deps, email: string, identity: Identity): Write[] => {
  const now = deps.now();
  const at = now.toISOString();
  const personId = deps.id();
  return [
    {
      put: {
        table: "Person",
        item: row("Person", { id: personId, email, source: "admin", ...identity }, now),
        when: { notExists: "id" },
      },
    },
    {
      put: {
        table: "PersonEmail",
        item: row("PersonEmail", { email, personId }, now),
        when: { notExists: "email" },
      },
    },
    {
      put: {
        table: "Invitation",
        item: row(
          "Invitation",
          {
            email,
            personId,
            status: "accepted",
            statusAt: at,
            invitedBy: "system",
            invitedAt: at,
            acceptedAt: at,
            note: "admin-bootstrap",
            ...identity,
          },
          now,
        ),
        when: { notExists: "email" },
      },
    },
    ...grantWrites(deps, personId, [], deps.config.sites, { actor: "system", source: "admin-bootstrap", keep: true }),
    activity(deps, {
      personId,
      actorId: personId,
      kind: "access.signed_up",
      subjectType: "Person",
      subjectId: personId,
      detail: { source: "admin-bootstrap" },
    }),
  ];
};
