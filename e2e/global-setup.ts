import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { build } from "../site/build.ts";
import { serveWeb } from "./serve-web.ts";

const root = join(import.meta.dirname, "..");

/** A Next export of apps/web with the given stubs, into apps/web/<dist>, beside the real out/. */
function buildWeb(dist: string, stubs: { door: boolean; admin: boolean }): string {
  execFileSync("pnpm", ["--filter", "@crv/web", "exec", "next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_CRV_STUB: stubs.door ? "1" : "",
      NEXT_PUBLIC_CRV_ADMIN_STUB: stubs.admin ? "1" : "",
      CRV_WEB_DIST: dist,
    },
  });
  return join(root, "apps", "web", dist);
}

/**
 * Build what the specs read. page.spec.ts reads the old page in e2e/.build. The door specs read the Next export with
 * the stub backend (NEXT_PUBLIC_CRV_STUB=1), built beside the real one into apps/web/.e2e-out and served on a free
 * port, which the specs find in CRV_WEB_URL. The admin views in it have no backend, which admin.spec.ts relies on.
 * admin-flows.spec.ts needs the opposite, the admin views over the in-memory stub, so a second export with
 * NEXT_PUBLIC_CRV_ADMIN_STUB=1 goes into apps/web/.e2e-admin-out and is served at CRV_ADMIN_URL.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  await build(join(import.meta.dirname, ".build"));
  const doorOut = buildWeb(".e2e-out", { door: true, admin: false });
  const adminOut = buildWeb(".e2e-admin-out", { door: true, admin: true });
  const door = await serveWeb(doorOut);
  const admin = await serveWeb(adminOut);
  process.env.CRV_WEB_URL = door.url;
  process.env.CRV_WEB_OUT = doorOut;
  process.env.CRV_ADMIN_URL = admin.url;
  return async () => {
    await Promise.all([door.server, admin.server].map((s) => new Promise((resolve) => s.close(resolve))));
  };
}
