---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/behavior/0.1
  id: BEH-BAD-TICKET-REFUSED
  type: behavior
  title: A tampered, expired, mis-addressed or replayed ticket is refused
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: CAP-DOOR-ACCESS
  links:
    governedBy: [RULE-TOKEN-NOT-IN-URL]
    informedBy: [ADR-AREAS]
  availability:
    products: [PRD-CRV]
    releases: [phase-1]
    roles: [visitor]
    editions: [hosted]
    flags: []
---

# A tampered, expired, mis-addressed or replayed ticket is refused

## Behavior

The gate refuses a ticket that is tampered with, expired, signed for another audience, signed with a key id it does not know, or posted with a state that does not match the one the browser stored for this sign-in.

## Preconditions

A request reaches `/_door` with a ticket.

## Outcomes

Success: the visitor is sent to the door and no session is set. Failure: a refused ticket is never explained beyond that it was refused, and the response carries zero bytes of the site.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
