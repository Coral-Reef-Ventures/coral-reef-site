---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/rule/0.1
  id: RULE-RETENTION-STATED
  type: rule
  title: Every stored field has a stated period, and the privacy page quotes it
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
---

# Every stored field has a stated period, and the privacy page quotes it

## Constraint

Each kind of data the app stores has a retention period in `amplify/areas/retention.ts`, and `content/privacy.md` quotes the same constants. A test fails if they disagree. Logs name no personal value, and a rate-limit counter is keyed by a hash that cannot be reversed once the day's key is gone.
