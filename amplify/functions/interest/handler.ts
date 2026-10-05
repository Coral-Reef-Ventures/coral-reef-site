import process from "node:process";

import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

import { dynamoStore } from "../shared/dynamo-store.ts";
import { ulid } from "../shared/ids.ts";
import { tableEnvironment } from "../shared/tables.ts";
import { createInterest } from "./interest.ts";
import { createLimits, rateTable } from "./limits.ts";

const sns = new SNSClient({});
const store = dynamoStore({ ...tableEnvironment(process.env), [rateTable]: process.env.RATE_LIMITS_TABLE ?? "" });

/** crv-interest: the AppSync resolver for submitInterest. Its tables and topic are added in backend.ts. */
export const handler = createInterest({
  store,
  limits: createLimits(store),
  async publish(subject, message) {
    await sns.send(new PublishCommand({ TopicArn: process.env.NOTICE_TOPIC_ARN, Subject: subject, Message: message }));
  },
  adminOrigin: process.env.CRV_ADMIN_ORIGIN ?? "https://coralreefventures.com",
  now: () => new Date(),
  id: () => ulid(),
});
