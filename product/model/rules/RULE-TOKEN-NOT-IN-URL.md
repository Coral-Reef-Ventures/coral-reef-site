---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/rule/0.1
  id: RULE-TOKEN-NOT-IN-URL
  type: rule
  title: A ticket or token is never in a URL
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
---

# A ticket or token is never in a URL

## Constraint

A ticket travels in the body of a POST and a session in a cookie, never in a query string or a fragment, so neither reaches a log, a referrer or a browser history. The `next` address is canonicalised by parsing, in the ticket's issue and again in the gate, and a value that is not the site's own is refused.
