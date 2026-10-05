import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureDataClient, documents } from "./data-client.ts";

/**
 * The triggers' and the sweep's way into the API, run against a local stand-in for AppSync: the request must be signed
 * with SigV4 using the function's own credentials. On the agent sandbox it was not ("No credentials", 2026-10-04),
 * because aws-amplify 6.22 wires the credentials into its context only when the config has an Auth section.
 */
describe("the functions' data client", () => {
  const seen: { headers: IncomingHttpHeaders; body: string }[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      seen.push({ headers: request.headers, body });
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: { checkAdmission: { admitted: true, reason: null, admin: false } } }));
    });
  });
  let endpoint = "";
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/graphql`;
  });
  afterAll(() => {
    server.close();
  });

  it("signs each request with the function's own IAM credentials", async () => {
    // What Amplify's shim and the Lambda runtime put in the environment, and the introspection schema it reads from S3.
    const env = {
      AWS_REGION: "us-east-2",
      AWS_ACCESS_KEY_ID: "AKIDFUNCTIONROLE",
      AWS_SECRET_ACCESS_KEY: "secret",
      AWS_SESSION_TOKEN: "session-token",
      AMPLIFY_DATA_DEFAULT_NAME: "amplifyData",
      AMPLIFY_DATA_GRAPHQL_ENDPOINT: endpoint,
      AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_BUCKET_NAME: "bucket",
      AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_KEY: "key",
    };
    const s3 = {
      send: async () => ({
        Body: { transformToString: async () => JSON.stringify({ version: 1, models: {}, enums: {}, nonModels: {} }) },
      }),
    };
    const client = await configureDataClient(env, s3 as never);
    const answer = (await client.graphql({
      query: documents.checkAdmission,
      variables: { email: "a@b.co", triggerSource: "PreSignUp_ExternalProvider" },
    })) as { data: unknown };
    expect(answer.data).toEqual({ checkAdmission: { admitted: true, reason: null, admin: false } });
    const [request] = seen;
    expect(request?.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDFUNCTIONROLE\/\d{8}\/us-east-2\/appsync\/aws4_request, /,
    );
    expect(request?.headers["x-amz-security-token"]).toBe("session-token");
    expect(JSON.parse(request?.body ?? "{}").variables).toEqual({
      email: "a@b.co",
      triggerSource: "PreSignUp_ExternalProvider",
    });
  });
});
