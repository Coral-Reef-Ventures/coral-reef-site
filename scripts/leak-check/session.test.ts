import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { Exchange, Send } from "./http.ts";
import { type Aws, defaultInvitee as invitee, discoverBackend, enterWithTicket, setPassword } from "./session.ts";
import {
  claimSignature,
  ephemeral,
  g,
  k,
  modPow,
  N,
  padHex,
  passwordAuthenticationKey,
  srpSignIn,
  srpTimestamp,
} from "./srp.ts";

const backend = {
  userPoolId: "us-east-2_Pool1",
  clientId: "client",
  graphqlUrl: "https://api.test/graphql",
};

/** A fake AWS CLI: records each call, and the input file of any call that takes one, read before it is deleted. */
const fakeAws = (answer: (args: string[]) => { stdout?: string; fail?: string }) => {
  const calls: string[][] = [];
  const inputs: unknown[] = [];
  const aws: Aws = async (args) => {
    calls.push(args);
    const file = args[args.indexOf("--cli-input-json") + 1];
    if (args.includes("--cli-input-json") && file) {
      const path = file.replace("file://", "");
      inputs.push({ body: JSON.parse(readFileSync(path, "utf8")), mode: statSync(path).mode & 0o777 });
    }
    const result = answer(args);
    if (result.fail) throw new Error(`aws ${args.slice(0, 2).join(" ")}: ${result.fail}`);
    return result.stdout ?? "{}";
  };
  return { aws, calls, inputs };
};

describe("minting a session", () => {
  it("reads the backend from the CRV branch's stack outputs", async () => {
    const { aws, calls } = fakeAws((args) =>
      args[0] === "amplify"
        ? { stdout: JSON.stringify("arn:aws:cloudformation:us-east-2:1:stack/amplify-x-main-branch-y/1") }
        : {
            stdout: JSON.stringify([
              { OutputKey: "userPoolId", OutputValue: "us-east-2_Pool1" },
              { OutputKey: "webClientId", OutputValue: "client" },
              { OutputKey: "awsAppsyncApiEndpoint", OutputValue: "https://api.test/graphql" },
            ]),
          },
    );
    expect(await discoverBackend(aws)).toEqual(backend);
    expect(calls[0]).toEqual(
      expect.arrayContaining(["get-branch", "--app-id", "d1fw6blayytium", "--branch-name", "main"]),
    );
  });

  it("sets the existing invitee a fresh permanent password through a private file, and makes no other call", async () => {
    const { aws, calls, inputs } = fakeAws(() => ({ stdout: "" }));
    const first = await setPassword(aws, backend, invitee);
    const second = await setPassword(aws, backend, invitee);
    expect(calls.map((call) => call.slice(0, 2).join(" "))).toEqual([
      "cognito-idp admin-set-user-password",
      "cognito-idp admin-set-user-password",
    ]);
    expect(inputs[0]).toEqual({
      body: { UserPoolId: "us-east-2_Pool1", Username: invitee, Password: first, Permanent: true },
      mode: 0o600,
    });
    expect(first).not.toBe(second);
    expect(first).toMatch(/^Lc1!/);
    expect(invitee).toBe("crv-check@example.com");
    const missing = fakeAws(() => ({ fail: "UserNotFoundException" }));
    await expect(setPassword(missing.aws, backend, "nobody@example.com")).rejects.toThrow(/UserNotFoundException/);
  });

  it("makes no admin call to the door and creates or deletes no one: inviting is an admin's job", () => {
    const source = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
    for (const forbidden of ["lambda", "admin-create-user", "admin-delete-user", "eraseEmail", '"invite"']) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it("posts the ticket with its state cookie and keeps only the session cookie's value", async () => {
    const sent: Parameters<Send>[0][] = [];
    const answer =
      (exchange: Partial<Exchange>): Send =>
      async (input) => {
        sent.push(input);
        return { status: 303, headers: {}, body: Buffer.alloc(0), ...exchange };
      };
    const good = answer({
      headers: {
        location: "/",
        "set-cookie": [
          "__Host-crv_door=jws.value.sig; Max-Age=3600; Path=/; Secure; HttpOnly",
          "__Host-crv_door_state=; Max-Age=0",
        ],
      },
    });
    const cookie = await enterWithTicket(
      good,
      "driftline.app",
      { action: "https://driftline.app/_door", ticket: "t" },
      "s".repeat(43),
    );
    expect(cookie).toBe("jws.value.sig");
    expect(sent[0]).toMatchObject({
      host: "driftline.app",
      target: "/_door",
      method: "POST",
      body: "ticket=t&next=%2F",
    });
    expect(sent[0]?.headers?.Cookie).toBe(`__Host-crv_door_state=${"s".repeat(43)}`);
    await expect(
      enterWithTicket(good, "driftline.app", { action: "https://evil.test/_door", ticket: "t" }, "s"),
    ).rejects.toThrow(/another action/);
    const refused = answer({ headers: { location: "https://coralreefventures.com/?error=ticket" } });
    await expect(
      enterWithTicket(refused, "driftline.app", { action: "https://driftline.app/_door", ticket: "t" }, "s"),
    ).rejects.toThrow("driftline.app answered the ticket with 303, not a session");
  });
});

/**
 * USER_SRP_AUTH, checked against a server written from the protocol's own equations (RFC 5054 with Cognito's
 * derivations): the server's key comes from the verifier, the client's from the password, and they must agree.
 */
describe("Cognito's SRP", () => {
  const sha = (data: Buffer | string) => createHash("sha256").update(data).digest();
  const hexHash = (hex: string) => sha(Buffer.from(hex, "hex")).toString("hex").padStart(64, "0");
  const big = (hex: string) => BigInt(`0x${hex}`);

  const server = (poolName: string, userId: string, password: string) => {
    const salt = randomBytes(16).toString("hex");
    const inner = sha(`${poolName}${userId}:${password}`).toString("hex").padStart(64, "0");
    const x = big(hexHash(`${padHex(big(salt))}${inner}`));
    const v = modPow(g, x, N);
    const b = big(randomBytes(128).toString("hex")) % N;
    const B = (k * v + modPow(g, b, N)) % N;
    const keyFor = (A: bigint) => {
      const u = big(hexHash(`${padHex(A)}${padHex(B)}`));
      const S = modPow((A * modPow(v, u, N)) % N, b, N);
      const prk = createHmac("sha256", Buffer.from(padHex(u), "hex"))
        .update(Buffer.from(padHex(S), "hex"))
        .digest();
      return createHmac("sha256", prk)
        .update(Buffer.concat([Buffer.from("Caldera Derived Key"), Buffer.from([1])]))
        .digest()
        .subarray(0, 16);
    };
    return { salt, B, keyFor };
  };

  it("derives the key the server derives from the verifier", () => {
    const srv = server("Pool1", "user-id", "Lc1!secret");
    const { a, A } = ephemeral();
    const key = passwordAuthenticationKey({
      poolName: "Pool1",
      userId: "user-id",
      password: "Lc1!secret",
      a,
      A,
      B: srv.B,
      salt: srv.salt,
    });
    expect(key.equals(srv.keyFor(A))).toBe(true);
    const wrong = passwordAuthenticationKey({
      poolName: "Pool1",
      userId: "user-id",
      password: "other",
      a,
      A,
      B: srv.B,
      salt: srv.salt,
    });
    expect(wrong.equals(srv.keyFor(A))).toBe(false);
  });

  it("signs in through the two calls, answering the challenge with a signature the server can check", async () => {
    const srv = server("Pool1", "uuid-1", "Lc1!secret");
    let A = 0n;
    const now = new Date(Date.UTC(2026, 9, 5, 16, 4, 9));
    const result = await srpSignIn({
      region: "us-east-2",
      userPoolId: "us-east-2_Pool1",
      clientId: "client",
      username: invitee,
      password: "Lc1!secret",
      now: () => now,
      call: async (target, body) => {
        const request = body as Record<string, Record<string, string>>;
        if (target === "InitiateAuth") {
          A = big(request.AuthParameters?.SRP_A ?? "0");
          return {
            ChallengeName: "PASSWORD_VERIFIER",
            Session: "session",
            ChallengeParameters: {
              USER_ID_FOR_SRP: "uuid-1",
              SRP_B: srv.B.toString(16),
              SALT: srv.salt,
              SECRET_BLOCK: Buffer.from("block").toString("base64"),
            },
          };
        }
        const responses = request.ChallengeResponses ?? {};
        expect(responses.TIMESTAMP).toBe("Mon Oct 5 16:04:09 UTC 2026");
        const expected = claimSignature(
          srv.keyFor(A),
          "Pool1",
          "uuid-1",
          responses.PASSWORD_CLAIM_SECRET_BLOCK ?? "",
          responses.TIMESTAMP ?? "",
        );
        if (responses.PASSWORD_CLAIM_SIGNATURE !== expected) return { ChallengeName: "WRONG" };
        return { AuthenticationResult: { IdToken: "id", AccessToken: "access" } };
      },
    });
    expect(result).toEqual({ idToken: "id", accessToken: "access" });
  });

  it("pads hex as AWS's client does, and writes Cognito's timestamp with an unpadded day", () => {
    expect(padHex(0x7fn)).toBe("7f");
    expect(padHex(0x80n)).toBe("0080");
    expect(padHex(0xabcn)).toBe("0abc");
    expect(srpTimestamp(new Date(Date.UTC(2026, 0, 9, 3, 5, 7)))).toBe("Fri Jan 9 03:05:07 UTC 2026");
  });

  it("uses RFC 3526's 3072-bit prime", () => {
    expect(N.toString(2).length).toBe(3072);
    expect(N % 2n ** 64n).toBe(2n ** 64n - 1n);
    expect(N >> 3008n).toBe(2n ** 64n - 1n);
  });
});
