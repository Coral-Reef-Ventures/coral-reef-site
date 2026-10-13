/**
 * Deploys the app to one environment (apps/web/hosting/environments.ts): the backend with `ampx pipeline-deploy`,
 * then the static export with the door's public key, uploaded to the environment's Amplify app. GitHub Actions runs
 * it (.github/workflows/deploy.yml) with that environment's role; it refuses any other account.
 *
 *   node scripts/deploy.ts <dev|staging|prod>
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  backendSettings,
  environments,
  isEnvironmentName,
  renderHeaders,
  siteHosts,
} from "../apps/web/hosting/environments.ts";

const name = process.argv[2] ?? "";
if (!isEnvironmentName(name)) throw new Error(`Usage: node scripts/deploy.ts <dev|staging|prod>, not "${name}"`);
const env = environments[name];
const root = path.join(import.meta.dirname, "..");
const web = path.join(root, "apps", "web");
const scratch = mkdtempSync(path.join(tmpdir(), "crv-deploy-"));

const run = (command: string, args: string[], extra: Record<string, string> = {}) =>
  execFileSync(command, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...extra } });
const aws = (args: string[], input?: string): string =>
  execFileSync("aws", [...args, "--region", "us-east-2"], { cwd: root, encoding: "utf8", input });

const account = aws(["sts", "get-caller-identity", "--query", "Account", "--output", "text"]).trim();
if (account !== env.account) throw new Error(`${name} is account ${env.account}, but these credentials are ${account}`);

console.log(`Deploying ${name} (${env.appId}) at ${process.env.GITHUB_SHA ?? "the working tree"}`);
run(
  "pnpm",
  ["exec", "ampx", "pipeline-deploy", "--branch", "main", "--app-id", env.appId, "--outputs-out-dir", "apps/web"],
  backendSettings(env),
);
run("pnpm", ["--filter", "@crv/web", "build"], { CRV_DOOR_SITE_HOSTS: siteHosts(env) });

// The door's public key, for the locked product sites' builds (apps/web/hosting/README.md, "What the build does").
const outputs = JSON.parse(readFileSync(path.join(web, "amplify_outputs.json"), "utf8"));
const publicKey = aws([
  "kms",
  "get-public-key",
  "--key-id",
  outputs.custom.doorKeyArn,
  "--query",
  "PublicKey",
  "--output",
  "text",
]);
execFileSync("node", [path.join(web, "scripts", "door-jwks.mjs")], {
  input: publicKey,
  stdio: ["pipe", "inherit", "inherit"],
  env: { ...process.env, DOOR_KID: outputs.custom.doorKid },
});

const headers = path.join(scratch, "custom-headers.yml");
writeFileSync(headers, renderHeaders(readFileSync(path.join(web, "hosting", "custom-headers.yml"), "utf8"), env));
aws([
  "amplify",
  "update-app",
  "--app-id",
  env.appId,
  "--platform",
  "WEB",
  "--custom-headers",
  `file://${headers}`,
  "--custom-rules",
  `file://${path.join(web, "hosting", "custom-rules.json")}`,
  "--cache-config",
  "type=AMPLIFY_MANAGED_NO_COOKIES",
]);

const zip = path.join(scratch, "out.zip");
execFileSync("zip", ["-q", "-r", zip, "."], { cwd: path.join(web, "out"), stdio: "inherit" });
const created = JSON.parse(
  aws(["amplify", "create-deployment", "--app-id", env.appId, "--branch-name", "main", "--output", "json"]),
);
const upload = await fetch(created.zipUploadUrl, { method: "PUT", body: readFileSync(zip) });
if (!upload.ok) throw new Error(`The upload failed: ${upload.status}`);
aws(["amplify", "start-deployment", "--app-id", env.appId, "--branch-name", "main", "--job-id", created.jobId]);

for (;;) {
  const status = aws([
    "amplify",
    "get-job",
    "--app-id",
    env.appId,
    "--branch-name",
    "main",
    "--job-id",
    created.jobId,
    "--query",
    "job.summary.status",
    "--output",
    "text",
  ]).trim();
  if (status === "SUCCEED") break;
  if (["FAILED", "CANCELLED"].includes(status))
    throw new Error(`Amplify's deployment ${created.jobId} ended ${status}`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
console.log(`${name} serves ${process.env.GITHUB_SHA ?? "the working tree"} at ${env.origin}`);
