import { a, type ClientSchema, defineData } from "@aws-amplify/backend";

import { access } from "../areas/access/schema.ts";
import { interest } from "../areas/interest/schema.ts";
import { people } from "../areas/people/schema.ts";
import { preSignUp } from "../auth/pre-sign-up/resource.ts";
import { preTokenGeneration } from "../auth/pre-token-generation/resource.ts";
import { crvAccess } from "../functions/access/resource.ts";
import { crvInterest } from "../functions/interest/resource.ts";
import { crvRetention } from "../functions/retention/resource.ts";

/**
 * One backend, three areas (plan §2.3). Areas are folders, each model, enum and operation is declared once in its
 * area, and a cross-area link is an id field, never a relationship, so an area can later move to its own backend
 * behind a Merged API without a schema change.
 *
 * The functions operations are handled by, by the name `a.handler.function` refers to them with (Streamlane ADR 0055:
 * a name, never the function object, which costs each operation six resources of its own).
 */
export const dataFunctions = { crvAccess, crvInterest };

const schema = a
  .schema({ ...people, ...interest, ...access })
  // The functions that call the API with their own IAM role: the two triggers (checkAdmission, admitSignIn) and the
  // retention sweep (Invitation.byStatus, deletePerson). Amplify creates each policy in the data stack and attaches it
  // to the function's role, so the edge points from data to auth (plan §2.2). crv-access and crv-interest write their
  // tables directly and never call the API, so they get no rule here.
  .authorization((allow) => [
    allow.resource(preSignUp).to(["query"]),
    allow.resource(preTokenGeneration).to(["mutate"]),
    allow.resource(crvRetention).to(["query", "mutate"]),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  functions: dataFunctions,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
