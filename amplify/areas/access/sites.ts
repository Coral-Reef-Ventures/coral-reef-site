/**
 * The site registry: each locked site's id, its name, and the hosts it is served on. A ticket is issued only for a host
 * listed here, and its grant is `site:<its production host>` in every environment, so a grant outlives a change of the
 * environment's own host. `CRV_DOOR_TEST_HOSTS` adds temporary hosts while a locked
 * site is tested on a temporary Amplify app (plan Phase 3), as `<site>:<host>` pairs separated by commas; it is empty
 * otherwise. `CRV_DOOR_SITE_HOSTS` replaces each site's hosts with one of an environment's own (dev, staging and prod
 * in their accounts, apps/web/hosting/environments.ts), as `<site>=<host>` pairs; unset, the production hosts stand.
 * The door's own copy of this list is `apps/web/src/features/access/door-session/sites.ts`, which the same setting
 * changes at build.
 */
export type DoorSite = { id: string; name: string; hosts: string[] };

export const productionSites: readonly DoorSite[] = [
  { id: "streamlane", name: "Streamlane", hosts: ["streamlane.app"] },
  { id: "driftline", name: "Driftline", hosts: ["driftline.app"] },
];

const hostShape = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** `CRV_DOOR_SITE_HOSTS`: `<site>=<host>` pairs, every one a known site and a well-formed host. */
export const parseSiteHosts = (value: string | undefined): Map<string, string> => {
  const hosts = new Map<string, string>();
  for (const entry of (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const [id, host, extra] = entry.split("=");
    if (!productionSites.some((site) => site.id === id) || !host || extra !== undefined || !hostShape.test(host)) {
      throw new Error(`CRV_DOOR_SITE_HOSTS has "${entry}"; write <site>=<host> with a site of ${sitesList()}`);
    }
    hosts.set(id as string, host);
  }
  return hosts;
};

/**
 * The registry: each site's hosts replaced by `CRV_DOOR_SITE_HOSTS`, then `CRV_DOOR_TEST_HOSTS` added, checked: an
 * unknown site or a malformed host is refused.
 */
export const doorSites = (testHosts: string | undefined, siteHosts?: string): DoorSite[] => {
  const replaced = parseSiteHosts(siteHosts);
  const sites = productionSites.map((site) => {
    const host = replaced.get(site.id);
    return { ...site, hosts: host ? [host] : [...site.hosts] };
  });
  for (const entry of (testHosts ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    const [id, host, extra] = entry.split(":");
    const site = sites.find((candidate) => candidate.id === id);
    if (!site || !host || extra !== undefined || !hostShape.test(host)) {
      throw new Error(`CRV_DOOR_TEST_HOSTS has "${entry}"; write <site>:<host> with a site of ${sitesList()}`);
    }
    if (!site.hosts.includes(host)) site.hosts.push(host);
  }
  return sites;
};

const sitesList = () => productionSites.map((site) => site.id).join(", ");

/** The grant resource that opens a site: `site:<production host>`, whichever of its hosts is asked for. */
export const grantResource = (site: DoorSite): string =>
  `site:${productionSites.find((known) => known.id === site.id)?.hosts[0] ?? site.hosts[0]}`;

/** A site by its id or by any of its hosts, so an admin view may name sites either way. */
export const findSite = (sites: readonly DoorSite[], idOrHost: string): DoorSite | undefined =>
  sites.find((site) => site.id === idOrHost || site.hosts.includes(idOrHost));

/** "Streamlane", "Driftline", or "Streamlane and Driftline", in the registry's order. */
export const siteList = (sites: readonly DoorSite[]): string => {
  const names = sites.map((site) => site.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};
