import type { PreTokenGenerationTriggerEvent } from "aws-lambda";

import { log } from "../../functions/shared/log.ts";
import { dataClient, unwrap } from "../../functions/shared/data-client.ts";

export type SignIn = { userName: string; sub: string; googleSub: string; email: string };
export type AdmitSignIn = (
  signIn: SignIn,
) => Promise<{ admitted: boolean; reason?: string | null; admin?: boolean | null }>;

/** The Google identity's own id, from the `identities` attribute Cognito keeps for a federated user. */
export const googleSubOf = (identities: string | undefined): string => {
  if (!identities) return "";
  try {
    const list = JSON.parse(identities) as { providerName?: string; userId?: string }[];
    return list.find((identity) => identity.providerName === "Google")?.userId ?? "";
  } catch {
    return "";
  }
};

/**
 * Pre token generation (plan §2.2), on every trigger source, refresh included: no token is issued unless crv-access
 * admits this identity. On the first sign-in it binds the pending invitation; after that it admits only the bound
 * identity, while the invitation is accepted and the email is the bound one. An admin address gets the `admins` group
 * in this very token, since the group it was just added to is not yet in the event.
 */
export const createPreTokenGeneration =
  (admitSignIn: AdmitSignIn) =>
  async (event: PreTokenGenerationTriggerEvent): Promise<PreTokenGenerationTriggerEvent> => {
    const attributes = event.request.userAttributes ?? {};
    const answer = await admitSignIn({
      userName: event.userName,
      sub: attributes.sub ?? "",
      googleSub: googleSubOf(attributes.identities),
      email: (attributes.email ?? "").trim().toLowerCase(),
    });
    if (!answer.admitted) {
      const reason = answer.reason ?? "NOT_INVITED";
      log("door.token_refused", { trigger: event.triggerSource, status: reason });
      throw new Error(reason);
    }
    const groups = event.request.groupConfiguration?.groupsToOverride ?? [];
    if (answer.admin && !groups.includes("admins")) {
      const configuration = event.request.groupConfiguration;
      event.response = {
        ...event.response,
        claimsOverrideDetails: {
          ...event.response?.claimsOverrideDetails,
          groupOverrideDetails: {
            groupsToOverride: [...groups, "admins"],
            ...(configuration?.iamRolesToOverride ? { iamRolesToOverride: configuration.iamRolesToOverride } : {}),
            ...(configuration?.preferredRole ? { preferredRole: configuration.preferredRole } : {}),
          },
        },
      };
    }
    log("door.token_admitted", { trigger: event.triggerSource, status: answer.admin ? "admin" : "invitee" });
    return event;
  };

/** crv-pre-token-generation: one call to admitSignIn on crv-access, through the data client. */
export const handler = createPreTokenGeneration(async (signIn) => {
  const client = await dataClient();
  const answer = unwrap(await client.mutations.admitSignIn(signIn));
  return { admitted: answer.admitted === true, reason: answer.reason, admin: answer.admin };
});
