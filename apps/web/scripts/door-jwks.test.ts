import { spawnSync } from "node:child_process";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(import.meta.dirname, "door-jwks.mjs");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Runs the script as the build does: the base64 DER on standard input, the key id in DOOR_KID. */
const run = (input: string, kid = "0b1f6e6c-2f43-4c1a-9d1e-6a8b2c3d4e5f") => {
  const out = mkdtempSync(join(tmpdir(), "door-jwks-"));
  dirs.push(out);
  const result = spawnSync(process.execPath, [script], {
    input,
    env: { ...process.env, DOOR_KID: kid, DOOR_JWKS_OUT: out },
    encoding: "utf8",
  });
  const file = join(out, ".well-known", "crv-door-jwks.json");
  return { ...result, read: () => JSON.parse(readFileSync(file, "utf8")) };
};

const spki = (curve: string) =>
  generateKeyPairSync("ec", { namedCurve: curve }).publicKey.export({ format: "der", type: "spki" }).toString("base64");

describe("door-jwks.mjs", () => {
  it("turns a P-256 SPKI into one ES256 JWK that verifies what the private key signed", () => {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const result = run(pair.publicKey.export({ format: "der", type: "spki" }).toString("base64"));
    expect(result.status, result.stderr).toBe(0);
    const jwks = result.read();
    expect(jwks.keys).toHaveLength(1);
    const [jwk] = jwks.keys;
    expect(jwk).toMatchObject({ kty: "EC", crv: "P-256", kid: "0b1f6e6c-2f43-4c1a-9d1e-6a8b2c3d4e5f", alg: "ES256" });
    expect(jwk.use).toBe("sig");
    expect(Object.keys(jwk).sort()).toEqual(["alg", "crv", "kid", "kty", "use", "x", "y"]);
    const data = Buffer.from("header.payload");
    const signature = sign("sha256", data, { key: pair.privateKey, dsaEncoding: "ieee-p1363" });
    expect(verify("sha256", data, { key: jwk, format: "jwk", dsaEncoding: "ieee-p1363" }, signature)).toBe(true);
  });

  it("refuses a P-384 key", () => {
    const result = run(spki("P-384"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("P-256");
  });

  it("refuses an RSA key, input that is not base64 DER, and a missing key id", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 })
      .publicKey.export({ format: "der", type: "spki" })
      .toString("base64");
    expect(run(rsa).status).toBe(1);
    expect(run("not base64!").status).toBe(1);
    expect(run(Buffer.from("not a key").toString("base64")).status).toBe(1);
    expect(run(spki("P-256"), "").status).toBe(1);
  });
});
