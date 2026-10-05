import { base64url, derToJose, signingInput } from "./jws.ts";

/** Signs bytes with the door key and returns KMS's DER signature. */
export type Signer = (message: Uint8Array) => Promise<Uint8Array>;

export type TicketClaims = {
  /** The door: https://coralreefventures.com. */
  iss: string;
  /** The exact host the ticket opens. */
  aud: string;
  /** The bound Person's id. */
  sub: string;
  /** The AccessGrant that allows it: the cookie's `gid`. */
  gid: string;
  jti: string;
  iat: number;
  exp: number;
  /** The state nonce the gate set before sending the visitor here. */
  st: string;
  /** Where to land, after *Canonical next*. */
  next: string;
  /** The KMS key id, as in the header. */
  kid: string;
};

/** A ticket lives as long as the session cookie it becomes: one hour (plan §1). */
export const ticketSeconds = 3600;

/** An ES256 JWS signed by KMS: the header names the key, the signature is converted from DER to r‖s. */
export const signTicket = async (claims: TicketClaims, sign: Signer): Promise<string> => {
  const input = signingInput({ alg: "ES256", typ: "JWT", kid: claims.kid }, claims);
  const der = await sign(new Uint8Array(Buffer.from(input, "utf8")));
  return `${input}.${base64url(derToJose(der))}`;
};
