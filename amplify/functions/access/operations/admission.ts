import { log } from "../../shared/log.ts";
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

/**
 * Pre sign-up's question: may this verified address get a Cognito user? Only if its Invitation is `pending` (an
 * `accepted` one already belongs to an identity), or if it is an admin address with no invitation at all.
 */
export const checkAdmission = async (deps: Deps, args: { email?: unknown }): Promise<Admission> => {
  const email = lower(args.email);
  if (!email) return refused("NOT_INVITED");
  const admin = deps.config.adminEmails.includes(email);
  let invitation: Item | undefined;
  try {
    invitation = await deps.store.get("Invitation", { email });
  } catch (error) {
    if (admin) return breakGlass("checkAdmission");
    throw error;
  }
  if (invitation === undefined) return admin ? { admitted: true, admin } : refused("NOT_INVITED");
  if (invitation.status === "pending" && invitation.cognitoSub === undefined) return { admitted: true, admin };
  return refused(invitation.status === "revoked" ? "REVOKED" : "NOT_INVITED");
};

export type SignIn = { userName?: unknown; sub?: unknown; googleSub?: unknown; email?: unknown };

/**
 * Pre token generation's question, on every trigger source, refresh included. Bound: admit only that identity, only
 * while accepted, only with the bound email. Not bound: bind the address's pending invitation, or bootstrap an admin
 * address that has none. Anything else is refused.
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

  if (bound) {
    if (bound.status !== "accepted") return refused("REVOKED");
    if (bound.email !== email) return refused("EMAIL_CHANGED");
    return { admitted: true, admin };
  }

  const identity = { cognitoUsername: userName, cognitoSub: sub, googleSub };
  try {
    if (invitation) {
      if (invitation.status !== "pending" || invitation.cognitoSub !== undefined) {
        return refused(invitation.status === "revoked" ? "REVOKED" : "NOT_INVITED");
      }
      await deps.store.transact(await bindWrites(deps, invitation, identity, admin));
    } else if (admin) {
      await deps.store.transact(bootstrapWrites(deps, email, identity));
    } else {
      return refused("NOT_INVITED");
    }
  } catch (error) {
    // Another identity bound the address first: exactly one wins, and this one never gets a token.
    if (error instanceof ConditionFailed) return refused("NOT_INVITED");
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
