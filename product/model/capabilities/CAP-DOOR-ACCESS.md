---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/capability/0.1
  id: CAP-DOOR-ACCESS
  type: capability
  title: Sign in once and be let into each granted site
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: OUT-INVITEES-ENTER
---

# Sign in once and be let into each granted site

## Overview

The door signs a short-lived ticket with a key in KMS for the site the invitee asked for, and the visitor's browser posts it to that site's `/_door` path, where the site's gate verifies it against the door's published public key and sets its own session cookie. A site that receives no valid ticket serves the door and nothing else. It is planned, not built, and not available.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2 and §3.
