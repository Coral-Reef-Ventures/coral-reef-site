---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/rule/0.1
  id: RULE-NO-TRACKING
  type: rule
  title: No tracking on the door
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
---

# No tracking on the door

## Constraint

The door and the app set no cookie beyond what sign-in needs, load no third-party script, font or image, and send nothing about a visitor anywhere but to this app's own backend. A test on the built output fails on a third-party origin, an external font or a write to `document.cookie`.
