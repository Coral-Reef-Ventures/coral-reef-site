---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/slice/0.1
  id: SLICE-INTEREST-SUBMISSIONS
  type: slice
  title: Submissions admin slice
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  links:
    implements: [BEH-ADMIN-INVITES]
    informedBy: [ADR-AREAS]
  slice:
    kind: product
    domain: interest
    entrypoints: [apps/web/src/features/interest/submissions/index.ts]
    layers:
      presentation: []
      application: []
      policy: []
      model: []
      external: []
    claims:
      - kind: source
        path: apps/web/src/features/interest/submissions/**
      - kind: source
        path: apps/web/app/admin/**
    usesResources: []
---

# Submissions admin slice

## Responsibility

Planned owner of the admin's view of submissions: the table with its status filter, the detail with notes and status, and the Invite action that turns a submission into an invitation (the invitation itself is SLICE-ACCESS-INVITATIONS's). Nothing is built. The slice is a draft: its entrypoint and claims are planned paths, which Intentset reports as warnings until the slice leaves draft (VSA §3). Layers and resources are empty until the code exists.

## Public contract

None yet, and no contract record.

## Verification

None. No verification records exist yet; they are written with the code.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.1 and §2.7.
