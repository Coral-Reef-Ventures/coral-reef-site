---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/capability/0.1
  id: CAP-INVITATIONS
  type: capability
  title: Invite someone in, and take it back
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: OUT-INVITEES-ENTER
---

# Invite someone in, and take it back

## Overview

An invitation is an email address, the sites it grants, and who invited. The first Google sign-in that carries that address accepts it and binds the invitation to that Google identity, so it is the person and not the address that has access. An admin can revoke it, restore it, change what it grants, rebind it when someone's address changes, and delete the person and everything about them. It is planned, not built, and not available.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2 and §3.
