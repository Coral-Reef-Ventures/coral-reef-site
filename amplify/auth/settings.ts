import { doorSites } from "../areas/access/sites.ts";

/**
 * The backend's settings, read from the environment when it is synthesized and checked here, so a wrong value fails
 * the synth rather than a sign-in. The Amplify app sets them (apps/web/hosting/README.md); an agent's sandbox sets
 * `CRV_AUTH_DOMAIN_PREFIX=crv-door-sandbox` and leaves the rest to their defaults.
 *
 * - CRV_AUTH_DOMAIN_PREFIX: the Cognito prefix domain, required. `crv-door` on the branch, so the Google client's
 *   redirect URI is known before anything is deployed; `crv-door-sandbox` in a sandbox.
 * - CRV_AUTH_CALLBACK_URLS: the app's `/signed-in/` and `/signout/done/` URLs on every origin that serves it, comma
 *   separated. Defaults to the local dev server's.
 * - CRV_ADMIN_EMAILS: the break-glass admins (plan §2.2), at most 512 bytes. Defaults to gary@coralreefventures.com.
 * - CRV_ADMIN_ORIGIN: where the notice's admin link and the invitation text point. A constant, never a request header.
 * - CRV_BUILD_ROLE_NAME: the Amplify build role the door key's policy lets read the public key; unset in a sandbox.
 * - CRV_DOOR_TEST_HOSTS: temporary hosts of a locked site under test (areas/access/sites.ts); empty otherwise.
 */

const localOrigin = "http://localhost:3002";
const defaultCallbackUrls = `${localOrigin}/signed-in/,${localOrigin}/signout/done/`;
export const defaultAdminEmails = "gary@coralreefventures.com";

/** Cognito's rule for a prefix domain, plus the words it refuses in one. */
export const parseDomainPrefix = (value: string | undefined): string => {
  const prefix = value?.trim() ?? "";
  if (!prefix) {
    throw new Error("CRV_AUTH_DOMAIN_PREFIX must be set: crv-door on the branch, crv-door-sandbox in a sandbox");
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(prefix) || /aws|amazon|cognito/.test(prefix)) {
    throw new Error(
      `CRV_AUTH_DOMAIN_PREFIX "${prefix}" is not a Cognito prefix: lowercase letters, digits and hyphens, without "aws", "amazon" or "cognito"`,
    );
  }
  return prefix;
};

const isAppUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    const local = url.protocol === "http:" && url.hostname === "localhost";
    return (url.protocol === "https:" || local) && url.search === "" && url.hash === "" && url.username === "";
  } catch {
    return false;
  }
};

/** The callback and logout URLs, split by path: every URL must end in `/signed-in/` or `/signout/done/`. */
export const parseCallbackUrls = (value: string | undefined): { callbackUrls: string[]; logoutUrls: string[] } => {
  const urls = (value?.trim() || defaultCallbackUrls)
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const callbackUrls: string[] = [];
  const logoutUrls: string[] = [];
  for (const url of urls) {
    if (!isAppUrl(url)) throw new Error(`CRV_AUTH_CALLBACK_URLS has "${url}", which is not an https URL`);
    if (url.endsWith("/signed-in/")) callbackUrls.push(url);
    else if (url.endsWith("/signout/done/")) logoutUrls.push(url);
    else throw new Error(`CRV_AUTH_CALLBACK_URLS has "${url}"; each URL ends in /signed-in/ or /signout/done/`);
  }
  if (callbackUrls.length === 0 || logoutUrls.length === 0) {
    throw new Error("CRV_AUTH_CALLBACK_URLS needs at least one /signed-in/ URL and one /signout/done/ URL");
  }
  return { callbackUrls, logoutUrls };
};

/** The list goes into crv-access's environment and is the one path not bound to an identity, so it stays short. */
export const maxAdminEmailsBytes = 512;
const emailShape = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** CRV_ADMIN_EMAILS: lowercase, trimmed, each once, at most 512 bytes. Unset means Gary; empty means nobody. */
export const parseAdminEmails = (value: string | undefined): string[] => {
  const emails = [
    ...new Set(
      (value ?? defaultAdminEmails)
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  for (const email of emails) {
    if (!emailShape.test(email)) throw new Error(`CRV_ADMIN_EMAILS has "${email}", which is not an email address`);
  }
  const bytes = Buffer.byteLength(emails.join(","));
  if (bytes > maxAdminEmailsBytes) {
    throw new Error(`CRV_ADMIN_EMAILS is ${bytes} bytes, over ${maxAdminEmailsBytes}: list the few admins, no more`);
  }
  return emails;
};

/** CRV_ADMIN_ORIGIN: an origin and nothing else, because a notice links to it. */
export const parseAdminOrigin = (value: string | undefined): string => {
  const origin = value?.trim() || localOrigin;
  if (!isAppUrl(origin) || new URL(origin).origin !== origin) {
    throw new Error(`CRV_ADMIN_ORIGIN "${origin}" must be an origin such as https://coralreefventures.com`);
  }
  return origin;
};

/** CRV_BUILD_ROLE_NAME: an IAM role name, or undefined. */
export const parseRoleName = (value: string | undefined): string | undefined => {
  const name = value?.trim();
  if (!name) return undefined;
  if (!/^[\w+=,.@-]{1,64}$/.test(name)) throw new Error(`CRV_BUILD_ROLE_NAME "${name}" is not an IAM role name`);
  return name;
};

/** Every setting, read from `env` and checked. */
export const readAuthConfig = (env: NodeJS.ProcessEnv) => ({
  domainPrefix: parseDomainPrefix(env.CRV_AUTH_DOMAIN_PREFIX),
  ...parseCallbackUrls(env.CRV_AUTH_CALLBACK_URLS),
  adminEmails: parseAdminEmails(env.CRV_ADMIN_EMAILS),
  adminOrigin: parseAdminOrigin(env.CRV_ADMIN_ORIGIN),
  buildRoleName: parseRoleName(env.CRV_BUILD_ROLE_NAME),
  testHosts: (env.CRV_DOOR_TEST_HOSTS ?? "").trim(),
  sites: doorSites(env.CRV_DOOR_TEST_HOSTS),
});
