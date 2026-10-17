/**
 * The app's environments (Streamlane ADR 0087; infra/accounts/README.md). Each is an Amplify Hosting app with no
 * repository connected, in its own account, which `scripts/deploy.ts` deploys from GitHub Actions
 * (`.github/workflows/deploy.yml`): dev on every push to main, staging nightly from the commit dev last shipped, and
 * prod only when the product owner starts it by hand.
 *
 * The door's dev and staging answer only at their Amplify addresses, as Driftline's sites there do. Streamlane's sites
 * there are at dev.streamlane.app and staging.streamlane.app since 2026-10-16, as prod's is at streamlane.app
 * (Streamlane's apps/site/hosting/README.md, "Each environment's address"). Prod is named for the domains it took over at the cutover
 * (Streamlane's plan, step 8): coralreefventures.com, streamlane.app and driftline.app.
 */
export type EnvironmentName = "dev" | "staging" | "prod";

export type HostingEnvironment = {
  account: string;
  appId: string;
  /** Where the app is served: the admin links' origin and the sign-in's callbacks. */
  origin: string;
  /** The Cognito prefix domain, unique across AWS: the old account held `crv-door` until it was closed (2026-10-16). */
  domainPrefix: string;
  /**
   * Where people sign in (amplify/auth/settings.ts, parseSignInDomain): the environment's own address under
   * coralreefventures.com and its us-east-1 certificate, validated in prod's zone. Its alias record is made by hand once
   * the first deploy has created the domain (README.md, "The sign-in address").
   */
  signInDomain: { name: string; certificateArn: string };
  /** The inbox the notice topic subscribes; empty for none. */
  noticeEmail: string;
  /** Each locked site's host in this environment, served by its own Amplify app in the same account. */
  sites: { streamlane: string; driftline: string };
};

export const environments: Record<EnvironmentName, HostingEnvironment> = {
  dev: {
    account: "171180525205",
    appId: "d8p3mdqo02ww3",
    origin: "https://main.d8p3mdqo02ww3.amplifyapp.com",
    domainPrefix: "crv-door-dev",
    signInDomain: {
      name: "auth-dev.coralreefventures.com",
      certificateArn: "arn:aws:acm:us-east-1:171180525205:certificate/8604a64f-33bd-44e1-b9d1-2c0c112f9670",
    },
    noticeEmail: "",
    sites: { streamlane: "dev.streamlane.app", driftline: "main.d1w6lg1l5ckq66.amplifyapp.com" },
  },
  staging: {
    account: "715844023793",
    appId: "d2ymo0co87lonm",
    origin: "https://main.d2ymo0co87lonm.amplifyapp.com",
    domainPrefix: "crv-door-staging",
    signInDomain: {
      name: "auth-staging.coralreefventures.com",
      certificateArn: "arn:aws:acm:us-east-1:715844023793:certificate/a6297034-d8b3-44db-837a-8bdb20ff8255",
    },
    noticeEmail: "",
    sites: { streamlane: "staging.streamlane.app", driftline: "main.d26r6p2ps7cfly.amplifyapp.com" },
  },
  prod: {
    account: "027677878969",
    appId: "d5rsxrpztyob9",
    origin: "https://coralreefventures.com",
    domainPrefix: "crv-door-prod",
    signInDomain: {
      name: "auth.coralreefventures.com",
      certificateArn: "arn:aws:acm:us-east-1:027677878969:certificate/f360eb2b-4344-49ce-be8d-40b84b5967ba",
    },
    noticeEmail: "hello@coralreefventures.com",
    sites: { streamlane: "streamlane.app", driftline: "driftline.app" },
  },
};

export const isEnvironmentName = (value: string): value is EnvironmentName => Object.hasOwn(environments, value);

/** The role GitHub deploys as (infra/accounts/baseline.yml), which the door key's policy lets read the public key. */
export const deployRoleName = "github-deploy-coral-reef-site";

/** `CRV_DOOR_SITE_HOSTS` for an environment: each locked site's host there. */
export const siteHosts = (env: HostingEnvironment): string =>
  `streamlane=${env.sites.streamlane},driftline=${env.sites.driftline}`;

/** The backend's settings for an environment, as amplify/auth/settings.ts reads them at synth. */
export const backendSettings = (env: HostingEnvironment): Record<string, string> => ({
  CRV_DOOR_SITE_HOSTS: siteHosts(env),
  CRV_AUTH_DOMAIN_PREFIX: env.domainPrefix,
  CRV_AUTH_DOMAIN: env.signInDomain.name,
  CRV_AUTH_CERTIFICATE_ARN: env.signInDomain.certificateArn,
  CRV_AUTH_CALLBACK_URLS: `${env.origin}/signed-in/,${env.origin}/signout/done/`,
  CRV_ADMIN_ORIGIN: env.origin,
  CRV_BUILD_ROLE_NAME: deployRoleName,
  CRV_NOTICE_EMAIL: env.noticeEmail,
});

const hostedUi = (prefix: string) => `https://${prefix}.auth.us-east-2.amazoncognito.com`;

/** The outputs' sign-in address, the environment's own in place of the prefix domain the deploy wrote. */
export const withSignInDomain = <T extends { auth?: { oauth?: { domain?: string } } }>(
  outputs: T,
  env: HostingEnvironment,
): T => {
  if (!outputs.auth?.oauth) throw new Error("The outputs have no OAuth settings to point at the sign-in address");
  return { ...outputs, auth: { ...outputs.auth, oauth: { ...outputs.auth.oauth, domain: env.signInDomain.name } } };
};

/**
 * custom-headers.yml for an environment: its own sign-in address and its own sites (where the door posts tickets) in the
 * content security policy, and the flat form, since an app with no repository is not a monorepo app.
 */
export const renderHeaders = (source: string, env: HostingEnvironment): string => {
  const marker = "applications:\n  - appRoot: apps/web\n";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("custom-headers.yml no longer has the monorepo form this expects");
  const body = source
    .slice(start + marker.length)
    .split("\n")
    .map((line) => line.replace(/^ {4}/, ""))
    .join("\n");
  if (!body.includes(hostedUi("crv-door"))) throw new Error("custom-headers.yml no longer names the hosted UI");
  const formAction = "form-action 'self' https://streamlane.app https://driftline.app";
  if (!body.includes(formAction)) throw new Error("custom-headers.yml no longer has the form-action this expects");
  return body
    .replaceAll(hostedUi("crv-door"), `https://${env.signInDomain.name}`)
    .replace(formAction, `form-action 'self' https://${env.sites.streamlane} https://${env.sites.driftline}`);
};
