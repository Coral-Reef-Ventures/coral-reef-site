import { a } from "@aws-amplify/backend";

import { adminsRead, noGeneratedWrites } from "../rules.ts";

/** crv-access handles every operation here (the named handler, Streamlane ADR 0055). */
const accessHandler = () => a.handler.function("crvAccess");

/**
 * A group nobody is ever added to: the rule Amplify requires on an operation that only an IAM role may call. The real
 * check is crv-access's own, which admits only the named trigger's role (plan §2.2); this keeps every user out first.
 */
const TRIGGERS_ONLY = "crv-triggers-only";

// biome-ignore lint/suspicious/noExplicitAny: Amplify's authorization callback type is not exported.
const admins = (allow: any) => [allow.group("admins")];

/**
 * Access (plan §2.3): invitations, which bind to an identity, and grants, the one place access is decided. A grant's
 * `resource` is a typed string, `site:streamlane.app` now and `workspace:<orgId>` or `licence:<id>` later; its
 * `source` is `invitation`, `admin` or `admin-bootstrap`, a string because a GraphQL enum cannot hold a hyphen.
 */
export const access = {
  InvitationStatus: a.enum(["pending", "accepted", "revoked"]),
  GrantStatus: a.enum(["active", "revoked"]),
  DoorRefusal: a.enum(["REVOKED", "EMAIL_CHANGED", "NOT_BOUND"]),

  Invitation: a
    .model({
      email: a.string().required(),
      personId: a.id(),
      submissionId: a.id(),
      status: a.ref("InvitationStatus").required(),
      statusAt: a.datetime().required(),
      // The bound identity: set on acceptance, cleared only by rebindInvitation.
      cognitoUsername: a.string(),
      cognitoSub: a.string(),
      googleSub: a.string(),
      // Every Cognito username pre sign-up admitted for this address, bound or not, so erasure reaches each one.
      admittedUsernames: a.string().required().array(),
      invitedBy: a.string().required(),
      invitedAt: a.datetime().required(),
      sentAt: a.datetime(),
      acceptedAt: a.datetime(),
      revokedAt: a.datetime(),
      revokedBy: a.string(),
      note: a.string(),
    })
    .identifier(["email"])
    .secondaryIndexes((index) => [
      index("status").sortKeys(["statusAt"]).name("byStatus").queryField("listInvitationsByStatus"),
      index("cognitoSub").name("byCognitoSub").queryField("listInvitationsByCognitoSub"),
    ])
    .disableOperations([...noGeneratedWrites])
    .authorization(adminsRead),

  AccessGrant: a
    .model({
      // The session cookie's `gid`.
      id: a.id().required(),
      personId: a.id().required(),
      resource: a.string().required(),
      status: a.ref("GrantStatus").required(),
      source: a.string().required(),
      grantedBy: a.string().required(),
      grantedAt: a.datetime().required(),
      revokedAt: a.datetime(),
      revokedBy: a.string(),
    })
    .secondaryIndexes((index) => [
      index("personId").sortKeys(["resource"]).name("byPerson").queryField("listAccessGrantsByPerson"),
      index("resource").sortKeys(["grantedAt"]).name("byResource").queryField("listAccessGrantsByResource"),
    ])
    .disableOperations([...noGeneratedWrites])
    .authorization(adminsRead),

  DoorGrant: a.customType({ site: a.string().required(), host: a.string().required() }),
  DoorEntry: a.customType({
    invited: a.boolean().required(),
    grants: a.ref("DoorGrant").required().array().required(),
    admin: a.boolean().required(),
    reason: a.ref("DoorRefusal"),
  }),
  SiteTicket: a.customType({ action: a.string().required(), ticket: a.string().required() }),
  InvitationView: a.customType({
    email: a.string().required(),
    personId: a.id(),
    submissionId: a.id(),
    status: a.ref("InvitationStatus").required(),
    statusAt: a.datetime().required(),
    bound: a.boolean().required(),
    invitedBy: a.string().required(),
    invitedAt: a.datetime().required(),
    acceptedAt: a.datetime(),
    revokedAt: a.datetime(),
    note: a.string(),
    // The production host of each site an active grant opens.
    sites: a.string().required().array().required(),
  }),
  InviteResult: a.customType({
    invitation: a.ref("InvitationView").required(),
    subject: a.string().required(),
    text: a.string().required(),
  }),
  Admission: a.customType({ admitted: a.boolean().required(), reason: a.string(), admin: a.boolean() }),
  Done: a.customType({ ok: a.boolean().required() }),

  // The door, for a signed-in user. enterDoor is a mutation because it writes `access.signed_in`.
  enterDoor: a
    .mutation()
    .returns(a.ref("DoorEntry").required())
    .handler(accessHandler())
    .authorization((allow) => [allow.authenticated()]),
  issueSiteTicket: a
    .mutation()
    .arguments({
      site: a.string().required(),
      next: a.string().required(),
      state: a.string().required(),
      host: a.string().required(),
    })
    .returns(a.ref("SiteTicket").required())
    .handler(accessHandler())
    .authorization((allow) => [allow.authenticated()]),

  // The admin's. Sites may be named by id (`streamlane`) or host (`streamlane.app`).
  invite: a
    .mutation()
    .arguments({
      email: a.string().required(),
      sites: a.string().required().array().required(),
      submissionId: a.id(),
      note: a.string(),
    })
    .returns(a.ref("InviteResult").required())
    .handler(accessHandler())
    .authorization(admins),
  revokeInvitation: a
    .mutation()
    .arguments({ email: a.string().required() })
    .returns(a.ref("InvitationView").required())
    .handler(accessHandler())
    .authorization(admins),
  restoreInvitation: a
    .mutation()
    .arguments({ email: a.string().required() })
    .returns(a.ref("InvitationView").required())
    .handler(accessHandler())
    .authorization(admins),
  setGrants: a
    .mutation()
    .arguments({ email: a.string().required(), sites: a.string().required().array().required() })
    .returns(a.ref("InvitationView").required())
    .handler(accessHandler())
    .authorization(admins),
  rebindInvitation: a
    .mutation()
    .arguments({ email: a.string().required(), newEmail: a.string() })
    .returns(a.ref("InvitationView").required())
    .handler(accessHandler())
    .authorization(admins),
  updateSubmission: a
    .mutation()
    .arguments({ id: a.id().required(), status: a.ref("SubmissionStatus"), notes: a.string() })
    .returns(a.ref("Submission"))
    .handler(accessHandler())
    .authorization(admins),
  // Also called by crv-retention, through the schema-level allow.resource rule; crv-access checks its role.
  deletePerson: a
    .mutation()
    .arguments({ personId: a.id().required() })
    .returns(a.ref("Done").required())
    .handler(accessHandler())
    .authorization(admins),
  eraseEmail: a
    .mutation()
    .arguments({ email: a.string().required() })
    .returns(a.ref("Done").required())
    .handler(accessHandler())
    .authorization(admins),

  // Trigger-only: reachable through the schema-level allow.resource rules, and crv-access admits only the named role.
  // A mutation because admitting an invitee records the username Cognito is about to create (erasure reads it).
  checkAdmission: a
    .mutation()
    .arguments({
      email: a.string().required(),
      userName: a.string().required(),
      triggerSource: a.string().required(),
    })
    .returns(a.ref("Admission").required())
    .handler(accessHandler())
    .authorization((allow) => [allow.group(TRIGGERS_ONLY)]),
  admitSignIn: a
    .mutation()
    .arguments({
      userName: a.string().required(),
      sub: a.string().required(),
      googleSub: a.string().required(),
      email: a.string().required(),
      // Whether the token is being issued with the `admins` group, so crv-access keeps the group in step with
      // CRV_ADMIN_EMAILS.
      inAdmins: a.boolean(),
    })
    .returns(a.ref("Admission").required())
    .handler(accessHandler())
    .authorization((allow) => [allow.group(TRIGGERS_ONLY)]),
};
