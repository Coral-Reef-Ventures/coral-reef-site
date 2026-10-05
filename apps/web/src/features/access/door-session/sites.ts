/**
 * The sites behind the door, which is the same list the backend's registry holds (areas/access/sites.ts). A ticket is
 * only ever posted to one of these hosts, whatever a query string says.
 */
export const lockedSites = [
  { id: "driftline", host: "driftline.app", name: "Driftline" },
  { id: "streamlane", host: "streamlane.app", name: "Streamlane" },
] as const;

export type LockedSite = (typeof lockedSites)[number];

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
  return `https://${first.host}/_door/signout?then=${second.id}`;
};
