---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/outcome/0.1
  id: OUT-INTEREST-REVIEWED
  type: outcome
  title: Every submission is looked at within a week
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: INT-ONE-SYSTEM-OF-RECORD
---

# Every submission is looked at within a week

## Measure

- Metric: `submissions_reviewed_within_7d`, the share of submissions received in the window whose status left `new` within seven days of `receivedAt`.
- Baseline: unknown. The app has received no submissions.
- Target: 100%.
- Window: a calendar month.
- Direction: increase.
- Source: the Submission table, `receivedAt` and `statusAt`, read through the `byStatus` index. The admin view already flags a submission older than 30 days.
- Method: for each submission received in the window, whether `statusAt` of its first change is within seven days of `receivedAt`.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.3 (Submission) and §2.7.
