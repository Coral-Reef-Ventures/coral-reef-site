import { defineFunction } from "@aws-amplify/backend";

import { authConfig } from "../../auth/auth-config.ts";
import { functionLogging } from "../shared/logging.ts";

/**
 * crv-interest: the resolver for submitInterest, the one public operation (plan §2.4). A guest mutation behind the
 * regional WAF web ACL, rather than a function URL, which would accept any caller. It reaches only the Submission and
 * Activity tables, the rate-limit table and the notice topic, all added in backend.ts. No reserved concurrency: the
 * project's limit is 10, which allows none.
 */
export const crvInterest = defineFunction({
  name: "crv-interest",
  entry: "./handler.ts",
  resourceGroupName: "data",
  runtime: 24,
  timeoutSeconds: 10,
  memoryMB: 256,
  logging: functionLogging,
  environment: { CRV_ADMIN_ORIGIN: authConfig.adminOrigin },
});
