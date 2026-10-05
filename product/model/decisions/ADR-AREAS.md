---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/decision/0.1
  id: ADR-AREAS
  type: decision
  title: Organise the app in areas inside one Amplify backend
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
---

# Organise the app in areas inside one Amplify backend

## Context

The app starts as a door, and is meant to become a CRM, licence management and billing. Those join the same people, so the data must be organised so that they can arrive without a rewrite. Intentset has two meanings for a grouping: a slice's `domain` is a product-oriented grouping, not a deployment boundary (Intentset VSA §1), and in the TypeScript + Amplify Gen 2 profile an area is also a backend of its own, joined to the others by one AppSync Merged API (profile §9). Streamlane took the second meaning because one schema and one writer had grown to serve the whole product. The door is small and has none of that pressure.

## Decision

Proposed: three areas now, and three reserved. They are folders and slice domains inside one Amplify backend, not backends of their own.

| Area | Owns | When |
| --- | --- | --- |
| people | Person, PersonEmail, Activity: the spine every other area points at | now |
| interest | Submission, Interest, SourceSite: what a visitor tells us | now |
| access | Invitation, AccessGrant, the site registry, tickets | now |
| crm | organizations, contacts, conversations, deals | reserved |
| licensing | the family source licence's keys: issue, verify offline, revoke | reserved |
| billing | Stripe: the contributor meter, tracked users | reserved |

Rules that keep the areas joinable: each model, enum and operation is declared once; a link across areas is an ID field, never a relation between models; there are no scans; ids are ULIDs, emails are lowercased, and every record carries `createdAt` and `updatedAt`. `.intentset/architecture.yaml` declares no `areas` until a split is needed.

## Consequences

Splitting an area into a backend of its own later is a move of files and a Merged API, not a redesign of the data. Until then the architecture check reads the area names as labels and enforces nothing between them. A slice's ID survives a move of its paths, so the draft slices' placeholder paths cost nothing to change.

## Open questions

- When one schema's stack limits make a split worthwhile. `stack-limits.test.ts` guards 450 resources and 900,000 bytes per stack and will say first.
- Which area owns the family source licence's keys, if the licence stays with counsel and the keys move later.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.3 (the rules) and §8.
- Intentset, `spec/vsa-0.1.md` §1 and `spec/profile-typescript-amplify-gen2-0.1.md` §9.
