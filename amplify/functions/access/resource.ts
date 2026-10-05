import { defineFunction } from "@aws-amplify/backend";

import { authConfig } from "../../auth/auth-config.ts";
import { functionLogging } from "../shared/logging.ts";

/**
 * crv-access: every custom operation but submitInterest, through the named handler "crvAccess" (plan §2.3). It sits in
 * the data group and does every table read and write, the binding transaction included, so the Cognito triggers touch
 * no table (plan §2.2). Its tables, the user pool, the door key and the roles allowed to call the trigger-only and
 * retention operations are added in backend.ts; each of those edges points from data to auth.
 */
export const crvAccess = defineFunction({
  name: "crv-access",
  entry: "./handler.ts",
  resourceGroupName: "data",
  runtime: 24,
  timeoutSeconds: 10,
  memoryMB: 512,
  logging: functionLogging,
  environment: {
    CRV_ADMIN_EMAILS: authConfig.adminEmails.join(","),
    CRV_ADMIN_ORIGIN: authConfig.adminOrigin,
    CRV_DOOR_TEST_HOSTS: authConfig.testHosts,
  },
});
