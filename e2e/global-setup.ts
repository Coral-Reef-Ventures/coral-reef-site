import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { build } from "../site/build.ts";
import { serveWeb } from "./serve-web.ts";

const root = join(import.meta.dirname, "..");

/**
 * Build what the specs read. page.spec.ts reads the old page in e2e/.build. The door specs read the Next export with
 * the stub backend (NEXT_PUBLIC_CRV_STUB=1), built beside the real one into apps/web/.e2e-out and served on a free
 * port, which the specs find in CRV_WEB_URL.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  await build(join(import.meta.dirname, ".build"));
  execFileSync("pnpm", ["--filter", "@crv/web", "exec", "next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_CRV_STUB: "1", CRV_WEB_DIST: ".e2e-out" },
  });
  const { server, url } = await serveWeb(join(root, "apps", "web", ".e2e-out"));
  process.env.CRV_WEB_URL = url;
  process.env.CRV_WEB_OUT = join(root, "apps", "web", ".e2e-out");
  return async () => {
    await new Promise((resolve) => server.close(resolve));
  };
}
