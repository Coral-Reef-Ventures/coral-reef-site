import type { AdminApi } from "./api.ts";

/**
 * The one place the admin views get their backend. Until the generated Amplify client is bound here (it arrives with
 * the backend, PR 1.3), the only backend is the in-memory stub, and it must be asked for: a build without
 * NEXT_PUBLIC_CRV_ADMIN_STUB has no data and the views say so, rather than showing sample rows as if they were real.
 * The stub is imported only inside that branch, so a build without the variable does not carry its sample data.
 */
let current: AdminApi | undefined;

export function setAdminApi(api: AdminApi | undefined): void {
  current = api;
}

/** Called once before the views render; binds the stub when the build asks for it. */
export async function prepareAdminApi(): Promise<void> {
  if (current) return;
  if (process.env.NEXT_PUBLIC_CRV_ADMIN_STUB === "1") {
    const { createStubApi } = await import("./stub.ts");
    current = createStubApi();
  }
}

export function getAdminApi(): AdminApi {
  if (current) return current;
  throw new Error("The admin backend is not connected in this build.");
}
