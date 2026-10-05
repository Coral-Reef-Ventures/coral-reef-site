import { errorName, log } from "../shared/log.ts";
import { type Caller, callerOf, isAdmin } from "./caller.ts";
import { type AccessConfig, type Deps, Refusal } from "./context.ts";
import { admitSignIn, checkAdmission } from "./operations/admission.ts";
import { enterDoor, issueSiteTicket } from "./operations/door.ts";
import { deletePerson, eraseEmail } from "./operations/erasure.ts";
import { invite, rebindInvitation, restoreInvitation, revokeInvitation, setGrants } from "./operations/invitations.ts";
import { updateSubmission } from "./operations/submissions.ts";

type Args = Record<string, unknown>;
type Operation = {
  /** Who may call it, decided here whatever AppSync allowed (plan §2.2). */
  allow(caller: Caller, roles: AccessConfig["roles"]): boolean;
  run(deps: Deps, caller: Caller, args: Args): Promise<unknown>;
};

const user = (caller: Caller): caller is Extract<Caller, { kind: "user" }> => caller.kind === "user";
const admin = (caller: Caller) => isAdmin(caller);
const asUser = (caller: Caller) => {
  if (!user(caller)) throw new Refusal("FORBIDDEN");
  return caller;
};

/** Every operation crv-access handles, by field name, and who may call each. */
export const operations: Record<string, Operation> = {
  enterDoor: { allow: user, run: (deps, caller) => enterDoor(deps, asUser(caller)) },
  issueSiteTicket: { allow: user, run: (deps, caller, args) => issueSiteTicket(deps, asUser(caller), args) },
  invite: { allow: admin, run: invite },
  revokeInvitation: { allow: admin, run: revokeInvitation },
  restoreInvitation: { allow: admin, run: restoreInvitation },
  setGrants: { allow: admin, run: setGrants },
  rebindInvitation: { allow: admin, run: rebindInvitation },
  updateSubmission: { allow: admin, run: updateSubmission },
  deletePerson: {
    allow: (caller, roles) => admin(caller) || (caller.kind === "role" && caller.role === roles.retention),
    run: deletePerson,
  },
  eraseEmail: { allow: admin, run: eraseEmail },
  checkAdmission: {
    allow: (caller, roles) => caller.kind === "role" && caller.role === roles.preSignUp,
    run: (deps, _caller, args) => checkAdmission(deps, args),
  },
  admitSignIn: {
    allow: (caller, roles) => caller.kind === "role" && caller.role === roles.preTokenGeneration,
    run: (deps, _caller, args) => admitSignIn(deps, args),
  },
};

export type AppSyncEvent = {
  arguments?: Args;
  identity?: unknown;
  info?: { fieldName?: string; parentTypeName?: string };
};

/**
 * The AppSync resolver for every operation on crv-access (the named handler "crvAccess", Streamlane ADR 0055). A
 * refusal reaches the caller as its code alone; anything else as `INTERNAL`, so no value from a table or a request
 * leaves in an error. The log holds the operation, the outcome and the error's name, nothing more.
 */
export const createAccess = (deps: Deps) => async (event: AppSyncEvent) => {
  const name = event.info?.fieldName ?? "";
  const operation = Object.hasOwn(operations, name) ? operations[name] : undefined;
  if (!operation) {
    log("access.refused", { operation: "unknown", status: "UNKNOWN_OPERATION" });
    throw new Refusal("UNKNOWN_OPERATION");
  }
  const caller = callerOf(event.identity);
  if (!operation.allow(caller, deps.config.roles)) {
    log("access.refused", { operation: name, caller: caller.kind, status: "FORBIDDEN" });
    throw new Refusal("FORBIDDEN");
  }
  try {
    const result = await operation.run(deps, caller, event.arguments ?? {});
    log("access.done", { operation: name, caller: caller.kind, status: "ok" });
    return result;
  } catch (error) {
    if (error instanceof Refusal) {
      log("access.refused", { operation: name, caller: caller.kind, status: error.code });
      throw error;
    }
    log("access.failed", { operation: name, caller: caller.kind, status: "INTERNAL", error: errorName(error) });
    throw new Error("INTERNAL");
  }
};
