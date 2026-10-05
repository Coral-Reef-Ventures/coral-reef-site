import { defineFunction } from "@aws-amplify/backend";

import { functionLogging } from "../../functions/shared/logging.ts";

/**
 * crv-pre-token-generation, in the auth group (plan §2.2). Like pre sign-up, it touches no table: it calls the mutation
 * admitSignIn through `allow.resource` and the data client, and crv-access binds or refuses.
 */
export const preTokenGeneration = defineFunction({
  name: "crv-pre-token-generation",
  entry: "./handler.ts",
  resourceGroupName: "auth",
  runtime: 24,
  timeoutSeconds: 5,
  memoryMB: 512,
  logging: functionLogging,
});
