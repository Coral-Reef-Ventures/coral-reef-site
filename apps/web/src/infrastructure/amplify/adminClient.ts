import type { AdminAccess, AdminApi } from "./api.ts";

/**
 * The one place the admin views get their backend. A build with the backend's outputs (CRV_AMPLIFY_OUTPUTS, inlined by
 * next.config.ts, as client.ts reads it) binds the deployed backend (adminAmplify.ts) for a session in the `admins`
 * group. The in-memory stub is bound only when the build asks for it with NEXT_PUBLIC_CRV_ADMIN_STUB, and it wins over
 * the outputs, so the screen tests never reach a deployment. A build with neither has no data and the views say so,
 * rather than showing sample rows as if they were real. Each binding is imported only inside its branch, so a build
 * without the stub does not carry its sample data.
 */
let current: AdminApi | undefined;

export function setAdminApi(api: AdminApi | undefined): void {
  current = api;
}

/** `admins` in the session's groups is an admin; any other session is not; no session is signed out. */
export const accessFor = (groups: readonly string[] | null): AdminAccess => {
  if (groups === null) return "signed-out";
  return groups.includes("admins") ? "ready" : "not-admin";
};

/** Called once before the views render: binds a backend if there is one this visitor may use, and says which case it is. */
export async function prepareAdminApi(): Promise<AdminAccess> {
  if (current) return "ready";
  if (process.env.NEXT_PUBLIC_CRV_ADMIN_STUB === "1") {
    const { createStubApi } = await import("./adminStub.ts");
    current = createStubApi();
    return "ready";
  }
  if (!process.env.CRV_AMPLIFY_OUTPUTS) return "no-backend";
  const [{ amplifyGraphql, sessionGroups }, { createAmplifyAdminApi }] = await Promise.all([
    import("./client.ts"),
    import("./adminAmplify.ts"),
  ]);
  // A session that cannot be read (a refresh the backend refused, say) is no session: the visitor signs in again.
  const access = accessFor(await sessionGroups().catch(() => null));
  if (access === "ready") current = createAmplifyAdminApi(amplifyGraphql());
  return access;
}

export function getAdminApi(): AdminApi {
  if (current) return current;
  throw new Error("The admin backend is not connected in this build.");
}
