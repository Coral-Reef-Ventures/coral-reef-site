---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/behavior/0.1
  id: BEH-SUBMISSION-STORED-NOTIFIED
  type: behavior
  title: A submission is stored and Gary is notified
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

# A submission is stored and Gary is notified

## Behavior

A valid submission is written, with an Activity `interest.submitted`, in one transaction. Then a plain-text SNS message tells hello@coralreefventures.com the site, the interests and a link to review it; the visitor's name and address are included, marked as unverified, and their message is not.

## Preconditions

The fields pass validation and the honeypot is empty.

## Outcomes

Success: the visitor sees the thank-you, and the submission is in the admin view as `new`. Failure: a failed notice is logged and never loses the submission; an invalid field is answered on that field before anything is written.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
