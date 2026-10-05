import type { DoorSite } from "../../areas/access/sites.ts";
import { type Model, row } from "../shared/models.ts";
import type { Item, Store, Write } from "../shared/store.ts";
import type { Signer } from "./ticket.ts";

/** The user pool, as crv-access uses it: by the username bound to an Invitation, so no lookup or ListUsers is needed. */
export type Directory = {
  /** The user's current email attribute, which Cognito re-maps from Google at every federated sign-in. */
  emailOf(username: string): Promise<string | undefined>;
  signOut(username: string): Promise<void>;
  disable(username: string): Promise<void>;
  enable(username: string): Promise<void>;
  addToAdmins(username: string): Promise<void>;
  remove(username: string): Promise<void>;
};

export type AccessConfig = {
  /** The door, the ticket's `iss`. */
  issuer: string;
  /** The KMS key id, the ticket's `kid`. */
  kid: string;
  adminEmails: readonly string[];
  sites: readonly DoorSite[];
  /** Where the invitation text sends an invitee: the app's origin. */
  doorOrigin: string;
  /** The IAM roles allowed to call the trigger-only and the retention operations. */
  roles: { preSignUp: string; preTokenGeneration: string; retention: string };
};

export type Deps = {
  store: Store;
  directory: Directory;
  sign: Signer;
  config: AccessConfig;
  now(): Date;
  id(): string;
};

/** A refusal the caller sees: its message is the code alone, never a value from the request. */
export class Refusal extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "Refusal";
  }
}

export type ActivityKind =
  | "interest.submitted"
  | "interest.status_changed"
  | "interest.note_added"
  | "access.invited"
  | "access.signed_up"
  | "access.signed_in"
  | "access.ticket_issued"
  | "access.revoked"
  | "access.restored"
  | "access.rebound"
  | "access.grants_set"
  | "people.deleted";

export type ActivityInput = {
  personId?: string;
  actorId: string;
  kind: ActivityKind;
  subjectType: "Person" | "Submission" | "Invitation";
  subjectId: string;
  /** Ids, counts and words only: never an address, a token or a message body. */
  detail?: Record<string, string | number | boolean | string[]>;
  expiresAt?: number;
};

/** An Activity row, as a write for a transaction. */
export const activity = (deps: Deps, input: ActivityInput): Write => {
  const now = deps.now();
  const item: Item = row(
    "Activity",
    {
      id: deps.id(),
      personId: input.personId,
      actorId: input.actorId,
      area: input.kind.split(".")[0],
      kind: input.kind,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      at: now.toISOString(),
      detail: input.detail,
      expiresAt: input.expiresAt,
    },
    now,
  );
  return { put: { table: "Activity" satisfies Model, item } };
};
