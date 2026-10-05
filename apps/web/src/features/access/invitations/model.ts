import { SITES, type SiteId } from "../../../infrastructure/amplify/api.ts";

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteDraft = { email: string; sites: readonly SiteId[] };
export type InviteProblem = { field: "email" | "sites"; message: string };

/** What the form checks before it asks the backend; the backend refuses the same cases again. */
export function validateInvite(draft: InviteDraft): InviteProblem | undefined {
  const email = draft.email.trim();
  if (!ADDRESS.test(email) || email.length > 254) return { field: "email", message: "Enter a valid email address." };
  if (draft.sites.length === 0) return { field: "sites", message: "Choose at least one site." };
  if (draft.sites.some((s) => !SITES.includes(s))) return { field: "sites", message: "Choose from the listed sites." };
  return undefined;
}

/** The invitation text as a mail link, for sending from the admin's own mail. Nothing is sent from here. */
export function mailtoHref(email: string, text: string): string {
  return `mailto:${encodeURIComponent(email.trim())}?body=${encodeURIComponent(text)}`;
}

/** Which actions an invitation offers, from its state alone. */
export function actionsFor(invitation: { status: "pending" | "accepted" | "revoked"; bound: boolean }) {
  return {
    revoke: invitation.status !== "revoked",
    restore: invitation.status === "revoked",
    rebind: invitation.bound,
  };
}
