# Coral Reef Ventures: one-page site copy and layout brief

**Version:** 0.1 • **Purpose:** Explain the organization, introduce four offerings, and direct visitors to product information. Visual direction: calm editorial layout, generous whitespace, subtle connected geometry, and distinct product accents without literal ocean imagery.

## Page order

Header → thesis/hero → four product cards, with the independence note beneath them → closing statement and contact address → footer. No navigation menu: the page is short, and the hero's "Explore our work" already leads to the cards. The contact channel is an email address (hello@coralreefventures.com), not a form. No GitHub organization or signup destination is invented.

## Complete page copy

**Brand:** Coral Reef Ventures

**Eyebrow:** DOCUMENTS · INTENT · WORK · USAGE

# Building for software teams in the agentic era.

Open foundations and focused tools for creating software with humans and AI working together.

**CTA:** Explore our work

## Four ideas. One direction.

AI is changing how software gets built. The surrounding systems—documents, product intent, work management, and how software is used—need to evolve with it.

Agents now write much of the code, the documents and the plans. Each of these tools keeps people able to read, steer and verify what they produce.

### Markset

**Documents your agents write, and people want to read.**

Markdown with a small, closed vocabulary of layout: cards, grids, tabs, metrics and charts. Agents write it from one guide and check their own work; people review plain text that reads as Markdown wherever it goes.

**Label:** Open source · v0  
**CTA:** Visit Markset →  
**Destination:** https://markset.org

### Intentset

**Keep control of what your agents build.**

Readable records of what your product promises, which code delivers each promise and how it is checked, kept current by your agents in the same commit as the code. People review the product, not the diff.

**Label:** Open source · Early release  
**CTA:** Visit Intentset →  
**Destination:** https://intentset.org

### Streamlane

**Work management built for teams and agents.**

A unified workspace for planning and moving work forward, designed as an alternative to fragmented Atlassian workflows. Built around agentic development, with close GitHub and Slack integration.

**Label:** Product · In development  
**Availability:** Not publicly available yet.  
**Destination note:** streamlane.app is the planned product destination. The review page shows this as text, not an invitation to start using the product.

### Driftline

**Know whether what you shipped is working.**

Knows what each release is meant to do, and watches real users meet it. When adoption stalls it asks them why, traces errors to the team that owns them, and runs feature flags and betas.

**Label:** Product · In planning  
**Availability:** Early access by request.  
**CTA:** Visit Driftline →  
**Destination:** https://driftline.app

*Added 2026-10-03:* Driftline joined as the fourth offering, and the section heading became "Four ideas. One direction." Its card copy was drafted and approved that day. The same day the areas were renamed so each names what its product handles: Documents (Markset), Intent (Intentset), Work (Streamlane) and Usage (Driftline). "Product" fit neither Intentset nor Driftline. The hero eyebrow, the thesis line, each card's kicker and the page title (Coral Reef Ventures · Documents. Intent. Work. Usage.) all use the four words.

*Revised 2026-10-04:* the products' own sites moved to the agent era, and three cards had fallen behind them. Markset and Intentset take their sites' headlines as taglines and say who writes the documents and the records: agents, reviewed by people. Intentset's "Start with readable files" went, because its records are not meant to be written by hand. Driftline's description no longer opens with "product analytics", which its own positioning rules out, and its card links driftline.app, live since that day with an early-access request. The two open-source labels now say how mature each is: Markset's specification is declared (v0), Intentset's is an early release. The second paragraph of the section became the through-line all four sites now share.

**Beneath the cards:** These offerings share a direction, not an adoption requirement. Use each where it helps your team.

*Revised 2026-10-02:* a separate "Documents. Product. Work." section, with a one-line role for each product, followed the cards in v0.1. It introduced the same three products a second time, and its framing is already carried by the hero eyebrow, the page title and each card's kicker, so it was removed and its independence note moved under the cards.

## Better foundations for what comes next.

We are building tools that make software work easier to understand, maintain, and share as the way we build it changes.

**Contact:** Get in touch at hello@coralreefventures.com (a mailto link).

**Footer brand:** Coral Reef Ventures  
**Footer statement:** Open foundations and focused products for software teams.  
**Copyright:** © 2026 Coral Reef Ventures

## Layout notes

Desktop: oversized headline across a restrained twelve-column composition; four equal product cards in two rows; a closing statement. Markset uses violet, Intentset uses teal, Streamlane uses warm amber, and Driftline uses sea blue as small accents. Mobile: hero becomes a readable narrow column; cards stack in the same order; product names and status stay visible; CTA targets remain easy to tap. Avoid animations and large images for the first version.

Public launch checklist: confirm product statements against actual releases, confirm logo/brand rights, approve license labels. Contact is decided: hello@coralreefventures.com, 2026-10-02. No dependencies between the four products are implied.

---

# Proposed: the door, its privacy page and the invitation (2026-10-04)

**Status: proposed.** Nothing below is approved yet. Gary approves it, with the retention periods and the requirement
changes in `website-requirements.md` v0.2, before coralreefventures.com moves to the app (plan step P8, ahead of the
Phase 2b cutover). Until then the sections above stay the approved record. The cutover came first, on 2026-10-05, so
the app serves this copy on coralreefventures.com while it awaits approval, and GitHub Pages, without the domain, still
serves the sections above until 2026-10-19.
The decision behind this copy is [ADR 0001](../decisions/0001-the-door-and-the-app.md).

This file is the source. The app's three content files are copied into it verbatim, below, and
`apps/web/lib/content.test.ts` fails if any of them differs from its block here. Change the copy here first and the
content file in the same commit.

## Door (proposed, 2026-10-04)

**Page order:** header → thesis/hero → the four product cards, with the independence note beneath them → closing
statement and contact address → footer. The approved hero, section, closing and footer copy is unchanged. "Get
involved" and "Have an invitation?" were on this page until 2026-10-05 and are now their own page, below. The header's
one link, "Get involved", goes there.

**Product cards.** Markset and Intentset keep their approved cards and links. Streamlane and Driftline keep their
names, taglines, descriptions and labels, and their availability line becomes **Open to invited guests.** Neither card
links anywhere for a visitor, because the sites behind the door would only send that visitor back here. A signed-in
invitee instead sees **Continue to Streamlane** and **Continue to Driftline**, one for each site they were invited to.
`{{products}}` is the four cards, generated from `site/products.ts` by `apps/web/lib/products.ts`.

**The page source,** `apps/web/content/door.md`.

```markdown file=apps/web/content/door.md
---
markset: 0
---

{.eyebrow}
Documents · Intent · Work · Usage

# Building for software teams in the agentic era.

{.lead}
Open foundations and focused tools for creating software with humans and AI working together.

[[Explore our work](#work)]{.button .down}

***

{#work}
## Four ideas. One direction.

{.lead}
AI is changing how software gets built. The surrounding systems—documents, product intent, work management, and how software is used—need to evolve with it.

Agents now write much of the code, the documents and the plans. Each of these tools keeps people able to read, steer and verify what they produce.

{{products}}

{.note}
These offerings share a direction, not an adoption requirement. Use each where it helps your team.

***

{.eyebrow}
Coral Reef Ventures

## Better foundations for what comes next.

{.statement}
We are building tools that make software work easier to understand, maintain, and share as the way we build it changes.

{.contact}
Get in touch at [hello@coralreefventures.com](mailto:hello@coralreefventures.com).
```

## Get involved page (proposed, 2026-10-05)

**Moved 2026-10-05, at Gary's request:** "Get involved" (the interest form) and "Have an invitation?" (the Google
sign-in) left the door page for a page of their own at `/get-involved/`, with their words unchanged. "Get involved" is
the page's heading, so it is an h1 where it was an h2; "Have an invitation?" stays an h2. The anchors `#involved` and
`#invited` stay with the sections. A visit to `/` that carries a locked site's sign-in request or a refused ticket (the
gate redirects to the door's origin), or names `#involved` or `#invited`, is forwarded to this page.

**Page order:** header → "Get involved" (the interest form) → "Have an invitation?" (Google sign-in) → footer. The page's
description is the "Get involved" lead.

**The page source,** `apps/web/content/get-involved.md`. `{{interest-form}}` and `{{sign-in}}` mark where the form and
the sign-in go; their words follow.

```markdown file=apps/web/content/get-involved.md
---
markset: 0
---

{#involved}
# Get involved

{.lead}
Interested in taking part with funding, as a design partner or as an advisor? Tell us who you are and what you have in mind.

{{interest-form}}

***

{#invited}
## Have an invitation?

{.lead}
Sign in with the Google account your invitation went to.

{{sign-in}}
```

### The interest form

| Part | Copy |
|---|---|
| Fields | Your name · Email · Organization (optional) · How you would like to take part · Message |
| Choices for taking part | Funding · Design partner · Advisor · Something else |
| A field is wrong | *Field* is required. · Choose at least one way to take part. · Enter a valid email address. · *Field* is too long. · *Field* is not valid. |
| Storage notice, above the button | We keep what you send here so we can read and answer it, and no longer than the privacy page says. Sending it creates no account. ("the privacy page" links to /privacy/.) |
| Button | Send (Sending… while it sends) |
| After sending | Thank you. Your details were sent. |
| Over a limit | Too many messages have come from here. Please try again *in about N minutes* (or *hours*, or *later* when no time is known), or write to hello@coralreefventures.com. |
| Could not send | Your details could not be sent. Please try again later, or write to hello@coralreefventures.com. |
| Message, prefilled after a refused sign-in | I tried to sign in with Google, and there is no invitation for that account yet. |

### The invitation sign-in

| Moment | Copy |
|---|---|
| Signed out | Button: Sign in with Google |
| No invitation for that account | There is no invitation for that Google account yet. You can tell us about yourself in the form above. |
| A site's ticket was refused | That sign-in did not work. Please sign in again. |
| Working | Checking your sign-in… · Opening Google… · Opening the door… |
| Signed in, no site asked for | You are signed in. Then one link per invited site, "Continue to *site*", "Admin" for an admin, and "Sign out". |
| Sign-in failed | Sign-in did not work. Please try again, or write to hello@coralreefventures.com. Link: Try again |
| Returning from Google (`/signed-in/`) | Heading: Signing you in. Without scripting: Signing in needs scripting. |
| Sign out (`/signout/`) | Heading: Sign out. Signing you out… then You are signed out. On failure: Signing out did not finish. Close this browser window to end the session, or write to hello@coralreefventures.com. Link: Back to the door |
| Signed out (`/signout/done/`) | Heading: Signed out. Signing you out of the sites… then You are signed out of the door. The sites clear their own session within the hour. Without scripting: Your sign-in is ended. Each site clears its own session within the hour; back to the door. |

## Privacy (proposed, 2026-10-04)

The page at `/privacy/`, which Google's consent screen links to. Its periods are the plan's retention table (§2.3a),
which Gary confirms at the same time (plan decision D3); once the backend exists they are constants in
`amplify/areas/retention.ts`, and a test holds the page to them.

```markdown file=apps/web/content/privacy.md
---
markset: 0
---

{.eyebrow}
Privacy

# What we keep, and for how long.

{.lead}
This page covers the interest form and the invitation sign-in on coralreefventures.com. There is no tracking, no analytics and no third-party script on this site.

## What the interest form stores

When you send the form we store your name, email address, organization, how you would like to take part, your message, the site you came from, and when we received it. We use it to read your message and reply. Nothing you type there creates an account or an invitation.

A submission we have not yet reviewed is kept until we review it. One we have declined or archived is deleted 12 months after that decision. One we turned into an invitation is kept as long as the invitation is.

## What the invitation sign-in stores

Sign-in is by invitation only, through Google. For an invited person we store the email address the invitation went to, the identity Google gives us for it, the sites the invitation covers, and a record of when it was sent, accepted or revoked. Google tells us your name and verified email address; we receive nothing else from your Google account.

An accepted invitation is kept while it is active, or until you ask us to erase it. A pending or revoked one is deleted 12 months after its last change. Sign-in records are kept for 12 months, and records that a site opened for you are kept for 90 days. A sign-in attempt by someone who was not invited is not recorded: we count it, and keep no address.

## What your browser keeps

Your browser keeps the sign-in tokens, an anonymous identity the form uses to send, and your choice of color scheme. The sites behind the door set two cookies of their own: one for 10 minutes when they send you here to sign in, and, once you have signed in with an invitation, one for an hour that proves it. Nothing here is used to follow you between sites.

## Logs and backups

Our server logs record that something happened, never who you are or what you wrote, and are deleted after 1 month. Deleted records can remain in backups for up to 35 days. A request limit keeps a count per source for 24 hours, under a key that is discarded each day.

Deletion happens within a few days after the date above, because the database removes expired records on its own schedule.

## Having your data erased

To see, correct or erase what we hold about you, or about an address someone else submitted, write to [hello@coralreefventures.com](mailto:hello@coralreefventures.com). We erase it, and the record of the erasure holds ids only.

## Google

Google's consent screen shows the address of our sign-in service and links to this page. Google's own privacy policy governs what Google does with your sign-in.
```

## Invitation text (proposed, 2026-10-04)

What "Copy invitation" in the admin view prepares, for Gary to send from his own mail; the app sends nothing itself
until it has SES (ADR 0001). *site list* is the invited sites by name ("Streamlane", "Driftline" or "Streamlane and
Driftline"), *address* is the invited email, and *door* is `https://coralreefventures.com`.

**Subject:** Your invitation to *site list*

> Hello,
>
> You are invited to *site list*, open for now only to invited guests.
>
> To come in, go to *door*/get-involved/#invited and sign in with Google using this address, *address*. The invitation
> belongs to the first Google account that signs in with it, so use the account this message came to.
>
> If anything does not work, reply to this message or write to hello@coralreefventures.com.
>
> Coral Reef Ventures
