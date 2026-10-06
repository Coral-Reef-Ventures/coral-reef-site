/**
 * The sites behind the door, as the leak check sees them (plan Phase 3, "CRV side"). `locked` turns a site's daily
 * check on: it is set in the same change that records a flip (`door.locked`), never ahead of it, because an open site
 * fails every check by design. `pages` is the site's sitemap as it stood when the site was last open, which the check
 * falls back to when it runs without a session and cannot read the sitemap itself; a run with a session reads the
 * live one and reports any page this list lacks.
 */
export type LockedSite = {
  id: string;
  /** The production host: the one the gate allows after the flip, and the grant's resource. */
  apex: string;
  /** The product's Amplify app, whose default domain must be refused. */
  appId: string;
  locked: boolean;
  pages: readonly string[];
};

export const sites: readonly LockedSite[] = [
  {
    id: "driftline",
    apex: "driftline.app",
    appId: "d39wmoekppxvpd",
    locked: true,
    pages: ["/", "/product/", "/pricing/", "/compare/", "/continuity/", "/not-yet/", "/roadmap/", "/early-access/"],
  },
  {
    id: "streamlane",
    apex: "streamlane.app",
    appId: "d32jlosp0d9m43",
    locked: false,
    pages: [
      "/",
      "/pricing/",
      "/product/",
      "/compare/",
      "/continuity/",
      "/not-yet/",
      "/contact/",
      "/roadmap/",
      "/demo/",
      "/changelog/",
      "/docs/",
      "/docs/concepts/",
      "/docs/concepts/goals/",
      "/docs/concepts/nodes/",
      "/docs/concepts/projects/",
      "/docs/concepts/tasks/",
      "/docs/concepts/teams/",
      "/docs/continuity/",
      "/docs/getting-started/",
      "/docs/github/",
      "/docs/mcp-server/",
      "/docs/query-language/",
      "/docs/security/",
      "/docs/slack/",
    ],
  },
];

/**
 * What a host is expected to do. `gated`: the gate answers it (the apex, or a temporary app's host). `redirect`: an
 * Amplify rule sends it to the apex before the gate runs (`www`). `refused`: the gate's host check answers 403 (the
 * app's own amplifyapp.com domain, which stays reachable after the custom domain is added).
 */
export type HostRole = "gated" | "redirect" | "refused";

export type CheckedHost = { site: LockedSite; host: string; role: HostRole };

const hostShape = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * `CRV_DOOR_TEST_HOSTS`'s format, the backend's own (`<site>:<host>` pairs, comma-separated): a temporary app's host
 * is gated, and the CRV app issues tickets for it only while it is listed there too.
 */
export const parseTestHosts = (value: string | undefined): { site: string; host: string }[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [site, host, extra] = entry.split(":");
      if (!site || !host || extra !== undefined || !hostShape.test(host) || !sites.some((s) => s.id === site)) {
        throw new Error(
          `a test host must be <site>:<host> with a site of ${sites.map((s) => s.id).join(", ")}: ${entry}`,
        );
      }
      return { site, host };
    });

/** Every host the check visits for a site: the apex, www, the app's amplifyapp.com domain, and any test host. */
export const hostsOf = (site: LockedSite, testHosts: { site: string; host: string }[]): CheckedHost[] => [
  { site, host: site.apex, role: "gated" },
  { site, host: `www.${site.apex}`, role: "redirect" },
  { site, host: `main.${site.appId}.amplifyapp.com`, role: "refused" },
  ...testHosts
    .filter((test) => test.site === site.id)
    .map((test) => ({ site, host: test.host, role: "gated" as const })),
];
