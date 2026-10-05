import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    /** Where the backend was synthesized as a sandbox and as the branch: `<dir>/sandbox`, `<dir>/branch`. */
    synthDir: string;
  }
}

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

/** The settings each synth runs with. The branch's are the Amplify app's (apps/web/hosting/README.md). */
const settings = {
  sandbox: { CRV_AUTH_DOMAIN_PREFIX: "crv-door-sandbox" },
  branch: {
    CRV_AUTH_DOMAIN_PREFIX: "crv-door",
    CRV_AUTH_CALLBACK_URLS:
      "https://main.d1example.amplifyapp.com/signed-in/,https://coralreefventures.com/signed-in/,https://main.d1example.amplifyapp.com/signout/done/,https://coralreefventures.com/signout/done/",
    CRV_ADMIN_EMAILS: "gary@coralreefventures.com",
    CRV_ADMIN_ORIGIN: "https://main.d1example.amplifyapp.com",
    CRV_BUILD_ROLE_NAME: "crv-amplify-backend-deploy",
  },
} as const;

/** Synthesizes the backend the way `ampx` does before a deploy, into `outDir`, reading no account (Streamlane's way). */
const synth = async (type: keyof typeof settings, outDir: string) => {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    CDK_OUTDIR: outDir,
    CDK_CONTEXT_JSON: JSON.stringify({
      "amplify-backend-namespace": "coralreefsite",
      "amplify-backend-name": type === "branch" ? "main" : "synth",
      "amplify-backend-type": type,
    }),
    AWS_REGION: "us-east-2",
    CDK_DEFAULT_REGION: "us-east-2",
    CDK_DEFAULT_ACCOUNT: "111111111111",
    ...settings[type],
  };
  await promisify(execFile)(process.execPath, [join(repositoryRoot, "amplify/test/synth-backend.ts")], {
    cwd: repositoryRoot,
    env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
};

export default async function setup(project: TestProject) {
  const dir = mkdtempSync(join(tmpdir(), "crv-synth-"));
  await Promise.all([synth("sandbox", join(dir, "sandbox")), synth("branch", join(dir, "branch"))]);
  project.provide("synthDir", dir);
  return () => rmSync(dir, { recursive: true, force: true });
}
