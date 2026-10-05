import { defineFunction } from "@aws-amplify/backend";

import { functionLogging } from "../../functions/shared/logging.ts";

/**
 * crv-pre-sign-up, in the auth group (plan §2.2). It touches no table and takes no table name: its one way in is the
 * mutation checkAdmission, through `allow.resource` and the data client, so every dependency points from data to auth.
 */
export const preSignUp = defineFunction({
  name: "crv-pre-sign-up",
  entry: "./handler.ts",
  resourceGroupName: "auth",
  runtime: 24,
  timeoutSeconds: 5,
  memoryMB: 512,
  logging: functionLogging,
});
