/** Where the form and the sign-in live. */
export const getInvolvedPath = "/get-involved/";

/** The query keys that are for the sign-in or the form: a gate's request, a refused sign-in, and where a visitor came from. */
const doorKeys = ["site", "host", "next", "state", "error", "error_description"];

/** The two sections that used to be on the home page, which an older link or invitation may still name. */
const movedSections = ["#involved", "#invited"];

/**
 * Where a visit to `/` belongs instead, or null to stay. A locked site's gate redirects to the door's origin, `/`, with
 * its request in the query (reef's gate takes an origin and nothing else), and the sign-in and the form now live on
 * their own page, so that visit goes there with the query and the fragment unchanged. So does an older link to
 * `/#involved` or `/#invited`. Anything else, the home page itself, stays.
 */
export const forwardFor = (search: string, hash: string): string | null => {
  const params = new URLSearchParams(search);
  const asked = doorKeys.some((key) => params.has(key));
  if (!asked && !movedSections.includes(hash)) return null;
  return `${getInvolvedPath}${search}${hash}`;
};
