---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/outcome/0.1
  id: OUT-INVITEES-ENTER
  type: outcome
  title: One sign-in opens every site an invitee was granted
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
  parent: INT-REAL-DOOR
---

# One sign-in opens every site an invitee was granted

## Measure

Not measured yet. The measure is stated here in full because Intentset 0.5.0, the release this model is validated with, has no measure record. With a release that has the measure type, it becomes a measure record under this outcome carrying the same fields.

- Metric (proposed): `invitees_entering_first_try`, the share of invitees in the window whose first Google sign-in ended on a granted site without a refusal or an admin's help.
- Baseline: unknown. There are no invitees yet.
- Target: not decided.
- Window: not decided.
- Direction: increase.
- Source (proposed): Activity `access.signed_in` and `access.ticket_issued` for the person, against the refusals the sign-in counts as a metric without an address.
- Method: for each invitation accepted in the window, whether a ticket was issued in the same sign-in.

## Open questions

- The target and the window.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §2.3 (Activity kinds) and §2.2 (the refusal metric).
