import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { sessionCookie } from "./check.ts";
import { header, type Send, setCookies } from "./http.ts";
import { srpSignIn } from "./srp.ts";

/**
 * A session for the leak check, minted the way an invitee gets one (plan Phase 3 "CRV side"; §5's password path):
 *
 * 1. Clear what an earlier run may have left: `eraseEmail` on the check's own address, then the Cognito user.
 * 2. `invite` that address to the sites being checked, through crv-access, invoked directly with IAM as an admin of
 *    the door (the role's `lambda:InvokeFunction` is what lets it; no person is signed in).
 * 3. AdminCreateUser with that address (pre sign-up admits it because the invitation is pending) and a random
 *    permanent password, which never leaves this process but in a file only this user can read, deleted at once.
 * 4. Sign in with USER_SRP_AUTH, so pre token generation binds the invitation like any first sign-in.
 * 5. `issueSiteTicket` through the API with that user's token, for each gated host, and post it to the host's
 *    `/_door` with the matching state cookie: the gate's answer sets the session cookie the check then uses.
 * 6. Afterwards, step 1 again. The erasure leaves one `people.deleted` Activity row per run, which holds ids only.
 *
 * Nothing here prints a password, a token, a ticket or a cookie: errors name the step and the service's error code.
 */

export const invitee = "door-leak-check@coralreefventures.com";
export const crvAppId = "d1fw6blayytium";
export const region = "us-east-2";

export type Aws = (args: string[]) => Promise<string>;

/**
 * The AWS CLI, always in us-east-2, with `AWS_PROFILE` when one is set (by hand) and the role's environment
 * credentials when not (CI). `AWS_CLI` names the binary; it is `aws` by default.
 */
export const awsCli =
  (binary = process.env.AWS_CLI || "aws"): Aws =>
  async (args) => {
    try {
      const { stdout } = await promisify(execFile)(binary, [...args, "--region", region, "--output", "json"], {
        maxBuffer: 16 * 1024 * 1024,
      });
      return stdout;
    } catch (error) {
      const stderr = String((error as { stderr?: unknown }).stderr ?? "");
      const code = /\(([A-Za-z]+(?:Exception|Error|Denied|Fault)?)\)/.exec(stderr)?.[1] ?? "failed";
      throw new Error(`aws ${args.slice(0, 2).join(" ")}: ${code}`);
    }
  };

export type Backend = { userPoolId: string; clientId: string; graphqlUrl: string; accessFunction: string };

/** The CRV app's backend, read from its branch's stack outputs, so a redeployed backend needs no change here. */
export const discoverBackend = async (aws: Aws): Promise<Backend> => {
  const stack = JSON.parse(
    await aws([
      "amplify",
      "get-branch",
      "--app-id",
      crvAppId,
      "--branch-name",
      "main",
      "--query",
      "branch.backend.stackArn",
    ]),
  ) as string;
  const outputs = JSON.parse(
    await aws(["cloudformation", "describe-stacks", "--stack-name", stack, "--query", "Stacks[0].Outputs"]),
  ) as { OutputKey: string; OutputValue: string }[];
  const output = (key: string) => {
    const value = outputs.find((entry) => entry.OutputKey === key)?.OutputValue;
    if (!value) throw new Error(`the CRV backend's stack has no ${key} output`);
    return value;
  };
  const functions = JSON.parse(output("definedFunctions")) as string[];
  const accessFunction = functions.find((name) => /crvaccesslambda/i.test(name));
  if (!accessFunction) throw new Error("the CRV backend's stack names no crv-access function");
  return {
    userPoolId: output("userPoolId"),
    clientId: output("webClientId"),
    graphqlUrl: output("awsAppsyncApiEndpoint"),
    accessFunction,
  };
};

/** Runs a file-taking command in a directory only this process can read, then removes it, whatever happened. */
const withPrivateDir = async <T>(work: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), "crv-leak-check-"));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/**
 * One crv-access operation, invoked directly as an admin of the door. crv-access trusts the AppSync identity it is
 * handed (`functions/access/caller.ts`); the one way to hand it this one is IAM permission to invoke the function. The
 * identity's sub is not a Cognito sub, so the Activity rows it writes name `user:leak-check` as their actor.
 */
export const invokeAccess = async (aws: Aws, backend: Backend, fieldName: string, args: object): Promise<unknown> =>
  withPrivateDir(async (dir) => {
    const payload = join(dir, "payload.json");
    const out = join(dir, "out.json");
    await writeFile(
      payload,
      JSON.stringify({
        fieldName,
        arguments: args,
        identity: { sub: "leak-check", username: "leak-check", groups: ["admins"], claims: {} },
      }),
      { mode: 0o600 },
    );
    const meta = JSON.parse(
      await aws([
        "lambda",
        "invoke",
        "--function-name",
        backend.accessFunction,
        "--cli-binary-format",
        "raw-in-base64-out",
        "--payload",
        `file://${payload}`,
        out,
      ]),
    ) as { FunctionError?: string };
    const result = JSON.parse(await readFile(out, "utf8")) as { errorMessage?: string };
    if (meta.FunctionError)
      throw new Error(`crv-access refused ${fieldName}: ${result.errorMessage ?? meta.FunctionError}`);
    return result;
  });

const ignoreMissingUser = (error: unknown) => {
  if (!(error instanceof Error && /UserNotFoundException/.test(error.message))) throw error;
};

/** Removes the check's invitee: its invitation, person and grants through crv-access, then its Cognito user. */
export const clearInvitee = async (aws: Aws, backend: Backend): Promise<void> => {
  await invokeAccess(aws, backend, "eraseEmail", { email: invitee });
  await aws(["cognito-idp", "admin-delete-user", "--user-pool-id", backend.userPoolId, "--username", invitee]).catch(
    ignoreMissingUser,
  );
};

/** A password Cognito's default policy accepts: upper, lower, digit and symbol, 40 characters. */
const password = () => `Lc1!${randomBytes(27).toString("base64url")}`;

const ticketMutation = `mutation LeakCheckTicket($site: String!, $next: String!, $state: String!, $host: String!) {
  issueSiteTicket(site: $site, next: $next, state: $state, host: $host) { action ticket }
}`;

/** `issueSiteTicket` through the API, as the signed-in invitee. */
const issueTicket = async (
  backend: Backend,
  idToken: string,
  variables: { site: string; next: string; state: string; host: string },
): Promise<{ action: string; ticket: string }> => {
  const response = await fetch(backend.graphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: idToken },
    body: JSON.stringify({ query: ticketMutation, variables }),
  });
  const answer = (await response.json()) as {
    data?: { issueSiteTicket?: { action?: string; ticket?: string } };
    errors?: { message?: string }[];
  };
  const ticket = answer.data?.issueSiteTicket;
  if (!ticket?.action || !ticket.ticket) {
    throw new Error(`issueSiteTicket for ${variables.host} refused: ${answer.errors?.[0]?.message ?? response.status}`);
  }
  return { action: ticket.action, ticket: ticket.ticket };
};

/**
 * Posts a ticket to the gate as the door's form would, with the state cookie the gate set when it sent the visitor
 * away (made here, since the check never went there), and returns the session cookie's value from the gate's 303.
 */
export const enterWithTicket = async (
  send: Send,
  host: string,
  ticket: { action: string; ticket: string },
  state: string,
): Promise<string> => {
  if (ticket.action !== `https://${host}/_door`) throw new Error(`the ticket for ${host} names another action`);
  const answer = await send({
    host,
    target: "/_door",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `__Host-crv_door_state=${state}`,
      Origin: "https://coralreefventures.com",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Dest": "document",
    },
    body: new URLSearchParams({ ticket: ticket.ticket, next: "/" }).toString(),
  });
  const cookie = setCookies(answer)
    .map((line) => line.split(";")[0] ?? "")
    .find((pair) => pair.startsWith(`${sessionCookie}=`));
  if (answer.status !== 303 || header(answer, "location") !== "/" || !cookie) {
    throw new Error(`${host} answered the ticket with ${answer.status}, not a session`);
  }
  return cookie.slice(sessionCookie.length + 1);
};

/**
 * Mints a session cookie for each gated host, as the check's temporary invitee. Returns the cookies by host and the
 * cleanup to run afterwards, which the caller runs whatever happens.
 */
export const mintSessions = async (input: {
  aws: Aws;
  send: Send;
  hosts: { site: string; host: string }[];
}): Promise<{ cookies: Map<string, string>; cleanup: () => Promise<void> }> => {
  const { aws, send } = input;
  const backend = await discoverBackend(aws);
  const cleanup = () => clearInvitee(aws, backend);
  await cleanup();
  try {
    const sites = [...new Set(input.hosts.map((entry) => entry.site))];
    await invokeAccess(aws, backend, "invite", { email: invitee, sites, note: "The leak check's temporary invitee." });
    await aws([
      "cognito-idp",
      "admin-create-user",
      "--user-pool-id",
      backend.userPoolId,
      "--username",
      invitee,
      "--user-attributes",
      `Name=email,Value=${invitee}`,
      "Name=email_verified,Value=true",
      "--message-action",
      "SUPPRESS",
    ]);
    const secret = password();
    await withPrivateDir(async (dir) => {
      const input = join(dir, "password.json");
      await writeFile(
        input,
        JSON.stringify({ UserPoolId: backend.userPoolId, Username: invitee, Password: secret, Permanent: true }),
        { mode: 0o600 },
      );
      await aws(["cognito-idp", "admin-set-user-password", "--cli-input-json", `file://${input}`]);
    });
    const { idToken } = await srpSignIn({
      region,
      userPoolId: backend.userPoolId,
      clientId: backend.clientId,
      username: invitee,
      password: secret,
    });
    const cookies = new Map<string, string>();
    for (const { site, host } of input.hosts) {
      const state = randomBytes(32).toString("base64url");
      const ticket = await issueTicket(backend, idToken, { site, next: "/", state, host });
      cookies.set(host, await enterWithTicket(send, host, ticket, state));
    }
    return { cookies, cleanup };
  } catch (error) {
    await cleanup().catch(() => undefined);
    throw error;
  }
};
