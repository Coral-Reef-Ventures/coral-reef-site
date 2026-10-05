---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/behavior/0.1
  id: BEH-REVOKED-REFUSED
  type: behavior
  title: A revoked invitee is refused a new ticket at once and loses access within an hour
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
    roles: [invitee]
    editions: [hosted]
    flags: []
---

# A revoked invitee is refused a new ticket at once and loses access within an hour

## Behavior

Revoking an invitation disables the Cognito user, signs it out everywhere, marks its grants revoked and writes Activity. The door will not issue a ticket for it from that moment, and a session cookie the site already holds lapses within its one hour.

## Preconditions

An admin revokes the invitation.

## Outcomes

Success: a refresh of the token is refused and no ticket is issued. Failure: if the Cognito calls fail, the revocation reports the failure and is retried rather than half-applied.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
