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
      presentation: []
      application: []
      policy: []
      model: []
      external: []
    claims:
      - kind: source
        path: apps/web/src/features/people/activity/**
      - kind: backend
        path: amplify/areas/people/**
    usesResources: []
---

# Activity slice

## Responsibility

Planned owner of the one Activity timeline and the people spine under it: Person, PersonEmail and Activity, and the admin's list of recent Activity by area. Nothing is built. The slice is a draft: its entrypoint and claims are planned paths, which Intentset reports as warnings until the slice leaves draft (VSA §3). Layers and resources are empty until the code exists.

## Public contract

None yet, and no contract record.

## Verification

None. No verification records exist yet; they are written with the code.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.1 and §2.7.
