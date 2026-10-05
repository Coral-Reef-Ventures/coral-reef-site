---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/behavior/0.1
  id: BEH-TICKET-OPENS-SITE
  type: behavior
  title: 'An invitee''s ticket opens the site'
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: CAP-DOOR-ACCESS
  links:
    governedBy: [RULE-TOKEN-NOT-IN-URL, RULE-ACCESS-BY-GRANT]
    informedBy: [ADR-AREAS]
  availability:
    products: [PRD-CRV]
    releases: [phase-1]
    roles: [invitee]
    editions: [hosted]
    flags: []
---

# An invitee's ticket opens the site

## Behavior

An invitee who is signed in asks the door for a ticket for a site they are granted. The door signs it and the browser posts it to the site's `/_door`; the gate verifies it, sets a session cookie of one hour, and sends the visitor to the page they came for.

## Preconditions

The invitee's Invitation is accepted and bound to their Google identity, their email still matches, and their person has an active grant for the site. The `next` address passes the canonical form check against the site's own host.

## Outcomes

Success: the visitor lands on the page they asked for, with the site served. Failure: no grant, a host the registry does not know, or a `next` that is not the site's own gets no ticket, and the door says so.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
