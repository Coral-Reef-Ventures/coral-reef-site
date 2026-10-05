---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/behavior/0.1
  id: BEH-ADMIN-INVITES
  type: behavior
  title: An admin invites from a submission
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: CAP-ADMIN-REVIEW
  links:
    governedBy: [RULE-ACCESS-BY-GRANT]
    informedBy: [ADR-AREAS]
  availability:
    products: [PRD-CRV]
    releases: [phase-1]
    roles: [admin]
    editions: [hosted]
    flags: []
---

# An admin invites from a submission

## Behavior

From a submission, an admin chooses the sites and invites. The address is claimed by one person, an Invitation is created as pending with the grants, the submission is marked invited, and the admin is given the invitation text to copy into their own email.

## Preconditions

The caller is in the admins group, and the address is not already bound to an invitation.

## Outcomes

Success: the person can sign in with Google and be let in. Failure: an address whose invitation is already bound is refused and the admin is pointed to rebinding; a non-admin is refused by authorization before anything runs.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
