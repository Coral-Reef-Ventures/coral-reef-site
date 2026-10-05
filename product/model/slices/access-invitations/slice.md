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
      presentation: [apps/web/src/features/access/invitations/*.tsx, apps/web/src/features/access/invitations/index.ts]
      application: [apps/web/src/features/access/invitations/model.ts]
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

Planned owner of invitations: creating them, binding them to the first identity that accepts, revoking, restoring, rebinding, grants, and erasing a person. The admin views are built in PR 1.5 against an AdminApi interface that a stub implements until the backend is bound; the backend and the sign-in binding are still planned. The slice stays a draft. Its policy and model layers are empty: model.ts holds view logic over the seam's types (filters, validation, labels), which is application, and the business rules are the backend operations'.

## Public contract

None yet, and no contract record.

## Verification

Planned: `apps/web/e2e/deployed.spec.ts`. No verification records exist yet; they are written with the tests.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.1 and §2.7.
