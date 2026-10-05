---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/slice/0.1
  id: SLICE-ACCESS-INVITATIONS
  type: slice
  title: Invitations slice
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  links:
    implements: [BEH-SECOND-IDENTITY-REFUSED, BEH-REVOKED-REFUSED]
    informedBy: [ADR-AREAS]
  slice:
    kind: product
    domain: access
    entrypoints: [apps/web/src/features/access/invitations/index.ts]
    layers:
      presentation: []
      application: []
      policy: []
      model: []
      external: []
    claims:
      - kind: source
        path: apps/web/src/features/access/invitations/**
      - kind: backend
        path: amplify/areas/access/**
      - kind: backend
        path: amplify/auth/pre-token-generation/**
      - kind: verification
        path: apps/web/e2e/deployed.spec.ts
    usesResources: []
---

# Invitations slice

## Responsibility

Planned owner of invitations: creating them, binding them to the first identity that accepts, revoking, restoring, rebinding, grants, and erasing a person. Nothing is built. The slice is a draft: its entrypoint and claims are planned paths, which Intentset reports as warnings until the slice leaves draft (VSA §3). Layers and resources are empty until the code exists.

## Public contract

None yet, and no contract record.

## Verification

Planned: `apps/web/e2e/deployed.spec.ts`. No verification records exist yet; they are written with the tests.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.1 and §2.7.
