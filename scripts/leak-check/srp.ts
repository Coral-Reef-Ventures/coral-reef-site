import { createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Cognito's USER_SRP_AUTH, the one password flow the door's app client allows (ALLOW_USER_SRP_AUTH; there is no
 * ALLOW_ADMIN_USER_PASSWORD_AUTH and the door shows no password form). The leak check signs its temporary invitee in
 * with it, so the user goes through pre token generation like any invitee: that is what binds the invitation.
 *
 * Written against node:crypto alone, so the check needs no SDK: InitiateAuth and RespondToAuthChallenge are public
 * Cognito calls that take no AWS signature. The arithmetic and its byte encodings follow AWS's own client
 * (amazon-cognito-identity-js, AuthenticationHelper): the RFC 3526 3072-bit group, SHA-256 over hex strings padded to
 * a positive two's-complement form, and an HKDF-derived key that signs the server's secret block.
 */

/** RFC 3526's 3072-bit MODP prime, checked against its defining formula when this file was written. */
export const N = BigInt(
  "0x" +
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
    "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F" +
    "83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B" +
    "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA0510" +
    "15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7" +
    "ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200C" +
    "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF",
);
export const g = 2n;

/** b^e mod m, for non-negative values. */
export const modPow = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
  let result = 1n;
  let b = ((base % modulus) + modulus) % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
};

/** Hex of a non-negative value, even length, with a leading 00 when the top bit is set (AWS's padHex). */
export const padHex = (value: bigint): string => {
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  if (/^[89a-f]/i.test(hex)) hex = `00${hex}`;
  return hex;
};

const sha256 = (data: Buffer | string): Buffer => createHash("sha256").update(data).digest();
/** SHA-256 of the bytes a hex string spells, as a 64-digit hex string. */
const hexHash = (hex: string): string => sha256(Buffer.from(hex, "hex")).toString("hex").padStart(64, "0");
const toBigInt = (hex: string): bigint => BigInt(`0x${hex}`);

export const k = toBigInt(hexHash(`${padHex(N)}${padHex(g)}`));

/** The client's ephemeral pair: a secret `a` and the public `A` sent as SRP_A. */
export const ephemeral = (random: Buffer = randomBytes(128)): { a: bigint; A: bigint } => {
  const a = toBigInt(random.toString("hex")) % N;
  const A = modPow(g, a, N);
  if (A % N === 0n) throw new Error("SRP: A is zero modulo N");
  return { a, A };
};

/** The 16-byte key both sides derive (AWS's getPasswordAuthenticationKey). */
export const passwordAuthenticationKey = (input: {
  poolName: string;
  userId: string;
  password: string;
  a: bigint;
  A: bigint;
  B: bigint;
  salt: string;
}): Buffer => {
  const { poolName, userId, password, a, A, B, salt } = input;
  if (B % N === 0n) throw new Error("SRP: B is zero modulo N");
  const u = toBigInt(hexHash(`${padHex(A)}${padHex(B)}`));
  if (u === 0n) throw new Error("SRP: u is zero");
  const usernamePasswordHash = sha256(`${poolName}${userId}:${password}`).toString("hex").padStart(64, "0");
  const x = toBigInt(hexHash(`${padHex(toBigInt(salt))}${usernamePasswordHash}`));
  const base = (((B - k * modPow(g, x, N)) % N) + N) % N;
  const S = modPow(base, a + u * x, N);
  const prk = createHmac("sha256", Buffer.from(padHex(u), "hex"))
    .update(Buffer.from(padHex(S), "hex"))
    .digest();
  return createHmac("sha256", prk)
    .update(Buffer.concat([Buffer.from("Caldera Derived Key", "utf8"), Buffer.from([1])]))
    .digest()
    .subarray(0, 16);
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

/** Cognito's TIMESTAMP: "Mon Oct 5 16:20:01 UTC 2026", the day of the month unpadded. */
export const srpTimestamp = (now: Date): string =>
  `${weekdays[now.getUTCDay()]} ${months[now.getUTCMonth()]} ${now.getUTCDate()} ` +
  `${two(now.getUTCHours())}:${two(now.getUTCMinutes())}:${two(now.getUTCSeconds())} UTC ${now.getUTCFullYear()}`;

/** PASSWORD_CLAIM_SIGNATURE: the derived key's HMAC over the pool, the user, the secret block and the timestamp. */
export const claimSignature = (key: Buffer, poolName: string, userId: string, secretBlock: string, timestamp: string) =>
  createHmac("sha256", key)
    .update(
      Buffer.concat([
        Buffer.from(poolName, "utf8"),
        Buffer.from(userId, "utf8"),
        Buffer.from(secretBlock, "base64"),
        Buffer.from(timestamp, "utf8"),
      ]),
    )
    .digest("base64");

type Call = (target: string, body: object) => Promise<Record<string, unknown>>;

/** A Cognito call over plain HTTPS: these two take no AWS signature. Its error carries Cognito's type, not the body. */
const cognitoCall =
  (region: string): Call =>
  async (target, body) => {
    const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(body),
    });
    const answer = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new Error(`Cognito ${target} refused: ${String(answer.__type ?? response.status)}`);
    return answer;
  };

export type Tokens = { idToken: string; accessToken: string };

/** Signs a user in with USER_SRP_AUTH and returns the tokens. Nothing here is ever printed. */
export const srpSignIn = async (input: {
  region: string;
  userPoolId: string;
  clientId: string;
  username: string;
  password: string;
  now?: () => Date;
  call?: Call;
}): Promise<Tokens> => {
  const call = input.call ?? cognitoCall(input.region);
  const now = input.now ?? (() => new Date());
  const poolName = input.userPoolId.split("_")[1] ?? "";
  const { a, A } = ephemeral();
  const started = await call("InitiateAuth", {
    AuthFlow: "USER_SRP_AUTH",
    ClientId: input.clientId,
    AuthParameters: { USERNAME: input.username, SRP_A: A.toString(16) },
  });
  if (started.ChallengeName !== "PASSWORD_VERIFIER") {
    throw new Error(`Cognito answered ${String(started.ChallengeName)} where PASSWORD_VERIFIER was expected`);
  }
  const params = started.ChallengeParameters as Record<string, string>;
  const userId = params.USER_ID_FOR_SRP ?? "";
  const key = passwordAuthenticationKey({
    poolName,
    userId,
    password: input.password,
    a,
    A,
    B: toBigInt(params.SRP_B ?? "0"),
    salt: params.SALT ?? "0",
  });
  const timestamp = srpTimestamp(now());
  const answered = await call("RespondToAuthChallenge", {
    ChallengeName: "PASSWORD_VERIFIER",
    ClientId: input.clientId,
    Session: started.Session,
    ChallengeResponses: {
      USERNAME: userId,
      PASSWORD_CLAIM_SECRET_BLOCK: params.SECRET_BLOCK,
      TIMESTAMP: timestamp,
      PASSWORD_CLAIM_SIGNATURE: claimSignature(key, poolName, userId, params.SECRET_BLOCK ?? "", timestamp),
    },
  });
  const result = answered.AuthenticationResult as { IdToken?: string; AccessToken?: string } | undefined;
  if (!result?.IdToken || !result.AccessToken) {
    throw new Error(`Cognito answered ${String(answered.ChallengeName ?? "no tokens")} after the password verifier`);
  }
  return { idToken: result.IdToken, accessToken: result.AccessToken };
};
