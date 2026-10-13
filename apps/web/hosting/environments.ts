/**
 * The app's environments (Streamlane ADR 0087; infra/accounts/README.md). Each is an Amplify Hosting app with no
 * repository connected, in its own account, which `scripts/deploy.ts` deploys from GitHub Actions
 * (`.github/workflows/deploy.yml`): dev on every push to main, staging nightly from the commit dev last shipped, and
 * prod only when the product owner starts it by hand.
 *
 * Until the cutover (the plan's step 8), each answers only at its Amplify address, and coralreefventures.com is still
 * served from the old account (`apps/web/hosting/README.md`).
 */
export type EnvironmentName = "dev" | "staging" | "prod";

export type HostingEnvironment = {
  account: string;
  appId: string;
  /** Where the app is served: the admin links' origin and the sign-in's callbacks. */
  origin: string;
  /** The Cognito prefix domain, unique across AWS: the old account still holds `crv-door`. */
  domainPrefix: string;
  /** The inbox the notice topic subscribes; empty for none. */
  noticeEmail: string;
};

export const environments: Record<EnvironmentName, HostingEnvironment> = {
  dev: {
    account: "171180525205",
    appId: "d8p3mdqo02ww3",
    origin: "https://main.d8p3mdqo02ww3.amplifyapp.com",
    domainPrefix: "crv-door-dev",
    noticeEmail: "",
  },
  staging: {
    account: "715844023793",
    appId: "d2ymo0co87lonm",
    origin: "https://main.d2ymo0co87lonm.amplifyapp.com",
    domainPrefix: "crv-door-staging",
    noticeEmail: "",
  },
  prod: {
    account: "027677878969",
    appId: "d5rsxrpztyob9",
    origin: "https://main.d5rsxrpztyob9.amplifyapp.com",
    domainPrefix: "crv-door-prod",
    noticeEmail: "hello@coralreefventures.com",
  },
};

export const isEnvironmentName = (value: string): value is EnvironmentName => Object.hasOwn(environments, value);

/** The role GitHub deploys as (infra/accounts/baseline.yml), which the door key's policy lets read the public key. */
export const deployRoleName = "github-deploy-coral-reef-site";

/** The backend's settings for an environment, as amplify/auth/settings.ts reads them at synth. */
export const backendSettings = (env: HostingEnvironment): Record<string, string> => ({
  CRV_AUTH_DOMAIN_PREFIX: env.domainPrefix,
  CRV_AUTH_CALLBACK_URLS: `${env.origin}/signed-in/,${env.origin}/signout/done/`,
  CRV_ADMIN_ORIGIN: env.origin,
  CRV_BUILD_ROLE_NAME: deployRoleName,
  CRV_NOTICE_EMAIL: env.noticeEmail,
});

const hostedUi = (prefix: string) => `https://${prefix}.auth.us-east-2.amazoncognito.com`;

/**
 * custom-headers.yml for an environment: its own hosted UI in the content security policy, and the flat form, since
 * an app with no repository is not a monorepo app.
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
  return body.replaceAll(hostedUi("crv-door"), hostedUi(env.domainPrefix));
};
