---
markset: 0
intentset:
  spec: '0.2'
  profile: intentset/slice/0.2
  id: SLICE-VISITS-PAGE-COUNTS
  type: slice
  title: Page counts slice
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  links:
    informedBy: [ADR-AREAS]
  slice:
    kind: technical
    rationale: 'The page counts answer one question for the owner, whether the site is read, and hold no product policy beyond what they leave out; the promise they keep is RULE-NO-TRACKING and RULE-RETENTION-STATED.'
    domain: visits
    entrypoints: [apps/web/src/features/visits/page-counts/index.ts]
    layers:
      presentation: [apps/web/src/features/visits/page-counts/*.tsx, apps/web/src/features/visits/page-counts/index.ts]
      application: [apps/web/src/features/visits/page-counts/model.ts]
      policy: []
      model: []
      external: []
    claims:
      - kind: source
        path: apps/web/src/features/visits/page-counts/**
      - kind: backend
        path: amplify/areas/visits/**
      - kind: backend
        path: amplify/functions/visits/**
    usesResources: []
---

# Page counts slice

## Responsibility

Owner of the site's page counts (CRV-017, accepted 2026-10-24): the PageCount model, crv-visits, the daily function that counts page requests by day, page and referring site from the host's own access logs, and the admin's Visits view of the last 30 days. It keeps aggregates only: never an address, a browser, a full referrer URL or anything that tells one visitor from another, so the site's promise of no tracking and no analytics holds (RULE-NO-TRACKING), and the counts expire after the 13 months the privacy page states (RULE-RETENTION-STATED). Gary accepted CRV-017 on 2026-10-24; the slice stays a draft until its verification records are written. Its policy and model layers are empty: model.ts holds the view's aggregation over the seam's types, which is application, and what counts as a page request is the backend function's.

## Public contract

None yet, and no contract record.

## Verification

None as records. The unit tests are `amplify/functions/visits/count.test.ts` and `handler.test.ts`, and `apps/web/src/features/visits/page-counts/visits.test.tsx`; `amplify/backend.test.ts` holds the function's grants and schedule, and `e2e/admin-flows.spec.ts` walks the view over the stub.

## Sources

- Gary's decision of 2026-10-24: count page requests per day from the hosting service's own logs, keep only aggregate counts, and say so on the privacy page.
