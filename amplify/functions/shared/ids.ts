import { randomBytes } from "node:crypto";

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A ULID: 48 bits of milliseconds and 80 random bits in Crockford's base 32, so ids sort by creation time. Small enough
 * to write here rather than add a dependency for.
 */
export const ulid = (now: number = Date.now(), random: Uint8Array = randomBytes(10)): string => {
  let time = "";
  let ms = now;
  for (let i = 0; i < 10; i++) {
    time = alphabet[ms % 32] + time;
    ms = Math.floor(ms / 32);
  }
  let bits = 0n;
  for (const byte of random) bits = (bits << 8n) | BigInt(byte);
  let tail = "";
  for (let i = 0; i < 16; i++) {
    tail = alphabet[Number(bits & 31n)] + tail;
    bits >>= 5n;
  }
  return time + tail;
};

export const isUlid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
