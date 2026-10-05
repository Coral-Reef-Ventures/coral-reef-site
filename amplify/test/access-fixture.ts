import { generateKeyPairSync, sign } from "node:crypto";

import { vi } from "vitest";

import { doorSites } from "../areas/access/sites.ts";
import { type AppSyncEvent, createAccess } from "../functions/access/access.ts";
import type { AccessConfig, Deps, Directory } from "../functions/access/context.ts";
import { ulid } from "../functions/shared/ids.ts";
import { modelKeys } from "../functions/shared/models.ts";
import { type MemoryStore, memoryStore } from "./memory-store.ts";

/** The door key, as KMS would hold it: signing returns DER, exactly as KMS's Sign does. */
export const doorKeys = generateKeyPairSync("ec", { namedCurve: "P-256" });

export const roles = { preSignUp: "PreSignUpRole", preTokenGeneration: "PreTokenRole", retention: "RetentionRole" };

export type Fixture = {
  store: MemoryStore;
  directory: { [K in keyof Directory]: ReturnType<typeof vi.fn> } & { emails: Map<string, string> };
  deps: Deps;
  /** Moves the clock. */
  at(iso: string): void;
  call(field: string, args: Record<string, unknown>, identity: unknown): Promise<unknown>;
};

export const fixture = (config: Partial<AccessConfig> = {}): Fixture => {
  const store = memoryStore(modelKeys);
  const emails = new Map<string, string>();
  const directory = {
    emails,
    emailOf: vi.fn(async (username: string) => emails.get(username)),
    signOut: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
    enable: vi.fn(async () => {}),
    addToAdmins: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
  let now = new Date("2026-10-05T12:00:00.000Z");
  let tick = 0;
  const deps: Deps = {
    store,
    directory,
    sign: async (message) => new Uint8Array(sign("sha256", message, { key: doorKeys.privateKey, dsaEncoding: "der" })),
    config: {
      issuer: "https://coralreefventures.com",
      kid: "11111111-2222-3333-4444-555555555555",
      adminEmails: ["gary@coralreefventures.com"],
      sites: doorSites(""),
      doorOrigin: "https://main.d1example.amplifyapp.com",
      roles,
      ...config,
    },
    now: () => now,
    id: () => ulid(now.getTime(), new Uint8Array(10).fill(tick++ % 256)),
  };
  const handler = createAccess(deps);
  return {
    store,
    directory,
    deps,
    at(iso) {
      now = new Date(iso);
    },
    call: (field, args, identity) => handler({ info: { fieldName: field }, arguments: args, identity } as AppSyncEvent),
  };
};

/** AppSync's identity for a user-pool caller. `email` is in the token's claims only when given. */
export const userIdentity = (sub: string, options: { email?: string; groups?: string[]; username?: string } = {}) => ({
  sub,
  username: options.username ?? `Google_${sub}`,
  issuer: "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_x",
  claims: options.email ? { email: options.email } : {},
  groups: options.groups ?? null,
  sourceIp: ["203.0.113.9"],
});

export const adminIdentity = (sub = "admin-sub") => userIdentity(sub, { groups: ["admins"] });

/** AppSync's identity for an IAM caller: a Lambda function's assumed role. */
export const roleIdentity = (role: string) => ({
  accountId: "123456789012",
  userArn: `arn:aws:sts::123456789012:assumed-role/${role}/crv-function`,
  cognitoIdentityPoolId: null,
  sourceIp: ["10.0.0.1"],
});

/** AppSync's identity for a guest: the identity pool's unauthenticated role. */
export const guestIdentity = () => ({
  accountId: "123456789012",
  userArn: "arn:aws:sts::123456789012:assumed-role/unauthRole/CognitoIdentityCredentials",
  cognitoIdentityPoolId: "us-east-2:pool",
  cognitoIdentityAuthType: "unauthenticated",
  sourceIp: ["203.0.113.9"],
});

/** Invites `email` as an admin and binds it to `sub` through admitSignIn, as a first sign-in does. */
export const invitedAndBound = async (
  f: Fixture,
  email: string,
  sub: string,
  sites: string[] = ["streamlane", "driftline"],
) => {
  await f.call("invite", { email, sites }, adminIdentity());
  const result = await f.call(
    "admitSignIn",
    { userName: `Google_${sub}`, sub, googleSub: `g-${sub}`, email },
    roleIdentity(roles.preTokenGeneration),
  );
  f.directory.emails.set(`Google_${sub}`, email);
  return result;
};
