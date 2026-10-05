import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { sessionCookie } from "./check.ts";
import { header, type Send, setCookies } from "./http.ts";
import { srpSignIn } from "./srp.ts";

/**
 * A session for the leak check, minted the way an invitee gets one (plan Phase 3 "CRV side"), as an invitee who
 * already exists: someone an admin invited from /admin/, whose Cognito user is in the pool. The check never invites,
 * erases or creates anyone. Inviting is an admin's job, done by a person signed in to /admin/; the check has no admin
 * session and makes no admin call to the door (go-ahead §17c).
 *
 * 1. AdminSetUserPassword with a fresh random permanent password, which never leaves this process but in a file only
 *    this user can read, deleted at once. It is never printed or kept, so every run sets a new one.
 * 2. Sign in with USER_SRP_AUTH, the app client's one password flow, so pre token generation binds the invitation like
 *    any sign-in.
 * 3. `issueSiteTicket` through the API with that user's token, for each gated host, and post it to the host's
 *    `/_door` with the matching state cookie: the gate's answer sets the session cookie the check then uses.
 *
 * The invitee is `crv-check@example.com` by default (invited to both sites, go-ahead §17b), or `CRV_LEAK_CHECK_INVITEE`.
 * It is left in place afterwards: revoking its invitation and deleting its user are an admin's, from /admin/.
 *
 * Nothing here prints a password, a token, a ticket or a cookie: errors name the step and the service's error code.
 */

export const defaultInvitee = "crv-check@example.com";
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

export type Backend = { userPoolId: string; clientId: string; graphqlUrl: string };

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
  return {
    userPoolId: output("userPoolId"),
    clientId: output("webClientId"),
    graphqlUrl: output("awsAppsyncApiEndpoint"),
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

/** Gives the invitee a fresh permanent password, through a file only this process can read, and returns it. */
export const setPassword = async (aws: Aws, backend: Backend, username: string): Promise<string> => {
  const secret = password();
  await withPrivateDir(async (dir) => {
    const input = join(dir, "password.json");
    await writeFile(
      input,
      JSON.stringify({ UserPoolId: backend.userPoolId, Username: username, Password: secret, Permanent: true }),
      { mode: 0o600 },
    );
    await aws(["cognito-idp", "admin-set-user-password", "--cli-input-json", `file://${input}`]);
  });
  return secret;
};

/**
 * Mints a session cookie for each gated host, as an existing invitee. Returns the cookies by host. A user that does not
 * exist, or whose invitation does not cover a host's site, fails here with the service's code: inviting it is an
 * admin's job, not the check's.
 */
export const mintSessions = async (input: {
  aws: Aws;
  send: Send;
  hosts: { site: string; host: string }[];
  invitee?: string;
}): Promise<{ cookies: Map<string, string> }> => {
  const { aws, send } = input;
  const invitee = input.invitee || defaultInvitee;
  const backend = await discoverBackend(aws);
  const secret = await setPassword(aws, backend, invitee);
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
  return { cookies };
};
