/** A backslash or any control character (U+0000 to U+001F, U+007F), which browsers read as something else. */
const unsafe = (value: string): boolean => [...value].some((c) => c === "\\" || c <= "\u001f" || c === "\u007f");

/**
 * A same-site path to return to, or "/". The backend and the gate each check `next` again against the site's own
 * origin (they are the checks that count); this is the door refusing to carry what could never pass. The rules are
 * the plan's *Canonical next*: at most 512 characters, no backslash or control character, a leading `/` that is not
 * `//`, and a parse that stays on the origin and re-serialises as a path.
 */
export const canonicalNext = (next: string | null | undefined, host: string): string => {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return "/";
  if (unsafe(next)) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  let url: URL;
  try {
    url = new URL(next, `https://${host}`);
  } catch {
    return "/";
  }
  if (url.origin !== `https://${host}`) return "/";
  const path = url.pathname + url.search;
  if (path.startsWith("//") || unsafe(path)) return "/";
  return path;
};
