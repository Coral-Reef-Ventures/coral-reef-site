/**
 * A ticket's `iss`: the door's own origin. Each site's gate takes its issuer from the door it was built for (reef's
 * site-tools, `doorOrigin` of `CRV_DOOR_URL`) and refuses any other, so dev's and staging's doors, at their Amplify
 * addresses, must not sign as coralreefventures.com, which only prod's door is.
 */
export const ticketIssuer = (doorOrigin: string | undefined): string =>
  new URL(doorOrigin || "https://coralreefventures.com").origin;
