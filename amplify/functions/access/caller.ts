/**
 * Who called an operation, from AppSync's `identity`. Amplify enables IAM on every API, and the policy `allow.resource`
 * attaches covers every query and mutation, so crv-access decides each operation's callers itself (plan §2.2) rather
 * than trusting that only the intended role can reach it.
 */
export type Caller =
  | { kind: "user"; sub: string; username: string; email?: string; groups: string[] }
  | { kind: "role"; role: string }
  | { kind: "none" };

type Identity = {
  sub?: string;
  username?: string;
  claims?: Record<string, unknown>;
  groups?: string[] | null;
  userArn?: string;
  cognitoIdentityPoolId?: string | null;
};

/** `arn:aws:sts::<account>:assumed-role/<role>/<session>`, the ARN a Lambda function's credentials sign with. */
const assumedRole = /^arn:aws:sts::\d{12}:assumed-role\/([\w+=,.@-]{1,64})\/[^/]+$/;

export const callerOf = (identity: unknown): Caller => {
  if (typeof identity !== "object" || identity === null) return { kind: "none" };
  const id = identity as Identity;
  if (typeof id.sub === "string" && id.sub && typeof id.username === "string") {
    const email = id.claims?.email;
    const groups = Array.isArray(id.groups) ? id.groups.filter((g): g is string => typeof g === "string") : [];
    return {
      kind: "user",
      sub: id.sub,
      username: id.username,
      groups,
      ...(typeof email === "string" ? { email: email.toLowerCase() } : {}),
    };
  }
  // A guest comes through the identity pool's role: that is an identity, but not one any operation here accepts.
  if (typeof id.userArn === "string" && !id.cognitoIdentityPoolId) {
    const role = assumedRole.exec(id.userArn)?.[1];
    if (role) return { kind: "role", role };
  }
  return { kind: "none" };
};

export const isAdmin = (caller: Caller): boolean => caller.kind === "user" && caller.groups.includes("admins");
