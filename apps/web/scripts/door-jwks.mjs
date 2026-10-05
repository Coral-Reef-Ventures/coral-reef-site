// Writes the door's public key as a JWKS for the locked product sites' builds (plan §2.4).
//
//   aws kms get-public-key --key-id "$DOOR_KEY_ARN" --query PublicKey --output text \
//     | DOOR_KID="$DOOR_KID" node apps/web/scripts/door-jwks.mjs
//
// Standard input is the key's DER SubjectPublicKeyInfo as base64, which is what the CLI prints. The output is
// out/.well-known/crv-door-jwks.json beside this script's app (or under DOOR_JWKS_OUT), holding one JWK with
// kid = DOOR_KID, alg ES256 and use sig. The build fails unless the key is EC on P-256. This is deliberately not a CDK
// AwsCustomResource, whose handler decodes binary fields as UTF-8 and would corrupt the DER bytes.
import { createPublicKey } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fail = (message) => {
  console.error(`door-jwks: ${message}`);
  process.exit(1);
};

const kid = (process.env.DOOR_KID ?? "").trim();
if (!/^[\w-]{1,128}$/.test(kid)) fail("DOOR_KID must be the door key's id");

const base64 = readFileSync(0, "utf8").trim();
if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) fail("standard input must be the public key as base64 DER");

let key;
try {
  key = createPublicKey({ key: Buffer.from(base64, "base64"), format: "der", type: "spki" });
} catch {
  fail("standard input is not a DER SubjectPublicKeyInfo");
}
if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
  fail("the door key must be EC on P-256 (ES256)");
}

const { kty, crv, x, y } = key.export({ format: "jwk" });
const jwks = { keys: [{ kty, crv, x, y, kid, alg: "ES256", use: "sig" }] };

const outDir = process.env.DOOR_JWKS_OUT ?? join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const file = join(outDir, ".well-known", "crv-door-jwks.json");
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(jwks, null, 2)}\n`);
console.log(`door-jwks: wrote ${file} (kid ${kid})`);
