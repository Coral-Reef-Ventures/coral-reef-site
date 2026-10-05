import { grantResource } from "../../../areas/access/sites.ts";
import { expiresAt, retention } from "../../../areas/retention.ts";
import type { Item } from "../../shared/store.ts";
import type { Caller } from "../caller.ts";
import { activity, type Deps, Refusal } from "../context.ts";
import { canonicalNext } from "../next.ts";
import { signTicket, ticketSeconds } from "../ticket.ts";
import { activeSites, boundInvitation, currentEmail, grantsOf } from "./common.ts";

type User = Extract<Caller, { kind: "user" }>;
type Refused = "NOT_BOUND" | "REVOKED" | "EMAIL_CHANGED";

/** The Invitation bound to the caller, if it is accepted and the caller's email is still the bound one. */
const admitted = async (deps: Deps, caller: User): Promise<{ invitation: Item } | { reason: Refused }> => {
  const invitation = await boundInvitation(deps, caller.sub);
  if (!invitation) return { reason: "NOT_BOUND" };
  if (invitation.status !== "accepted") return { reason: "REVOKED" };
  if ((await currentEmail(deps, caller)) !== invitation.email) return { reason: "EMAIL_CHANGED" };
  return { invitation };
};

/**
 * What the door asks after a sign-in: is this person invited, which sites may they continue to, and are they an
 * admin. Creates no Person. Writes `access.signed_in`, kept 12 months.
 */
export const enterDoor = async (deps: Deps, caller: User) => {
  const admin = caller.groups.includes("admins");
  const result = await admitted(deps, caller);
  if ("reason" in result) return { invited: false, grants: [], admin, reason: result.reason };
  const personId = String(result.invitation.personId);
  const sites = activeSites(deps, await grantsOf(deps, personId));
  await deps.store.write(
    activity(deps, {
      personId,
      actorId: personId,
      kind: "access.signed_in",
      subjectType: "Person",
      subjectId: personId,
      expiresAt: expiresAt(deps.now(), retention.signedIn),
    }),
  );
  return { invited: true, grants: sites.map((site) => ({ site: site.id, host: site.hosts[0] })), admin };
};

const stateShape = /^[A-Za-z0-9_-]{22,64}$/;

export type TicketArgs = { site?: unknown; next?: unknown; state?: unknown; host?: unknown };

/**
 * A ticket for one host: an ES256 JWS signed by KMS, for the door to post to `https://<host>/_door`. Requires a bound,
 * accepted invitation with the bound email, and an active grant for the site. `next` must pass *Canonical next*
 * against the host, and the ticket carries the re-serialised value.
 */
export const issueSiteTicket = async (deps: Deps, caller: User, args: TicketArgs) => {
  const site = deps.config.sites.find((candidate) => candidate.id === args.site);
  const host = typeof args.host === "string" ? args.host : "";
  if (!site?.hosts.includes(host)) throw new Refusal("UNKNOWN_SITE");
  const state = typeof args.state === "string" ? args.state : "";
  if (!stateShape.test(state)) throw new Refusal("BAD_STATE");
  const next = canonicalNext(typeof args.next === "string" ? args.next : "", host);
  if (next === undefined) throw new Refusal("BAD_NEXT");

  const result = await admitted(deps, caller);
  if ("reason" in result) throw new Refusal(result.reason);
  const personId = String(result.invitation.personId);
  const grant = (await grantsOf(deps, personId)).find(
    (candidate) => candidate.resource === grantResource(site) && candidate.status === "active",
  );
  if (!grant) throw new Refusal("NO_GRANT");

  const now = deps.now();
  const iat = Math.floor(now.getTime() / 1000);
  const jti = deps.id();
  const ticket = await signTicket(
    {
      iss: deps.config.issuer,
      aud: host,
      sub: personId,
      gid: String(grant.id),
      jti,
      iat,
      exp: iat + ticketSeconds,
      st: state,
      next,
      kid: deps.config.kid,
    },
    deps.sign,
  );
  await deps.store.write(
    activity(deps, {
      personId,
      actorId: personId,
      kind: "access.ticket_issued",
      subjectType: "Person",
      subjectId: personId,
      detail: { site: site.id, host, grantId: String(grant.id), jti },
      expiresAt: expiresAt(now, retention.ticketIssued),
    }),
  );
  return { action: `https://${host}/_door`, ticket };
};
