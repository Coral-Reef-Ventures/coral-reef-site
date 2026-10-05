---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/rule/0.1
  id: RULE-GATED-NO-STORE
  type: rule
  title: What a gate serves is never stored by a shared cache
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
---

# What a gate serves is never stored by a shared cache

## Constraint

A gated response says it must not be stored, so a shared cache never keeps a locked page for someone who has not been let in. Headers that would let it (an immutable cache for hashed assets) are not applied to a locked site.
