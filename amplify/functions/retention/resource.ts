import { defineFunction } from "@aws-amplify/backend";

import { functionLogging } from "../shared/logging.ts";

/**
 * crv-retention: the daily sweep (plan §2.3a). It deletes everyone whose invitation has been revoked or pending for 12
 * months, by querying Invitation.byStatus (never a scan) and calling deletePerson, all through the data client. It has
 * no grants of its own beyond `allow.resource`.
 */
export const crvRetention = defineFunction({
  name: "crv-retention",
  entry: "./handler.ts",
  resourceGroupName: "data",
  runtime: 24,
  timeoutSeconds: 300,
  memoryMB: 256,
  schedule: "every day",
  logging: functionLogging,
});
