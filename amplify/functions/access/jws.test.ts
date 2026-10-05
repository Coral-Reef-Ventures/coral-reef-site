import { generateKeyPairSync, sign, verify } from "node:crypto";

import { describe, expect, it } from "vitest";

import { derToJose } from "./jws.ts";
import { signTicket, type TicketClaims } from "./ticket.ts";

const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
/** KMS's Sign with ECDSA_SHA_256 on a RAW message: it hashes the message and returns DER. */
const kms = async (message: Uint8Array) =>
  new Uint8Array(sign("sha256", message, { key: pair.privateKey, dsaEncoding: "der" }));

describe("derToJose", () => {
  it("turns KMS's DER into the r‖s node:crypto verifies, across many signatures (short and padded integers alike)", () => {
    for (let i = 0; i < 300; i++) {
      const data = Buffer.from(`message ${i}`);
      const der = sign("sha256", data, { key: pair.privateKey, dsaEncoding: "der" });
      const raw = derToJose(der);
      expect(raw).toHaveLength(64);
      expect(verify("sha256", data, { key: pair.publicKey, dsaEncoding: "ieee-p1363" }, raw)).toBe(true);
    }
  });

  it("pads a short integer and strips a leading zero", () => {
    // SEQUENCE { INTEGER 0x00 0x80.. (33 bytes), INTEGER 0x01 (1 byte) }
    const r = Buffer.concat([Buffer.from([0x00, 0x80]), Buffer.alloc(31, 0x11)]);
    const der = Buffer.concat([Buffer.from([0x30, 2 + 33 + 3, 0x02, 33]), r, Buffer.from([0x02, 0x01, 0x01])]);
    const raw = derToJose(der);
    expect(raw[0]).toBe(0x80);
    expect(raw.subarray(32, 63).every((b) => b === 0)).toBe(true);
    expect(raw[63]).toBe(1);
  });

  it.each([
    ["not a SEQUENCE", [0x31, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]],
    ["a wrong length", [0x30, 0x07, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]],
    ["trailing bytes", [0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0x00]],
    ["no INTEGER", [0x30, 0x06, 0x04, 0x01, 0x01, 0x02, 0x01, 0x01]],
    ["an integer too long", [0x30, 0x25, 0x02, 0x21, ...Array(33).fill(0x11), 0x02, 0x00]],
  ])("refuses %s", (_name, bytes) => expect(() => derToJose(new Uint8Array(bytes))).toThrow());
});

describe("signTicket", () => {
  it("round-trips: a ticket KMS signed verifies against the public key exported as a JWK, as the gate will", async () => {
    const claims: TicketClaims = {
      iss: "https://coralreefventures.com",
      aud: "driftline.app",
      sub: "P",
      gid: "G",
      jti: "J",
      iat: 1,
      exp: 3601,
      st: "s".repeat(22),
      next: "/",
      kid: "K",
    };
    const ticket = await signTicket(claims, kms);
    const [header, payload, signature] = ticket.split(".") as [string, string, string];
    const jwk = pair.publicKey.export({ format: "jwk" });
    expect(
      verify(
        "sha256",
        Buffer.from(`${header}.${payload}`),
        { key: jwk, format: "jwk", dsaEncoding: "ieee-p1363" },
        Buffer.from(signature, "base64url"),
      ),
    ).toBe(true);
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual(claims);
  });
});
