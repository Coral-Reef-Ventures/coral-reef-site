import { type DoorSite, findSite, grantResource, siteList } from "../../../areas/access/sites.ts";
import { indexes, row } from "../../shared/models.ts";
import type { Item, Write } from "../../shared/store.ts";
import type { Caller } from "../caller.ts";
import { type Deps, Refusal } from "../context.ts";

const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercased and trimmed, or refused: every stored address goes through this. */
export const normalEmail = (value: unknown): string => {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !emailShape.test(email)) throw new Refusal("BAD_EMAIL");
  return email;
};

/** Sites named by id or host, each once and all known, or refused. At least one unless `allowNone`. */
export const resolveSites = (deps: Deps, values: unknown, allowNone = false): DoorSite[] => {
  const list = Array.isArray(values) ? values : [];
  const found: DoorSite[] = [];
  for (const value of list) {
    const site = typeof value === "string" ? findSite(deps.config.sites, value) : undefined;
    if (!site) throw new Refusal("BAD_SITES");
    if (!found.includes(site)) found.push(site);
  }
  if (found.length === 0 && !allowNone) throw new Refusal("BAD_SITES");
  return deps.config.sites.filter((site) => found.includes(site));
};

/** Optional text, trimmed and capped, or refused when too long. */
export const optionalText = (value: unknown, max: number): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Refusal("BAD_TEXT");
  const text = value.trim();
  if (text.length > max) throw new Refusal("TEXT_TOO_LONG");
  return text;
};

/** The Invitation bound to a Cognito `sub`, if any. */
export const boundInvitation = async (deps: Deps, sub: string): Promise<Item | undefined> => {
  const index = indexes.invitationBySub;
  const [found] = await deps.store.query({
    table: index.model,
    index: index.name,
    partition: [index.partition, sub],
    limit: 1,
  });
  return found;
};

export const grantsOf = (deps: Deps, personId: string): Promise<Item[]> => {
  const index = indexes.grantByPerson;
  return deps.store.query({
    table: index.model,
    index: index.name,
    partition: [index.partition, personId],
    sort: { name: index.sort },
  });
};

/** The sites a person's active grants open. */
export const activeSites = (deps: Deps, grants: Item[]): DoorSite[] =>
  deps.config.sites.filter((site) =>
    grants.some((grant) => grant.resource === grantResource(site) && grant.status === "active"),
  );

/** Who an Activity row names as its actor: the caller's bound Person, or `system` for a function. */
export const actorId = async (deps: Deps, caller: Caller): Promise<string> => {
  if (caller.kind !== "user") return "system";
  const bound = await boundInvitation(deps, caller.sub);
  return typeof bound?.personId === "string" ? bound.personId : `user:${caller.sub}`;
};

/** The caller's email now: from the token when it carries one, from the user pool when it does not. */
export const currentEmail = async (deps: Deps, caller: Extract<Caller, { kind: "user" }>): Promise<string> =>
  (caller.email ?? (await deps.directory.emailOf(caller.username)) ?? "").toLowerCase();

/** The writes that make a person's grants exactly cover `sites`, or, with `keep`, add `sites` to what they hold. */
export const grantWrites = (
  deps: Deps,
  personId: string,
  existing: Item[],
  sites: readonly DoorSite[],
  options: { actor: string; source: "invitation" | "admin" | "admin-bootstrap"; keep: boolean },
): Write[] => {
  const now = deps.now();
  const at = now.toISOString();
  const writes: Write[] = [];
  for (const site of deps.config.sites) {
    const resource = grantResource(site);
    const grant = existing.find((candidate) => candidate.resource === resource);
    const wanted = sites.some((candidate) => candidate.id === site.id);
    if (wanted && !grant) {
      writes.push({
        put: {
          table: "AccessGrant",
          item: row(
            "AccessGrant",
            {
              id: deps.id(),
              personId,
              resource,
              status: "active",
              source: options.source,
              grantedBy: options.actor,
              grantedAt: at,
            },
            now,
          ),
          when: { notExists: "id" },
        },
      });
    } else if (wanted && grant && grant.status !== "active") {
      writes.push({
        update: {
          table: "AccessGrant",
          key: { id: String(grant.id) },
          set: { status: "active", grantedBy: options.actor, grantedAt: at, updatedAt: at },
          remove: ["revokedAt", "revokedBy"],
        },
      });
    } else if (!wanted && !options.keep && grant?.status === "active") {
      writes.push({
        update: {
          table: "AccessGrant",
          key: { id: String(grant.id) },
          set: { status: "revoked", revokedAt: at, revokedBy: options.actor, updatedAt: at },
        },
      });
    }
  }
  return writes;
};

/** What the admin views show of an invitation (the views' `Invitation`): its fields, whether it is bound, its sites. */
export const invitationView = async (deps: Deps, invitation: Item) => {
  const personId = typeof invitation.personId === "string" ? invitation.personId : undefined;
  const grants = personId ? await grantsOf(deps, personId) : [];
  return {
    email: invitation.email,
    personId,
    submissionId: invitation.submissionId,
    status: invitation.status,
    statusAt: invitation.statusAt,
    bound: typeof invitation.cognitoSub === "string",
    invitedBy: invitation.invitedBy,
    invitedAt: invitation.invitedAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    note: invitation.note,
    sites: activeSites(deps, grants).map((site) => site.hosts[0]),
  };
};

/**
 * The invitation text "Copy invitation" prepares (site-copy.md, "Invitation text (proposed, 2026-10-04)"), for Gary to
 * send from his own mail. Proposed copy: it changes there first and here in the same commit.
 */
export const invitationText = (sites: readonly DoorSite[], email: string, door: string) => {
  const names = siteList(sites);
  return {
    subject: `Your invitation to ${names}`,
    text: [
      "Hello,",
      `You are invited to ${names}, open for now only to invited guests.`,
      `To come in, go to ${door}/#invited and sign in with Google using this address, ${email}. The invitation belongs to the first Google account that signs in with it, so use the account this message came to.`,
      "If anything does not work, reply to this message or write to hello@coralreefventures.com.",
      "Coral Reef Ventures",
    ].join("\n\n"),
  };
};
