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
    dependsOn: [SLICE-ACCESS-INVITATIONS, SLICE-PEOPLE-ACTIVITY]
  slice:
    kind: product
    domain: interest
    entrypoints: [apps/web/src/features/interest/submissions/index.ts]
    layers:
      presentation: [apps/web/src/features/interest/submissions/*.tsx, apps/web/src/features/interest/submissions/index.ts]
      application: [apps/web/src/features/interest/submissions/model.ts]
      policy: []
      model: []
      external: []
    claims:
      - kind: source
        path: apps/web/src/features/interest/submissions/**
    usesResources: []
---

# Submissions admin slice

## Responsibility

Planned owner of the admin's view of submissions: the table with its status filter, the detail with notes and status, and the Invite action that turns a submission into an invitation (the invitation itself is SLICE-ACCESS-INVITATIONS's). Built in PR 1.5 against an AdminApi interface that a stub implements until the backend is bound. The route files under apps/web/app/admin are composition, and the shared admin shell holds the table frame and the second-click confirm. The slice stays a draft. Application and model layers are empty because the slice has no use-cases of its own beyond what the backend operations do, and its types live in the infrastructure seam.

## Public contract

None yet, and no contract record.

## Verification

None. No verification records exist yet; they are written with the code.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.1 and §2.7.
