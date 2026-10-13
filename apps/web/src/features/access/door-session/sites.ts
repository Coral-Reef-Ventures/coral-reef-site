/**
 * The sites behind the door, which is the same list the backend's registry holds (areas/access/sites.ts). A ticket is
 * only ever posted to one of these hosts, whatever a query string says.
 */
const productionSites = [
  { id: "driftline", host: "driftline.app", name: "Driftline" },
  { id: "streamlane", host: "streamlane.app", name: "Streamlane" },
] as const;

export type LockedSite = { id: (typeof productionSites)[number]["id"]; host: string; name: string };

/**
 * An environment's own host for each site (dev, staging and prod in their accounts), set at build from
 * `CRV_DOOR_SITE_HOSTS` (`<site>=<host>` pairs, next.config.ts); empty in production, where the hosts above stand.
 * The backend checks the same setting, and refuses a ticket for any host it does not list.
 */
export const withSiteHosts = (value: string): LockedSite[] => {
  const hosts = new Map(
    value
      .split(",")
      .map((pair) => pair.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0]) && Boolean(pair[1])),
  );
  return productionSites.map((site) => ({ ...site, host: hosts.get(site.id) ?? site.host }));
};

export const lockedSites: readonly LockedSite[] = withSiteHosts(process.env.CRV_DOOR_SITE_HOSTS ?? "");

export const siteById = (id: string | null | undefined): LockedSite | undefined =>
  lockedSites.find((site) => site.id === id);

export const siteByHost = (host: string | null | undefined): LockedSite | undefined =>
  lockedSites.find((site) => site.host === host);

/**
 * Where sign-out starts walking: the first site's `/_door/signout`, which clears that site's cookies and carries on by
 * a fixed map to the next, and the last returns here. The door builds only this one URL, from its own list, and never
 * from a query.
 */
export const signoutChainStart = (): string => {
  const [first, second] = lockedSites;
  if (!first || !second) throw new Error("The door expects two locked sites");
  return `https://${first.host}/_door/signout?then=${second.id}`;
};
