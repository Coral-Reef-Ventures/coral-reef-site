/**
 * *Canonical next* (plan §3): the one place `next` is decided on the backend. The gate in reef's site-tools runs the
 * same steps, and both are tested on the same cases. "Starts with / and not //" is not enough: browsers resolve
 * `/\evil.com` and `/<TAB>/evil.com` (the URL parser strips tabs and newlines) to evil.com, and `/.//evil.com`
 * normalises to `//evil.com`.
 *
 * Returns the re-serialised path and query, which is what the ticket carries, or undefined when `next` is refused.
 */

/** A backslash or any character in U+0000 to U+001F or U+007F. */
const unsafe = (value: string): boolean => {
  for (const c of value) {
    const code = c.charCodeAt(0);
    if (c === "\\" || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
};

export const canonicalNext = (next: string, host: string): string | undefined => {
  // 1. Length, backslashes and control characters.
  if (next.length > 512 || unsafe(next)) return undefined;
  // 2. A path, and not a scheme-relative URL.
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  // 3. Parsed against the site's own origin, it must stay there.
  const origin = `https://${host}`;
  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return undefined;
  }
  if (url.origin !== origin) return undefined;
  // 4. Re-serialised as path and query (the fragment is dropped), checked again.
  const path = url.pathname + url.search;
  if (path.startsWith("//") || unsafe(path)) return undefined;
  // 5. Only this value is used from here on.
  return path;
};
