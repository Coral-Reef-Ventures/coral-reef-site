import { defineFunction } from "@aws-amplify/backend";

import { functionLogging } from "../shared/logging.ts";

/**
 * crv-visits: the daily page count (CRV-017). It asks Amplify for the host's access log of each of the last two days,
 * counts page requests by day, page and referring site, and writes PageCount rows with PutItem. Its grants, its table
 * and where the logs are (CRV_VISITS_*, auth/settings.ts) are added in backend.ts; without those settings it counts
 * nothing.
 */
export const crvVisits = defineFunction({
  name: "crv-visits",
  entry: "./handler.ts",
  resourceGroupName: "data",
  runtime: 24,
  timeoutSeconds: 300,
  memoryMB: 512,
  schedule: "every day",
  logging: functionLogging,
});
