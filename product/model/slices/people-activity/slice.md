---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/slice/0.1
  id: SLICE-PEOPLE-ACTIVITY
  type: slice
  title: Activity slice
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  links:
    informedBy: [ADR-AREAS]
  slice:
    kind: technical
    rationale: 'The one Activity timeline and the people spine under it are written to by every slice and own no product policy; each slice decides what to record.'
    domain: people
    entrypoints: [apps/web/src/features/people/activity/index.ts]
    layers:
      presentation: [apps/web/src/features/people/activity/*.tsx, apps/web/src/features/people/activity/index.ts]
      application: [apps/web/src/features/people/activity/model.ts]
      policy: []
      model: []
      external: []
    claims:
      - kind: source
        path: apps/web/src/features/people/activity/**
      - kind: backend
        path: amplify/areas/people/**
      - kind: backend
        path: amplify/functions/retention/**
    usesResources: []
---

# Activity slice

## Responsibility

Planned owner of the one Activity timeline and the people spine under it: Person, PersonEmail and Activity, and the admin's list of recent Activity by area. The admin views are built in PR 1.5 against an AdminApi interface that a stub implements until the backend is bound; the backend and the sign-in binding are still planned. The slice stays a draft. Its policy and model layers are empty: model.ts holds view logic over the seam's types (filters, validation, labels), which is application, and the business rules are the backend operations'.

## Public contract

None yet, and no contract record.

## Verification

None. No verification records exist yet; they are written with the code.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.1 and §2.7.
