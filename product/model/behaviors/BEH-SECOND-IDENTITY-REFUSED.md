---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/behavior/0.1
  id: BEH-SECOND-IDENTITY-REFUSED
  type: behavior
  title: 'A second Google identity cannot take an invitee''s address'
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

# A second Google identity cannot take an invitee's address

## Behavior

Once an invitation is bound to a Google identity, a second identity that presents the same address is refused at sign-up, and a bound invitee whose Google address changes is refused until an admin rebinds the invitation.

## Preconditions

The Invitation is `accepted` and bound to a `sub`.

## Outcomes

Success: the bound person keeps working access. Failure: the other identity is refused with nothing stored; the changed address is refused as `EMAIL_CHANGED` and the admin sees it.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
