import type { DoorApi, EnterDoorAnswer } from "../../../infrastructure/amplify/types.ts";
import { canonicalNext } from "./next.ts";
import { type LockedSite, lockedSites, siteById } from "./sites.ts";

/** What a locked site sent the visitor here for. */
export type DoorRequest = { site: LockedSite; next: string; state: string };

const stateShape = /^[A-Za-z0-9_-]{22,64}$/;

/**
 * The gate's redirect: `?site=<id>&host=<host>&next=<path>&state=<nonce>`. Anything that does not name a site behind
 * the door, with its own host, and a state of the right shape is not a request, and the door then just signs in.
 */
export const readDoorRequest = (search: string): DoorRequest | null => {
  const params = new URLSearchParams(search);
  const site = siteById(params.get("site"));
  const state = params.get("state") ?? "";
  if (!site || params.get("host") !== site.host || !stateShape.test(state)) return null;
  return { site, next: canonicalNext(params.get("next"), site.host), state };
};

/** The state that rides through Google and back, so the return page knows what the visitor was after. */
export const encodeRequest = (request: DoorRequest): string =>
  JSON.stringify({ site: request.site.id, host: request.site.host, next: request.next, state: request.state });

export const decodeRequest = (customState: string | undefined): DoorRequest | null => {
  if (!customState) return null;
  try {
    const value = JSON.parse(customState) as Record<string, unknown>;
    return readDoorRequest(
      new URLSearchParams({
        site: String(value.site ?? ""),
        host: String(value.host ?? ""),
        next: String(value.next ?? ""),
        state: String(value.state ?? ""),
      }).toString(),
    );
  } catch {
    return null;
  }
};

export type Ticket = { action: string; ticket: string; next: string };

export type Entered =
  | { kind: "ticket"; ticket: Ticket }
  | { kind: "continue"; grants: LockedSite[]; admin: boolean }
  | { kind: "not-invited"; reason: NonNullable<EnterDoorAnswer["reason"]> };

/** Whether `action` is the door's own endpoint on a site behind it: https, that host, and `/_door` exactly. */
export const isDoorAction = (action: string): boolean => {
  try {
    const url = new URL(action);
    return (
      url.protocol === "https:" &&
      url.pathname === "/_door" &&
      url.search === "" &&
      url.hash === "" &&
      url.port === "" &&
      url.username === "" &&
      lockedSites.some((site) => site.host === url.hostname)
    );
  } catch {
    return false;
  }
};

/**
 * With a signed-in session: ask the backend whether this person is invited. If a site sent them, get its ticket; if
 * not, say which sites they can continue to. The backend decides every part of it, and a ticket whose destination is
 * not one of our sites is refused here as well, so a wrong answer never becomes a form post to somewhere else.
 */
export const enter = async (api: DoorApi, request: DoorRequest | null): Promise<Entered> => {
  const answer = await api.enterDoor();
  if (!answer.invited) return { kind: "not-invited", reason: answer.reason ?? "NOT_BOUND" };
  const grants = answer.grants.flatMap((grant) => {
    const site = siteById(grant.site);
    return site && site.host === grant.host ? [site] : [];
  });
  if (request && grants.some((site) => site.id === request.site.id)) {
    const ticket = await api.issueSiteTicket({
      site: request.site.id,
      host: request.site.host,
      next: request.next,
      state: request.state,
    });
    if (!isDoorAction(ticket.action) || new URL(ticket.action).hostname !== request.site.host) {
      throw new Error("The ticket's destination is not the site that asked for it.");
    }
    return { kind: "ticket", ticket: { action: ticket.action, ticket: ticket.ticket, next: request.next } };
  }
  return { kind: "continue", grants, admin: answer.admin };
};
