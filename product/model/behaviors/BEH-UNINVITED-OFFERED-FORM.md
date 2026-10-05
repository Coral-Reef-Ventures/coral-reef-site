---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/behavior/0.1
  id: BEH-UNINVITED-OFFERED-FORM
  type: behavior
  title: An uninvited Google sign-in is refused and offered the form, prefilled
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: CAP-INVITATIONS
  links:
    governedBy: [RULE-ACCESS-BY-GRANT]
    informedBy: [ADR-AREAS]
  availability:
    products: [PRD-CRV]
    releases: [phase-1]
    roles: [visitor]
    editions: [hosted]
    flags: []
---

# An uninvited Google sign-in is refused and offered the form, prefilled

## Behavior

Someone signs in with Google whose address has no pending invitation. Sign-up is refused before a user exists, and they are returned to the door with the interest form open and their address filled in.

## Preconditions

The address is not on any Invitation that is pending.

## Outcomes

Success: no Cognito user, Person or Invitation is created, and the form offers them the way to ask. Failure: the refusal is counted as a metric with no address; nothing about the person is stored, because they gave us nothing.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
