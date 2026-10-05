import type { PreSignUpTriggerEvent } from "aws-lambda";

import { log, metric } from "../../functions/shared/log.ts";
import { documents, graphql } from "../../functions/shared/data-client.ts";

export type CheckAdmission = (email: string, userName: string, triggerSource: string) => Promise<{ admitted: boolean }>;

/** The message Cognito returns to the door when sign-up is refused; the door shows the form for it (plan §3). */
export const notInvited = "NOT_INVITED";

/**
 * Pre sign-up (plan §2.2). Password sign-up is refused. A federated first sign-in needs a verified email, lowercased,
 * whose Invitation is pending (or an admin address with none). AdminCreateUser, which is how the e2e suite makes its
 * temporary users, takes the same pending check. Anyone else is refused before Cognito creates a user, and a refusal
 * stores nothing: a count metric and a log line with no address.
 */
export const createPreSignUp =
  (checkAdmission: CheckAdmission) =>
  async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> => {
    const source = event.triggerSource;
    const refuse = (reason: string): never => {
      metric("DoorRefused");
      log("door.refused", { trigger: source, status: reason });
      throw new Error(notInvited);
    };
    if (source !== "PreSignUp_ExternalProvider" && source !== "PreSignUp_AdminCreateUser") refuse("PASSWORD_SIGN_UP");
    const attributes = event.request.userAttributes ?? {};
    if (source === "PreSignUp_ExternalProvider" && attributes.email_verified !== "true") refuse("EMAIL_NOT_VERIFIED");
    const email = (attributes.email ?? "").trim().toLowerCase();
    if (!email) refuse("NO_EMAIL");
    // The username Cognito will create the user under (`Google_<id>` for a federated one), which crv-access records
    // on the invitation so erasure can reach the user even if it never binds.
    const { admitted } = await checkAdmission(email, event.userName ?? "", source);
    if (!admitted) refuse("NOT_INVITED");
    log("door.sign_up_admitted", { trigger: source, status: "admitted" });
    return event;
  };

/** crv-pre-sign-up: one call to checkAdmission on crv-access, through the data client. */
export const handler = createPreSignUp(async (email, userName, triggerSource) => {
  const { checkAdmission } = await graphql<{ checkAdmission: { admitted: boolean } }>(documents.checkAdmission, {
    email,
    userName,
    triggerSource,
  });
  return { admitted: checkAdmission.admitted === true };
});
