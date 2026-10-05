/**
 * What the admin views need from the backend, as plain types and one interface. The views import this and never the
 * generated client, so they build and test before the schema (PR 1.3) exists. Names and fields follow the plan's
 * §2.3: Submission, Invitation, AccessGrant and Activity, and the custom operations that act on them.
 */

export const SITES = ["streamlane.app", "driftline.app"] as const;
export type SiteId = (typeof SITES)[number];

export const SUBMISSION_STATUSES = ["new", "reviewing", "invited", "declined", "archived"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INTERESTS = ["funding", "design_partner", "advisor", "other"] as const;
export type Interest = (typeof INTERESTS)[number];

export const ACTIVITY_AREAS = ["interest", "access", "people", "door"] as const;
export type ActivityArea = (typeof ACTIVITY_AREAS)[number];

export type Submission = {
  id: string;
  name: string;
  email: string;
  organization: string;
  interests: Interest[];
  message: string;
  sourceSite: "crv" | "streamlane" | "driftline";
  status: SubmissionStatus;
  statusAt: string;
  notes: string;
  receivedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  personId?: string;
};

export type Invitation = {
  email: string;
  personId?: string;
  submissionId?: string;
  status: InvitationStatus;
  statusAt: string;
  /** True once an identity has accepted it (cognitoSub set). Only a bound invitation can be rebound. */
  bound: boolean;
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  note?: string;
  /** The sites the person holds an active grant for. */
  sites: SiteId[];
};

export type Activity = {
  id: string;
  personId?: string;
  actorId: string;
  area: ActivityArea;
  kind: string;
  subjectType: string;
  subjectId: string;
  at: string;
  /** Ids and reasons only. The backend never puts an address, a token or a message body here. */
  detail?: Record<string, unknown>;
};

export type InviteInput = { email: string; sites: SiteId[]; submissionId?: string; note?: string };
export type InviteResult = { invitation: Invitation; text: string };
export type ActivityQuery = { area?: ActivityArea; personId?: string; subjectId?: string; limit?: number };

export interface AdminApi {
  listSubmissions(status?: SubmissionStatus): Promise<Submission[]>;
  getSubmission(id: string): Promise<Submission | null>;
  updateSubmission(input: { id: string; status?: SubmissionStatus; notes?: string }): Promise<Submission>;
  listInvitations(status?: InvitationStatus): Promise<Invitation[]>;
  invite(input: InviteInput): Promise<InviteResult>;
  revokeInvitation(email: string): Promise<Invitation>;
  restoreInvitation(email: string): Promise<Invitation>;
  setGrants(email: string, sites: SiteId[]): Promise<Invitation>;
  /** With `newEmail` the same person has a changed address; without it the binding is cleared (plan §2.2). */
  rebindInvitation(email: string, newEmail?: string): Promise<Invitation>;
  deletePerson(personId: string): Promise<void>;
  eraseEmail(email: string): Promise<void>;
  listActivity(query?: ActivityQuery): Promise<Activity[]>;
}
