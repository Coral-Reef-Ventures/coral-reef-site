import process from "node:process";

import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";

/**
 * The data client a trigger or the retention sweep uses, configured once per container. This is their one way into the
 * data (plan §2.2): `allow.resource` gives the function's role the API's IAM policy and hands it the GraphQL endpoint
 * as an SSM-backed variable that Amplify's shim resolves into the environment before the handler runs, so nothing in
 * the function's own configuration points at the data stack. The documents are written by hand, as the door's own client writes them, so this shared file does not
 * reach into the schema; `client-documents.test.ts` checks them against it.
 */
type Graphql = { graphql(options: { query: string; variables: object }): Promise<unknown> };
type S3 = Parameters<typeof getAmplifyDataClientConfig>[1];

/**
 * Configures Amplify for a function and returns its GraphQL client. `getAmplifyDataClientConfig` hands back an API-only
 * resource config and the function's own credentials as `libraryOptions.Auth`. aws-amplify 6.22 (core 6.19) wires the
 * Auth providers into its context only when the resource config has an `Auth` section, so without one the credentials
 * never reach the request and every call fails with "No credentials" (found on the agent sandbox, 2026-10-04). An empty
 * section is enough: the credentials provider reads the function's environment and ignores the auth config.
 */
export const configureDataClient = async (env: NodeJS.ProcessEnv, s3?: S3): Promise<Graphql> => {
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env as never, s3);
  Amplify.configure({ ...resourceConfig, Auth: {} } as Parameters<typeof Amplify.configure>[0], libraryOptions);
  return generateClient({ authMode: "iam" }) as unknown as Graphql;
};

let client: Promise<Graphql> | undefined;
const dataClient = () => {
  client ??= configureDataClient(process.env);
  return client;
};

type Result<T> = { data?: T | null; errors?: readonly { message?: string }[] | null };

/** The first error's message, which from crv-access is a refusal code and never a value. */
const firstError = (result: Result<unknown>): string => result.errors?.[0]?.message ?? "request failed";

/**
 * Runs one document with the function's own IAM role and returns its data, or throws its first error's code. Amplify
 * throws the whole result, not an Error, when a response carries errors.
 */
export const runDocument = async <T>(client: Graphql, query: string, variables: object): Promise<T> => {
  let answer: Result<T>;
  try {
    answer = (await client.graphql({ query, variables })) as Result<T>;
  } catch (thrown) {
    if (thrown instanceof Error) throw thrown;
    throw new Error(firstError(thrown as Result<T>));
  }
  if (answer.errors?.length) throw new Error(firstError(answer));
  if (answer.data === undefined || answer.data === null) throw new Error("request returned nothing");
  return answer.data;
};

/** One document through this container's client. */
export const graphql = async <T>(query: string, variables: object): Promise<T> =>
  runDocument<T>(await dataClient(), query, variables);

/** The documents the triggers and the sweep send. */
export const documents = {
  checkAdmission: /* GraphQL */ `
    query CheckAdmission($email: String!, $triggerSource: String!) {
      checkAdmission(email: $email, triggerSource: $triggerSource) {
        admitted
        reason
        admin
      }
    }
  `,
  admitSignIn: /* GraphQL */ `
    mutation AdmitSignIn($userName: String!, $sub: String!, $googleSub: String!, $email: String!) {
      admitSignIn(userName: $userName, sub: $sub, googleSub: $googleSub, email: $email) {
        admitted
        reason
        admin
      }
    }
  `,
  listInvitationsByStatus: /* GraphQL */ `
    query ListInvitationsByStatus($status: InvitationStatus!, $statusAt: ModelStringKeyConditionInput, $nextToken: String) {
      listInvitationsByStatus(status: $status, statusAt: $statusAt, nextToken: $nextToken) {
        items {
          personId
        }
        nextToken
      }
    }
  `,
  deletePerson: /* GraphQL */ `
    mutation DeletePerson($personId: ID!) {
      deletePerson(personId: $personId) {
        ok
      }
    }
  `,
} as const;
