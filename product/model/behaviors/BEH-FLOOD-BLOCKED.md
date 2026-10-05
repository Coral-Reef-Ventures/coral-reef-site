---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/behavior/0.1
  id: BEH-FLOOD-BLOCKED
  type: behavior
  title: A flood of submissions is blocked and cannot flood the inbox
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: CAP-INTEREST
  links:
    governedBy: [RULE-RETENTION-STATED]
    informedBy: [ADR-AREAS]
  availability:
    products: [PRD-CRV]
    releases: [phase-1]
    roles: [visitor]
    editions: [hosted]
    flags: []
---

# A flood of submissions is blocked and cannot flood the inbox

## Behavior

The form is limited at the edge by WAF (no more than 10 submissions or 300 requests of any kind from one address in five minutes) and in the handler by counters (3 an hour and 10 a day per source, 2 a day per email address), and at most 10 notices are sent a day.

## Preconditions

Requests arrive faster than a person would send them.

## Outcomes

Success: the first requests are stored and notified as normal. Failure: a request over a limit is answered `{ ok: false, retryAfter }` and writes nothing; the eleventh notice of a day is one "notices paused" message, and later ones send nothing. The submissions already stored are not lost.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
