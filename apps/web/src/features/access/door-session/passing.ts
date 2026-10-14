import { lockedSites } from "./sites.ts";

/** The attribute on <body> that says the visitor is passing through on the way to a site, holding that site's name. */
export const passingAttribute = "data-door-to";

/**
 * Run from the top of <body>, before the page paints (as the scheme script is, and for the same reason): a visit carrying a locked site's request (its gate's sign-in, or the renewal of an ended
 * session) is usually on its way straight through, to a ticket and back to the site. Marking it here lets door.css
 * show "Opening <site>…" in place of the page, so the visitor is not shown the form for the second it takes. The
 * sign-in clears the mark the moment it has anything to show (passing.ts, `showPage`), and door.css shows the page
 * again after a few seconds whatever happens, so a failure never leaves it blank.
 */
export const doorPassingScript = `(function () {
  try {
    var sites = ${JSON.stringify(Object.fromEntries(lockedSites.map((site) => [site.id, [site.host, site.name]])))};
    var query = new URLSearchParams(location.search);
    var site = sites[query.get("site")];
    if (site && query.get("host") === site[0] && query.get("state")) {
      document.body.setAttribute("${passingAttribute}", site[1]);
    }
  } catch (e) {}
})();`;

/** Shows the page again: the sign-in has something to say, so the visitor is not passing straight through. */
export const showPage = (root: Pick<Element, "removeAttribute"> = document.body): void => {
  root.removeAttribute(passingAttribute);
};
