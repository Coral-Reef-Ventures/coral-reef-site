---
markset: 0
intentset:
  spec: '0.1'
  profile: intentset/product/0.1
  id: PRD-CRV
  type: product
  title: The Coral Reef Ventures app
  status: draft
  owner: maintainers
  visibility: internal
  audiences: [engineering, product]
  revision: 1
---

# The Coral Reef Ventures app

## Scope

The app at coralreefventures.com is the one door in front of the family's locked sites and the system of record behind it. A visitor sees one page; someone interested in contributing, with funding or in another way, submits their details; someone who has been invited signs in with Google and is let into every site they were granted. Gary reviews submissions and sends invitations from an admin view. The same app is meant to grow into a CRM, licence management and billing, so its data is organised in areas (ADR-AREAS) that can join without a rewrite, but only what the door needs is built now.

The locked sites are streamlane.app and driftline.app. markset.org and intentset.org stay open, because they are open source and their published packages link to their documentation. The app is a Next.js and Mantine static export on Amplify Gen 2 in the coral-reef AWS project, us-east-2, with Cognito's Google sign-in and DynamoDB. The family source licence is with counsel, so identity and tenancy are this app's own small code on Amplify's `defineAuth` and stay out of the shared reef packages. The gate that each locked site runs lives in `@coralreefventures/site-tools`.

Every record in this model is a draft until Gary promotes it. Nothing here says a capability is available: the app is planned, and Phase 1 puts it on its own Amplify address before coralreefventures.com moves to it.

Out, in writing: a CRM, licence management and billing (later, and only joined to the data model, not built); email sent by the app itself (the notification goes through SNS in Phase 1); any tracking, cookie beyond what sign-in needs, or third-party script on the door.

## Open questions

- Who owns each area. Every record names `maintainers` until there are teams.
- The retention periods, which Gary confirms with the privacy page.

## Sources

- The locked door and the Coral Reef Ventures app plan (2026-10-04), §1 to §3.
- `docs/decisions/0001-the-door-and-the-app.md`.
