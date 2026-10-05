---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/slice/0.1
  id: SLICE-ACCESS-DOOR-SESSION
  type: slice
  title: Door session slice
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  links:
    implements: [BEH-UNAUTH-GETS-DOOR, BEH-TICKET-OPENS-SITE, BEH-BAD-TICKET-REFUSED, BEH-UNINVITED-OFFERED-FORM]
    informedBy: [ADR-AREAS]
  slice:
    kind: product
    domain: access
    entrypoints: [apps/web/src/features/access/door-session/index.ts]
    layers:
      presentation: []
      application: []
      policy: []
      model: []
      external: []
    claims:
      - kind: source
        path: apps/web/src/features/access/door-session/**
      - kind: backend
        path: amplify/functions/access/**
      - kind: backend
        path: amplify/auth/pre-sign-up/**
      - kind: verification
        path: apps/web/e2e/door.spec.ts
    usesResources: []
---

# Door session slice

## Responsibility

Planned owner of signing in at the door and asking for a ticket: the Google redirect, `enterDoor`, `issueSiteTicket`, the KMS signature and the post to a site's `/_door`. The gate each site runs is not here; it is in reef's `@coralreefventures/site-tools`. Nothing is built. The slice is a draft: its entrypoint and claims are planned paths, which Intentset reports as warnings until the slice leaves draft (VSA §3). Layers and resources are empty until the code exists.

## Public contract

None yet, and no contract record.

## Verification

Planned: `apps/web/e2e/door.spec.ts`. No verification records exist yet; they are written with the tests.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.1 and §2.7.
