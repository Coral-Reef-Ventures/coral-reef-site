import process from "node:process";

import {
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { KMSClient, SignCommand } from "@aws-sdk/client-kms";

import { doorSites } from "../../areas/access/sites.ts";
import { parseAdminEmails } from "../../auth/settings.ts";
import { dynamoStore } from "../shared/dynamo-store.ts";
import { ulid } from "../shared/ids.ts";
import { tableEnvironment } from "../shared/tables.ts";
import { createAccess } from "./access.ts";
import type { Directory } from "./context.ts";

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const cognito = new CognitoIdentityProviderClient({});
const kms = new KMSClient({});
const pool = () => env("USER_POOL_ID");

/** A user that is already gone needs nothing more done to it. */
const unlessGone = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof Error && error.name === "UserNotFoundException")) throw error;
  }
};

const directory: Directory = {
  async emailOf(username) {
    const user = await cognito.send(new AdminGetUserCommand({ UserPoolId: pool(), Username: username }));
    return user.UserAttributes?.find((attribute) => attribute.Name === "email")?.Value;
  },
  signOut: (username) =>
    unlessGone(() => cognito.send(new AdminUserGlobalSignOutCommand({ UserPoolId: pool(), Username: username }))),
  disable: (username) =>
    unlessGone(() => cognito.send(new AdminDisableUserCommand({ UserPoolId: pool(), Username: username }))),
  enable: (username) =>
    unlessGone(() => cognito.send(new AdminEnableUserCommand({ UserPoolId: pool(), Username: username }))),
  addToAdmins: async (username) => {
    await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: pool(), Username: username, GroupName: "admins" }));
  },
  removeFromAdmins: (username) =>
    unlessGone(() =>
      cognito.send(
        new AdminRemoveUserFromGroupCommand({ UserPoolId: pool(), Username: username, GroupName: "admins" }),
      ),
    ),
  remove: (username) =>
    unlessGone(() => cognito.send(new AdminDeleteUserCommand({ UserPoolId: pool(), Username: username }))),
};

export const handler = createAccess({
  store: dynamoStore(tableEnvironment(process.env)),
  directory,
  async sign(message) {
    const result = await kms.send(
      new SignCommand({
        KeyId: env("DOOR_KEY_ID"),
        Message: message,
        MessageType: "RAW",
        SigningAlgorithm: "ECDSA_SHA_256",
      }),
    );
    if (!result.Signature) throw new Error("KMS returned no signature");
    return result.Signature;
  },
  config: {
    issuer: "https://coralreefventures.com",
    kid: process.env.DOOR_KEY_ID ?? "",
    adminEmails: parseAdminEmails(process.env.CRV_ADMIN_EMAILS ?? ""),
    sites: doorSites(process.env.CRV_DOOR_TEST_HOSTS),
    doorOrigin: process.env.CRV_ADMIN_ORIGIN ?? "https://coralreefventures.com",
    roles: {
      preSignUp: process.env.PRE_SIGN_UP_ROLE ?? "",
      preTokenGeneration: process.env.PRE_TOKEN_GENERATION_ROLE ?? "",
      retention: process.env.RETENTION_ROLE ?? "",
    },
  },
  now: () => new Date(),
  id: () => ulid(),
});
