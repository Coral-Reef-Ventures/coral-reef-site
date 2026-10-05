import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// The backend's outputs, which the hosting build writes beside this file before it builds the site
// (`ampx pipeline-deploy --outputs-out-dir apps/web`). Without them the door still builds and renders; the form and
// the sign-in then fail visibly instead of reaching anything.
const outputsPath = join(import.meta.dirname, "amplify_outputs.json");
const outputs = existsSync(outputsPath) ? readFileSync(outputsPath, "utf8") : "";

// A static export: Amplify Hosting serves out/ as a WEB app. `trailingSlash` gives every page a directory, so a
// host with no rewrite rules still answers /privacy/.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // The screen tests build the door beside the real build, with the stub backend, without touching out/.
  ...(process.env.CRV_WEB_DIST ? { distDir: process.env.CRV_WEB_DIST } : {}),
  // NEXT_PUBLIC_CRV_ADMIN_STUB is always defined, so a build without the admin stub folds that branch away and ships
  // none of its sample data (adminClient.ts).
  env: {
    CRV_AMPLIFY_OUTPUTS: outputs,
    CRV_STUB: process.env.NEXT_PUBLIC_CRV_STUB === "1" ? "1" : "",
    NEXT_PUBLIC_CRV_ADMIN_STUB: process.env.NEXT_PUBLIC_CRV_ADMIN_STUB === "1" ? "1" : "",
  },
  transpilePackages: [
    "@crv/brand",
    "@coralreefventures/site",
    "@coralreefventures/theme",
    "@coralreefventures/contact",
  ],
};

export default nextConfig;
