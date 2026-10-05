import { a } from "@aws-amplify/backend";

import { adminsRead, noGeneratedWrites } from "../rules.ts";

/** crv-interest handles submitInterest (the named handler, Streamlane ADR 0055). */
const interestHandler = () => a.handler.function("crvInterest");

/**
 * Interest (plan §2.3, §2.4): what the form stores, and the one public operation. A Submission is unverified, so it
 * names an address but claims none; `personId` is set only when an admin invites from it.
 */
export const interest = {
  Interest: a.enum(["funding", "design_partner", "advisor", "other"]),
  SourceSite: a.enum(["crv", "streamlane", "driftline"]),
  SubmissionStatus: a.enum(["new", "reviewing", "invited", "declined", "archived"]),

  Submission: a
    .model({
      id: a.id().required(),
      name: a.string().required(),
      email: a.string().required(),
      organization: a.string(),
      interests: a.ref("Interest").required().array().required(),
      message: a.string().required(),
      sourceSite: a.ref("SourceSite").required(),
      status: a.ref("SubmissionStatus").required(),
      // Written on every status change, so the retention period runs from it.
      statusAt: a.datetime().required(),
      notes: a.string(),
      receivedAt: a.datetime().required(),
      reviewedBy: a.string(),
      reviewedAt: a.datetime(),
      // Set only by invite, and never cleared: an invited submission is kept as long as its Person (plan §2.3a).
      personId: a.id(),
      // DynamoDB TTL, set when declined or archived (plan §2.3a).
      expiresAt: a.timestamp(),
    })
    .secondaryIndexes((index) => [
      index("status").sortKeys(["receivedAt"]).name("byStatus").queryField("listSubmissionsByStatus"),
      index("email").sortKeys(["receivedAt"]).name("byEmail").queryField("listSubmissionsByEmail"),
      // The submissions an admin invited someone from, whatever address sent them: deletePerson erases them with the
      // Person, which the address alone cannot find once the invitation went to another address or moved to one.
      index("personId").sortKeys(["receivedAt"]).name("byPerson").queryField("listSubmissionsByPerson"),
    ])
    .disableOperations([...noGeneratedWrites])
    .authorization(adminsRead),

  InterestAnswer: a.customType({
    ok: a.boolean().required(),
    // Seconds until a limited sender may try again.
    retryAfter: a.integer(),
  }),

  // The one public entry: a guest mutation through the identity pool's unauthenticated role, behind the WAF web ACL.
  // It reads nothing and returns only { ok, retryAfter }. `website` is the honeypot.
  submitInterest: a
    .mutation()
    .arguments({
      name: a.string().required(),
      email: a.string().required(),
      organization: a.string(),
      interests: a.ref("Interest").required().array().required(),
      message: a.string().required(),
      site: a.ref("SourceSite").required(),
      website: a.string(),
    })
    .returns(a.ref("InterestAnswer").required())
    .handler(interestHandler())
    .authorization((allow) => [allow.guest()]),
};
