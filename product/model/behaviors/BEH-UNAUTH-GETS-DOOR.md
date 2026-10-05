---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/behavior/0.1
  id: BEH-UNAUTH-GETS-DOOR
  type: behavior
  title: An unauthenticated request to a locked site gets the door
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: CAP-DOOR-ACCESS
  links:
    governedBy: [RULE-GATED-NO-STORE, RULE-NO-TRACKING]
    informedBy: [ADR-AREAS]
  availability:
    products: [PRD-CRV]
    releases: [phase-1]
    roles: [visitor]
    editions: [hosted]
    flags: []
---

# An unauthenticated request to a locked site gets the door

## Behavior

A request to a locked site with no valid session cookie is answered by the door: a 302 to coralreefventures.com for a page, and a 401 for anything else (a script, an image, a data request).

## Preconditions

The request carries no valid session cookie.

## Outcomes

Success: the response carries zero bytes of the site, and says it must not be stored. Failure: none to handle; this is the response to a failure of authentication. A request that cannot be told apart from a page is answered 401, never with the site.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
