import { lockedSites } from "../../access/door-session/sites.ts";
import { SUBMISSION_STATUSES, type Activity, type ActivityArea } from "../../../infrastructure/amplify/api.ts";
import { titleCase } from "../../admin/shell/format.ts";

export const KIND_LABELS: Record<string, string> = {
  "interest.submitted": "Interest submitted",
  "interest.status_changed": "Submission status changed",
  "interest.note_added": "Note added",
  "access.invited": "Invited",
  "access.signed_up": "Signed up",
  "access.signed_in": "Signed in",
  "access.ticket_issued": "Let in",
  "access.revoked": "Revoked",
  "access.restored": "Restored",
  "access.rebound": "Rebound",
  "people.deleted": "Person deleted",
  "door.locked": "Door locked",
  "door.unlocked": "Door unlocked",
};

/** A readable label, falling back to the kind itself for one a later area adds. */
export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

export function filterByArea(rows: readonly Activity[], area: ActivityArea | undefined): Activity[] {
  return area ? rows.filter((r) => r.area === area) : [...rows];
}

/**
 * Who an id belongs to, built from what the other admin views already show: the invitations' addresses and the
 * submissions' names. Activity itself carries no address or name (plan §2.3a), so the view resolves the ids here or
 * prints them as they are.
 */
export type Directory = { people: Record<string, string>; submissions: Record<string, string> };

export const emptyDirectory: Directory = { people: {}, submissions: {} };

export function buildDirectory(
  invitations: readonly { email: string; personId?: string }[],
  submissions: readonly { id: string; name: string; email: string; personId?: string }[],
): Directory {
  const people: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  for (const invitation of invitations) {
    if (invitation.personId) people[invitation.personId] = invitation.email;
  }
  // After the invitations, so a submitter's name wins over the bare address the invitation holds.
  for (const submission of submissions) {
    const label = submission.name ? `${submission.name} (${submission.email})` : submission.email;
    subjects[submission.id] = label;
    if (submission.personId) people[submission.personId] = label;
  }
  return { people, submissions: subjects };
}

/** An opaque id, cut short for the column; the cell's title keeps the whole of it. */
export function shortId(id: string): string {
  return id.length > 14 && !id.includes("@") && !id.includes(" ") ? `${id.slice(0, 10)}…` : id;
}

/** What a cell shows, and what its title keeps when the two differ. */
export type Cell = { text: string; title?: string };

const cell = (text: string, full: string): Cell => (text === full ? { text } : { text, title: full });

/** The thing the event happened to: the person or submitter by name where the directory knows them. */
export function describeSubject(row: Activity, directory: Directory): Cell {
  const full = `${row.subjectType} ${row.subjectId}`;
  const known =
    row.subjectType === "Submission" ? directory.submissions[row.subjectId] : directory.people[row.subjectId];
  if (known) return cell(known, full);
  // The backend names an Invitation by its address, which needs no lookup.
  if (row.subjectId.includes("@")) return cell(row.subjectId, full);
  return cell(`${row.subjectType} ${shortId(row.subjectId)}`, full);
}

/**
 * Who did it: `system` for a function, `user:<sub>` for an admin signed in without a bound invitation (the
 * break-glass path), and otherwise a person the directory may know by address.
 */
export function describeActor(actorId: string, directory: Directory): Cell {
  if (actorId === "system") return { text: "System" };
  if (actorId.startsWith("user:")) return { text: "Admin", title: actorId };
  const known = directory.people[actorId];
  return cell(known ?? shortId(actorId), actorId);
}

const SITE_NAMES: Record<string, string> = {
  crv: "Coral Reef Ventures",
  ...Object.fromEntries(
    lockedSites.flatMap((site) => [[site.id, site.name] as const, [site.host, site.name] as const]),
  ),
};

/** A site's name, by the id the backend writes or by its host; "" for anything not in the door's own list. */
export function siteName(value: unknown): string {
  return typeof value === "string" ? (SITE_NAMES[value] ?? "") : "";
}

const isStatus = (value: unknown): boolean =>
  typeof value === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(value);

/**
 * The one readable thing a row may show beside its label, drawn from a closed list of keys whose values are words or
 * ids this view already shows elsewhere. Anything else in `detail` — a host, a grant id, a ticket id, or a key a later
 * area adds — is never printed, so the table cannot leak a field before someone has decided it may be shown.
 */
export function detailSummary(detail: Record<string, unknown> | undefined): string {
  if (!detail) return "";
  const site = siteName(detail.site);
  if (site) return site;
  if (Array.isArray(detail.sites)) {
    const names = detail.sites.map(siteName).filter(Boolean);
    if (names.length > 0) return names.join(", ");
    if (detail.sites.length === 0) return "No sites";
  }
  if (isStatus(detail.from) && isStatus(detail.to))
    return `${titleCase(String(detail.from))} → ${titleCase(String(detail.to))}`;
  if (detail.mode === "moved") return "Address moved";
  if (detail.mode === "cleared") return "Binding cleared";
  if (detail.source === "invitation") return "By invitation";
  if (detail.source === "admin-bootstrap") return "Break-glass admin";
  return "";
}
