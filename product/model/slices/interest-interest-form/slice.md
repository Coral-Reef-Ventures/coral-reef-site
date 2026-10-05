---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/slice/0.1
  id: SLICE-INTEREST-INTEREST-FORM
  type: slice
  title: Interest form slice
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  links:
    implements: [BEH-FLOOD-BLOCKED, BEH-SUBMISSION-STORED-NOTIFIED]
    informedBy: [ADR-AREAS]
  slice:
    kind: product
    domain: interest
    entrypoints: [apps/web/src/features/interest/interest-form/index.ts]
    layers:
      presentation: []
      application: []
      policy: []
      model: []
      external: []
    claims:
      - kind: source
        path: apps/web/src/features/interest/interest-form/**
      - kind: backend
        path: amplify/functions/interest/**
      - kind: backend
        path: amplify/areas/interest/**
      - kind: verification
        path: apps/web/e2e/form.spec.ts
    usesResources: []
---

# Interest form slice

## Responsibility

Planned owner of the interest form and its handler: the fields and their limits, the thank-you and the rate-limited answer on the door, and `submitInterest` with its WAF rules, counters and the notice. Nothing is built. The slice is a draft: its entrypoint and claims are planned paths, which Intentset reports as warnings until the slice leaves draft (VSA §3). Layers and resources are empty until the code exists.

## Public contract

None yet, and no contract record.

## Verification

Planned: `apps/web/e2e/form.spec.ts`. No verification records exist yet; they are written with the tests.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.1 and §2.7.
