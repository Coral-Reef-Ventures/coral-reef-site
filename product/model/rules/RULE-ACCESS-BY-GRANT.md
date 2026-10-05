---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/rule/0.1
  id: RULE-ACCESS-BY-GRANT
  type: rule
  title: A grant is the one place access is decided
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
---

# A grant is the one place access is decided

## Constraint

Whether a person may enter a site is decided by an active AccessGrant for `site:<host>` on a person whose Invitation is accepted, bound and matching, and by nothing else: not an address, a group or a flag. The admin area is the one thing a Cognito group decides.
