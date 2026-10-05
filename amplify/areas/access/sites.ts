/**
 * The site registry: each locked site's id, its name, and the hosts it is served on. A ticket is issued only for a host
 * listed here, and its grant is `site:<the first host>`. `CRV_DOOR_TEST_HOSTS` adds temporary hosts while a locked
 * site is tested on a temporary Amplify app (plan Phase 3), as `<site>:<host>` pairs separated by commas; it is empty
 * otherwise. The door's own copy of this list is `apps/web/src/features/access/door-session/sites.ts`.
 */
export type DoorSite = { id: string; name: string; hosts: string[] };

export const productionSites: readonly DoorSite[] = [
  { id: "streamlane", name: "Streamlane", hosts: ["streamlane.app"] },
  { id: "driftline", name: "Driftline", hosts: ["driftline.app"] },
];

const hostShape = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** The registry with `CRV_DOOR_TEST_HOSTS` added, checked: an unknown site or a malformed host is refused. */
export const doorSites = (testHosts: string | undefined): DoorSite[] => {
  const sites = productionSites.map((site) => ({ ...site, hosts: [...site.hosts] }));
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
export const grantResource = (site: DoorSite): string => `site:${site.hosts[0]}`;

/** A site by its id or by any of its hosts, so an admin view may name sites either way. */
export const findSite = (sites: readonly DoorSite[], idOrHost: string): DoorSite | undefined =>
  sites.find((site) => site.id === idOrHost || site.hosts.includes(idOrHost));

/** "Streamlane", "Driftline", or "Streamlane and Driftline", in the registry's order. */
export const siteList = (sites: readonly DoorSite[]): string => {
  const names = sites.map((site) => site.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};
