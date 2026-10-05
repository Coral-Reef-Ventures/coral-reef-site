/**
 * The pieces of an ES256 JWS the door needs: base64url, the signing input, and KMS's DER signature turned into the raw
 * r‖s pair a JWS carries (RFC 7518 §3.4). KMS signs with ECDSA_SHA_256 and returns DER, a SEQUENCE of two INTEGERs,
 * each possibly with a leading zero byte and possibly shorter than 32 bytes.
 */

export const base64url = (bytes: Uint8Array | string): string =>
  Buffer.from(typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes).toString("base64url");

/** `<header>.<payload>`, each base64url JSON. */
export const signingInput = (header: object, payload: object): string =>
  `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

/** Reads a DER length at `at`, returning it and where its content starts. */
const readLength = (der: Uint8Array, at: number): [number, number] => {
  const first = der[at];
  if (first === undefined) throw new Error("DER signature is truncated");
  if (first < 0x80) return [first, at + 1];
  const count = first & 0x7f;
  if (count < 1 || count > 2) throw new Error("DER signature has an unexpected length");
  let length = 0;
  for (let i = 0; i < count; i++) {
    const byte = der[at + 1 + i];
    if (byte === undefined) throw new Error("DER signature is truncated");
    length = (length << 8) | byte;
  }
  return [length, at + 1 + count];
};

/** One INTEGER as exactly `size` big-endian bytes. */
const readInteger = (der: Uint8Array, at: number, size: number): [Uint8Array, number] => {
  if (der[at] !== 0x02) throw new Error("DER signature has no INTEGER where one was expected");
  const [length, start] = readLength(der, at + 1);
  let value = der.subarray(start, start + length);
  if (value.length !== length) throw new Error("DER signature is truncated");
  while (value.length > size && value[0] === 0) value = value.subarray(1);
  if (value.length > size) throw new Error("DER signature integer is too long");
  const out = new Uint8Array(size);
  out.set(value, size - value.length);
  return [out, start + length];
};

/** DER ECDSA signature to the raw r‖s a JWS carries: 64 bytes for P-256. */
export const derToJose = (der: Uint8Array, size = 32): Uint8Array => {
  if (der[0] !== 0x30) throw new Error("DER signature is not a SEQUENCE");
  const [length, start] = readLength(der, 1);
  if (start + length !== der.length) throw new Error("DER signature length does not match");
  const [r, next] = readInteger(der, start, size);
  const [s, end] = readInteger(der, next, size);
  if (end !== der.length) throw new Error("DER signature has trailing bytes");
  const out = new Uint8Array(size * 2);
  out.set(r, 0);
  out.set(s, size);
  return out;
};
