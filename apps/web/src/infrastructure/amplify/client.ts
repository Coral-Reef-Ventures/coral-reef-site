import { Amplify } from "aws-amplify";
import { fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/api";
import { Hub } from "aws-amplify/utils";

import { stubApi } from "./stub.ts";
import type { DoorApi, EnterDoorAnswer, InterestAnswer, RedirectOutcome, TicketAnswer } from "./types.ts";

/**
 * The backend's outputs, inlined at build by next.config.ts. Empty when there is no deployment, and then nothing is
 * configured: every call below fails, which the components show as a failure, rather than reach somewhere else.
 */
const outputs = process.env.CRV_AMPLIFY_OUTPUTS;
let configured = false;
const configure = (): boolean => {
  if (configured) return true;
  if (!outputs) return false;
  // ssr: false keeps the tokens in this browser's storage; the door sets no cookie of its own.
  Amplify.configure(JSON.parse(outputs), { ssr: false });
  configured = true;
  return true;
};

type Answer<T> = { data?: T; errors?: { message: string }[] };

/** The one corner of the client's API the door uses: its own types do not unify without a schema, so it is named here. */
type Graphql = { graphql(options: { query: string; variables: object; authMode: string }): Promise<unknown> };

let api: Graphql | undefined;
/** The one `generateClient` in the app. */
const client = (): Graphql => {
  if (!configure()) throw new Error("The door is not connected to a backend.");
  api ??= generateClient() as unknown as Graphql;
  return api;
};

const call = async <T>(query: string, variables: object, authMode: "identityPool" | "userPool"): Promise<T> => {
  const result = (await client().graphql({ query, variables, authMode })) as Answer<T>;
  if (result.errors?.length) throw new Error(result.errors[0]?.message ?? "The request failed.");
  if (result.data === undefined) throw new Error("The request returned nothing.");
  return result.data;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const amplifyApi: DoorApi = {
  async submitInterest(input) {
    const data = await call<{ submitInterest: InterestAnswer }>(
      /* GraphQL */ `
        mutation SubmitInterest($name: String!, $email: String!, $organization: String, $interests: String!, $message: String!, $site: String!, $website: String) {
          submitInterest(name: $name, email: $email, organization: $organization, interests: $interests, message: $message, site: $site, website: $website) {
            ok
            retryAfter
          }
        }
      `,
      input,
      "identityPool",
    );
    return data.submitInterest;
  },

  async hasSession() {
    if (!configure()) return false;
    const { tokens } = await fetchAuthSession();
    return tokens?.idToken !== undefined;
  },

  completeRedirect() {
    if (!configure()) return Promise.resolve<RedirectOutcome>({ error: "not configured" });
    return new Promise<RedirectOutcome>((resolve) => {
      let customState: string | undefined;
      const stop = Hub.listen("auth", ({ payload }) => {
        if (payload.event === "customOAuthState") customState = String(payload.data);
        if (payload.event === "signInWithRedirect") {
          stop();
          resolve(customState === undefined ? {} : { customState });
        }
        if (payload.event === "signInWithRedirect_failure") {
          stop();
          const data = payload.data as { error?: { message?: string } } | undefined;
          resolve({ error: data?.error?.message ?? "sign-in failed" });
        }
      });
      // A return that was already completed before this listener existed leaves a session behind.
      void (async () => {
        await wait(1500);
        if (await amplifyApi.hasSession()) {
          stop();
          resolve(customState === undefined ? {} : { customState });
        }
      })();
      void wait(20_000).then(() => {
        stop();
        resolve({ error: "timed out" });
      });
    });
  },

  async signInWithGoogle(customState) {
    if (!configure()) throw new Error("The door is not connected to a backend.");
    await signInWithRedirect({ provider: "Google", ...(customState === undefined ? {} : { customState }) });
  },

  async signOut() {
    if (!configure()) return;
    await signOut({ global: true });
  },

  async enterDoor() {
    const data = await call<{ enterDoor: EnterDoorAnswer }>(
      /* GraphQL */ `
        query EnterDoor {
          enterDoor {
            invited
            admin
            reason
            grants {
              site
              host
            }
          }
        }
      `,
      {},
      "userPool",
    );
    return data.enterDoor;
  },

  async issueSiteTicket(request) {
    const data = await call<{ issueSiteTicket: TicketAnswer }>(
      /* GraphQL */ `
        mutation IssueSiteTicket($site: String!, $next: String!, $state: String!, $host: String!) {
          issueSiteTicket(site: $site, next: $next, state: $state, host: $host) {
            action
            ticket
          }
        }
      `,
      request,
      "userPool",
    );
    return data.issueSiteTicket;
  },
};

/**
 * The backend, or its stub when the build says so. The flag is replaced at build time, so a production build drops the
 * stub with the branch that names it.
 */
export const doorApi: DoorApi = process.env.CRV_STUB === "1" ? stubApi : amplifyApi;
