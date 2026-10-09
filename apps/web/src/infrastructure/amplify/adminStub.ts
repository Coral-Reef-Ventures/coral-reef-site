import type {
  Activity,
  ActivityQuery,
  AdminApi,
  Invitation,
  InvitationStatus,
  InviteInput,
  SiteId,
  Submission,
  SubmissionStatus,
} from "./api.ts";

/**
 * An in-memory AdminApi with a little sample data. It is the backend the views run against until the schema exists,
 * and the one the tests and the local e2e use. It enforces the same refusals the real operations do (an invitation
 * that is bound cannot be invited again, only an invited address can be revoked) so a view that mishandles one fails
 * here too. Nothing in it is reachable unless NEXT_PUBLIC_CRV_ADMIN_STUB is set (client.ts).
 */
export function createStubApi(now: () => Date = () => new Date()): AdminApi & { reset(): void } {
  let submissions: Submission[] = [];
  let invitations: Invitation[] = [];
  let activity: Activity[] = [];
  let counter = 0;

  const nextId = () => `01STUB${String(++counter).padStart(6, "0")}`;
  const stamp = () => now().toISOString();

  function log(
    kind: string,
    area: Activity["area"],
    subjectType: string,
    subjectId: string,
    personId?: string,
    extra?: { actorId?: string; detail?: Record<string, unknown> },
  ) {
    activity.unshift({
      id: nextId(),
      personId,
      actorId: extra?.actorId ?? "stub-admin",
      area,
      kind,
      subjectType,
      subjectId,
      at: stamp(),
      detail: extra?.detail,
    });
  }

  function seed() {
    counter = 0;
    const base = now().getTime();
    const ago = (days: number) => new Date(base - days * 86_400_000).toISOString();
    submissions = [
      {
        id: "01STUB-S1",
        name: "Ada Example",
        email: "ada@example.com",
        organization: "Example Capital",
        interests: ["funding"],
        message: "Interested in the seed round.",
        sourceSite: "crv",
        status: "new",
        statusAt: ago(2),
        notes: "",
        receivedAt: ago(2),
      },
      {
        id: "01STUB-S2",
        name: "Ben Sample",
        email: "ben@example.org",
        organization: "",
        interests: ["design_partner", "advisor"],
        message: "We could try it with our team.",
        sourceSite: "driftline",
        status: "reviewing",
        statusAt: ago(45),
        notes: "Replied once.",
        receivedAt: ago(45),
      },
      {
        id: "01STUB-S3",
        name: "Cy Test",
        email: "cy@example.net",
        organization: "Test Co",
        interests: ["other"],
        message: "Hello.",
        sourceSite: "streamlane",
        status: "declined",
        statusAt: ago(10),
        notes: "",
        receivedAt: ago(12),
      },
    ];
    invitations = [
      {
        email: "dee@example.com",
        personId: "01STUB-P1",
        status: "accepted",
        statusAt: ago(5),
        bound: true,
        invitedBy: "01STUB-ADMIN",
        invitedAt: ago(7),
        acceptedAt: ago(5),
        sites: ["streamlane.app", "driftline.app"],
      },
      {
        email: "eli@example.com",
        personId: "01STUB-P2",
        status: "pending",
        statusAt: ago(1),
        bound: false,
        invitedBy: "01STUB-ADMIN",
        invitedAt: ago(1),
        sites: ["driftline.app"],
      },
    ];
    activity = [];
    log("interest.submitted", "interest", "Submission", "01STUB-S1");
    log("access.invited", "access", "Invitation", "eli@example.com", "01STUB-P2");
    log("access.signed_up", "access", "Invitation", "dee@example.com", "01STUB-P1");
    // As the backend writes it: the person is the subject and the actor, and the detail names the site, never the ticket.
    log("access.ticket_issued", "access", "Person", "01STUB-P1", "01STUB-P1", {
      actorId: "01STUB-P1",
      detail: { site: "driftline", host: "driftline.app", grantId: "01STUB-G1", jti: "01STUB-T1" },
    });
  }
  seed();

  function invitation(email: string): Invitation {
    const found = invitations.find((i) => i.email === email.toLowerCase());
    if (!found) throw new Error("NOT_FOUND");
    return found;
  }
  function setStatus(inv: Invitation, status: InvitationStatus) {
    inv.status = status;
    inv.statusAt = stamp();
    if (status === "revoked") inv.revokedAt = inv.statusAt;
  }

  return {
    reset: seed,
    async listSubmissions(status?: SubmissionStatus) {
      return submissions
        .filter((s) => !status || s.status === status)
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
        .map((s) => ({ ...s }));
    },
    async getSubmission(id) {
      const s = submissions.find((x) => x.id === id);
      return s ? { ...s } : null;
    },
    async updateSubmission({ id, status, notes }) {
      const s = submissions.find((x) => x.id === id);
      if (!s) throw new Error("NOT_FOUND");
      // As the backend: `invited` is set by an invitation and never left through a status change.
      if (status && status !== s.status && (s.status === "invited" || status === "invited")) {
        throw new Error(s.status === "invited" ? "INVITED" : "INVITE_REQUIRED");
      }
      if (status && status !== s.status) {
        s.status = status;
        s.statusAt = stamp();
        log("interest.status_changed", "interest", "Submission", id, s.personId);
      }
      if (notes !== undefined && notes !== s.notes) {
        s.notes = notes;
        log("interest.note_added", "interest", "Submission", id, s.personId);
      }
      s.reviewedAt = stamp();
      return { ...s };
    },
    async listInvitations(status) {
      return invitations
        .filter((i) => !status || i.status === status)
        .sort((a, b) => b.invitedAt.localeCompare(a.invitedAt))
        .map((i) => ({ ...i, sites: [...i.sites] }));
    },
    async invite({ email, sites, submissionId, note }: InviteInput) {
      const address = email.trim().toLowerCase();
      const existing = invitations.find((i) => i.email === address);
      if (existing?.bound) throw new Error("ALREADY_BOUND");
      if (existing) throw new Error("ALREADY_INVITED");
      if (sites.length === 0) throw new Error("NO_SITES");
      const created: Invitation = {
        email: address,
        personId: nextId(),
        submissionId,
        status: "pending",
        statusAt: stamp(),
        bound: false,
        invitedBy: "01STUB-ADMIN",
        invitedAt: stamp(),
        note,
        sites: [...sites],
      };
      invitations.push(created);
      if (submissionId) {
        const s = submissions.find((x) => x.id === submissionId);
        if (s) {
          s.status = "invited";
          s.statusAt = stamp();
          s.personId = created.personId;
        }
      }
      log("access.invited", "access", "Invitation", address, created.personId);
      return { invitation: { ...created }, text: `Invitation for ${address}: ${sites.join(", ")}` };
    },
    async revokeInvitation(email) {
      const inv = invitation(email);
      setStatus(inv, "revoked");
      log("access.revoked", "access", "Invitation", inv.email, inv.personId);
      return { ...inv };
    },
    async restoreInvitation(email) {
      const inv = invitation(email);
      if (inv.status !== "revoked") throw new Error("NOT_REVOKED");
      setStatus(inv, inv.bound ? "accepted" : "pending");
      log("access.restored", "access", "Invitation", inv.email, inv.personId);
      return { ...inv };
    },
    async setGrants(email, sites: SiteId[]) {
      const inv = invitation(email);
      inv.sites = [...sites];
      return { ...inv, sites: [...inv.sites] };
    },
    async rebindInvitation(email, newEmail) {
      const inv = invitation(email);
      if (!inv.bound) throw new Error("NOT_BOUND");
      if (newEmail) inv.email = newEmail.trim().toLowerCase();
      else {
        inv.bound = false;
        setStatus(inv, "pending");
      }
      log("access.rebound", "access", "Invitation", inv.email, inv.personId);
      return { ...inv };
    },
    async deletePerson(personId) {
      invitations = invitations.filter((i) => i.personId !== personId);
      activity = activity.filter((a) => a.personId !== personId);
      log("people.deleted", "people", "Person", personId);
    },
    async eraseEmail(email) {
      const address = email.trim().toLowerCase();
      const inv = invitations.find((i) => i.email === address);
      submissions = submissions.filter((s) => s.email !== address);
      if (inv?.personId) await this.deletePerson(inv.personId);
    },
    async listActivity({ area, personId, subjectId, limit = 100 }: ActivityQuery = {}) {
      return activity
        .filter((a) => (!area || a.area === area) && (!personId || a.personId === personId))
        .filter((a) => !subjectId || a.subjectId === subjectId)
        .slice(0, limit)
        .map((a) => ({ ...a }));
    },
  };
}
