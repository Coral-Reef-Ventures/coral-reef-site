import { defineAuth, secret } from "@aws-amplify/backend";

import { authConfig } from "./auth-config.ts";
import { preSignUp } from "./pre-sign-up/resource.ts";
import { preTokenGeneration } from "./pre-token-generation/resource.ts";

/**
 * The door's user pool (plan §2.2). Google is the only way in: Gen 2 needs a login method, so email is on, and pre
 * sign-up refuses password sign-up. The prefix domain (`crv-door`, fixed so the Google client's redirect URI is known
 * before the first deploy) means no custom auth domain and so no us-east-1 certificate. defineAuth always replaces the
 * prefix with a hash of the backend's id, so backend.ts sets `authConfig.domainPrefix` on the domain resource itself. The Google client's id
 * and secret are Amplify secrets, set once on the Amplify app; an agent's sandbox runs with placeholders and never
 * signs in with Google.
 *
 * Both triggers sit in the auth resource group and reach data only through `allow.resource` and the data client, so
 * the nested stacks have no cycle (`auth/wiring.test.ts`). There is no post confirmation trigger: Cognito does not run
 * it for federated or admin-created users, which is every door user.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret("GOOGLE_CLIENT_ID"),
        clientSecret: secret("GOOGLE_CLIENT_SECRET"),
        scopes: ["openid", "email", "profile"],
        attributeMapping: { email: "email", emailVerified: "email_verified", fullname: "name" },
      },
      callbackUrls: authConfig.callbackUrls,
      logoutUrls: authConfig.logoutUrls,
    },
  },
  groups: ["admins"],
  triggers: { preSignUp, preTokenGeneration },
});
