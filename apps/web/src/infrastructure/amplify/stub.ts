import type { DoorApi, EnterDoorAnswer } from "./types.ts";

/**
 * The backend as the screen tests and a local run without a deployment see it (NEXT_PUBLIC_CRV_STUB=1 at build). It
 * answers by what the visitor typed, so a test needs no network: `limited@` is rate limited, `down@` fails, anything
 * else is taken. The sign-in answers by `localStorage["crv-stub-session"]`: `invited`, `admin` or `stranger`.
 * Submissions are listed on `window.__crvSubmissions` for the test to read. A production build never selects this
 * (client.ts), and a test over the built output holds that.
 */
type Spy = { __crvSubmissions?: unknown[] };

const session = (): string | null => {
  try {
    return localStorage.getItem("crv-stub-session");
  } catch {
    return null;
  }
};

const grants = [
  { site: "streamlane", host: "streamlane.app" },
  { site: "driftline", host: "driftline.app" },
];

export const stubApi: DoorApi = {
  async submitInterest(input) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const spy = window as unknown as Spy;
    spy.__crvSubmissions = [...(spy.__crvSubmissions ?? []), input];
    if (input.email.startsWith("down@")) throw new Error("stubbed outage");
    if (input.email.startsWith("limited@")) return { ok: false, retryAfter: 3600 };
    return { ok: true };
  },
  async hasSession() {
    return session() !== null;
  },
  async completeRedirect() {
    const state = (() => {
      try {
        return localStorage.getItem("crv-stub-state") ?? undefined;
      } catch {
        return undefined;
      }
    })();
    return state === undefined ? {} : { customState: state };
  },
  async signInWithGoogle(customState) {
    const spy = window as unknown as { __crvSignIn?: string | undefined };
    spy.__crvSignIn = customState;
  },
  async signOut() {
    try {
      localStorage.removeItem("crv-stub-session");
    } catch {}
  },
  async enterDoor(): Promise<EnterDoorAnswer> {
    const who = session();
    if (who === "invited") return { invited: true, grants, admin: false };
    if (who === "admin") return { invited: true, grants, admin: true };
    return { invited: false, grants: [], admin: false, reason: "NOT_BOUND" };
  },
  async issueSiteTicket({ host }) {
    return { action: `https://${host}/_door`, ticket: "stub.ticket.value" };
  },
};
