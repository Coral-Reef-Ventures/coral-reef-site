---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/intent/0.1
  id: INT-REAL-DOOR
  type: intent
  title: The locked sites are served only to invitees
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: PRD-CRV
---

# The locked sites are served only to invitees

## Rationale

A door that only hides a page is not a lock: if the pages are served and a script decides whether to show them, everything is already on the visitor's machine. The locked sites' pages are therefore not served at all without a signed-in invitee, and everyone else gets the door. Invitation is the one way in, and the people who have not been invited are offered a way to say they are interested instead.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 (the lock) and §2.3 (the data spine).
