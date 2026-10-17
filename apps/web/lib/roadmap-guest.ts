import { Sha256 } from "@aws-crypto/sha256-js";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@smithy/signature-v4";

import type { GuestQuery } from "./roadmap.ts";

/**
 * The guest read the build makes for /streamlane/roadmap/ (lib/roadmap.ts; CRV-015), modelled on Streamlane's own
 * site's (`apps/site/lib/roadmap-guest.ts` there): the product's identity pool gives an unauthenticated identity, whose
 * credentials sign each GraphQL call to the product's Merged API with IAM, as the product's own pages do for someone
 * signed out (Streamlane ADR 0094, decision 2). A guest may call only the reads Streamlane's `guestReads` names
 * (`packages/backend-shared/src/guests.ts`); the page uses four of them, `organizationBySlug`, `listTeams`,
 * `listTeamNodes` and `nodeById`. Build time only: no page imports this, so nothing of it reaches a browser.
 */

/** The parts of the product's `amplify_outputs.json` the read needs. */
export type ProductOutputs = {
  auth?: { identity_pool_id?: string; aws_region?: string; unauthenticated_identities_enabled?: boolean };
  data?: { url?: string; aws_region?: string };
};

/** How long one call may take before it counts as failed, so a network that hangs never holds the build. */
const callTimeoutMs = 10_000;

/** The product's guest read, from its outputs; throws when the outputs name no identity pool or API. */
export const guestQuery = (outputs: ProductOutputs, fetchImpl: typeof fetch = fetch): GuestQuery => {
  const identityPoolId = outputs.auth?.identity_pool_id;
  const endpoint = outputs.data?.url;
  const region = outputs.data?.aws_region ?? outputs.auth?.aws_region;
  if (!identityPoolId || !endpoint || !region) {
    throw new Error("the product's outputs name no identity pool or API");
  }
  if (outputs.auth?.unauthenticated_identities_enabled === false) {
    throw new Error("the product's identity pool has no guest identity");
  }
  const provider = fromCognitoIdentityPool({
    identityPoolId,
    clientConfig: {
      region,
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 5_000, requestTimeout: callTimeoutMs },
    },
  });
  // One guest identity for the whole read, not one per call.
  let credentials: ReturnType<typeof provider> | undefined;
  const signer = new SignatureV4({
    service: "appsync",
    region,
    sha256: Sha256,
    credentials: () => {
      credentials ??= provider();
      return credentials;
    },
  });
  const url = new URL(endpoint);

  return async (query, variables) => {
    const body = JSON.stringify({ query, variables });
    const request = await signer.sign({
      method: "POST",
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.pathname,
      headers: { host: url.hostname, "content-type": "application/json" },
      body,
    });
    const response = await fetchImpl(url, {
      method: "POST",
      headers: request.headers,
      body,
      signal: AbortSignal.timeout(callTimeoutMs),
    });
    const text = await response.text();
    let payload: { data?: Record<string, unknown> | null; errors?: { message?: string; errorType?: string }[] };
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`the API answered ${response.status}`);
    }
    if (payload.errors?.length) {
      const messages = payload.errors.map((error) => error.message ?? error.errorType ?? "an error");
      throw new Error(`the API answered ${response.status}: ${messages.join("; ")}`);
    }
    if (!response.ok) {
      throw new Error(`the API answered ${response.status}`);
    }
    return payload.data ?? {};
  };
};
