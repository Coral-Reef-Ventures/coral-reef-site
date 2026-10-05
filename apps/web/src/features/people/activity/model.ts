import type { Activity, ActivityArea } from "../../../infrastructure/amplify/api.ts";

export const KIND_LABELS: Record<string, string> = {
  "interest.submitted": "Interest submitted",
  "interest.status_changed": "Submission status changed",
  "interest.note_added": "Note added",
  "access.invited": "Invited",
  "access.signed_up": "Signed up",
  "access.signed_in": "Signed in",
  "access.ticket_issued": "Ticket issued",
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
