import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureDataClient, documents, runDocument } from "./data-client.ts";

/**
 * The triggers' and the sweep's way into the API, run against a local stand-in for AppSync. On the agent sandbox
 * (2026-10-04) the first version failed twice: its requests were unsigned ("No credentials"), because aws-amplify 6.22
 * wires the credentials into its context only when the config has an Auth section; and an error response surfaced as
 * "[object Object]", because Amplify throws the whole result rather than an Error.
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
      const answer = body.includes("refused@")
        ? { data: null, errors: [{ message: "FORBIDDEN", errorType: "Lambda:Unhandled" }] }
        : { data: { checkAdmission: { admitted: true, reason: null, admin: false } } };
      response.end(JSON.stringify(answer));
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

  /** What Amplify's shim and the Lambda runtime put in the environment. */
  const env = () => ({
    AWS_REGION: "us-east-2",
    AWS_ACCESS_KEY_ID: "AKIDFUNCTIONROLE",
    AWS_SECRET_ACCESS_KEY: "secret",
    AWS_SESSION_TOKEN: "session-token",
    AMPLIFY_DATA_DEFAULT_NAME: "amplifyData",
    AMPLIFY_DATA_GRAPHQL_ENDPOINT: endpoint,
    AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_BUCKET_NAME: "bucket",
    AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_KEY: "key",
  });
  /** The introspection schema the helper reads from S3. */
  const s3 = {
    send: async () => ({
      Body: { transformToString: async () => JSON.stringify({ version: 1, models: {}, enums: {}, nonModels: {} }) },
    }),
  };
  const variables = { email: "a@b.co", triggerSource: "PreSignUp_ExternalProvider" };

  it("signs each request with the function's own IAM credentials", async () => {
    const client = await configureDataClient(env(), s3 as never);
    expect(await runDocument(client, documents.checkAdmission, variables)).toEqual({
      checkAdmission: { admitted: true, reason: null, admin: false },
    });
    const request = seen.at(-1);
    expect(request?.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDFUNCTIONROLE\/\d{8}\/us-east-2\/appsync\/aws4_request, /,
    );
    expect(request?.headers["x-amz-security-token"]).toBe("session-token");
    expect(JSON.parse(request?.body ?? "{}").variables).toEqual(variables);
  });

  it("turns an error response into an Error carrying the resolver's code alone", async () => {
    const client = await configureDataClient(env(), s3 as never);
    await expect(
      runDocument(client, documents.checkAdmission, { ...variables, email: "refused@b.co" }),
    ).rejects.toThrow(/^FORBIDDEN$/);
  });
});
