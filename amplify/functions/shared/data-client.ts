import process from "node:process";

import type { Schema } from "../../data/resource.ts";

/**
 * The data client a trigger or the retention sweep uses, configured once per container. This is their one way into the
 * data (plan §2.2): `allow.resource` gives the function's role the API's IAM policy and hands it the GraphQL endpoint
 * as an SSM-backed variable that Amplify's shim resolves into the environment before the handler runs, so nothing in
 * the function's own configuration points at the data stack. Loaded lazily, so a test of the handler's logic never
 * loads Amplify.
 */
let client: Promise<ReturnType<typeof import("aws-amplify/data").generateClient<Schema>>> | undefined;

export const dataClient = () => {
  client ??= (async () => {
    const [{ getAmplifyDataClientConfig }, { Amplify }, { generateClient }] = await Promise.all([
      import("@aws-amplify/backend/function/runtime"),
      import("aws-amplify"),
      import("aws-amplify/data"),
    ]);
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(process.env as never);
    Amplify.configure(resourceConfig, libraryOptions);
    return generateClient<Schema>({ authMode: "iam" });
  })();
  return client;
};

/** A GraphQL answer's data, or its first error as an Error carrying only the code the resolver returned. */
export const unwrap = <T>(answer: { data?: T | null; errors?: readonly { message: string }[] | null }): T => {
  if (answer.errors?.length) throw new Error(answer.errors[0]?.message ?? "request failed");
  if (answer.data === undefined || answer.data === null) throw new Error("request returned nothing");
  return answer.data;
};
