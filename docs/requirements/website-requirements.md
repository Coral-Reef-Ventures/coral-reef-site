# Coral Reef Ventures website requirements v0.2

**Status:** v0.2, accepted. It was proposed on 2026-10-04 (plan step P8), and Gary accepted this file's requirement
text on 2026-10-06. The decision behind it is
[ADR 0001](../decisions/0001-the-door-and-the-app.md). The app has served coralreefventures.com since the cutover,
2026-10-05. The GitHub Pages page that met v0.1, CRV-007
included, was deleted with its tests on 2026-10-06, the day after the cutover, ahead of the planned 14 days.

## Purpose

Explain the company thesis, introduce four independent offerings, open Markset and Intentset to everyone, and be the
one door to Streamlane and Driftline: interest from anyone, entry for invitees. The site is also the company's system
of record for that interest and access.

*v0.1 read:* Explain the company thesis, introduce four independent offerings, and direct visitors to confirmed product
destinations. This is a concise company site, not a combined product application.

| ID | Requirement | Acceptance |
|---|---|---|
| CRV-001 | Build the door page: header, hero, product cards with the independence note, closing contact address, footer; and a Get involved page at `/get-involved/`: "Get involved" (the interest form), then "Have an invitation?" (Google sign-in), reached from the header. *Amended in v0.2; v0.1 was one page without the form and the sign-in. Amended 2026-10-05 at Gary's request: the form and the sign-in moved from the door page to their own page.* | Every copy section is present in a meaningful reading order, on the page the copy assigns it |
| CRV-002 | Present Markset, Intentset, Streamlane, and Driftline as distinct offerings | Separate names, descriptions, maturity labels, and independently configured destinations |
| CRV-003 | Use real status and destinations. *Amended in v0.2.* | Markset points to markset.org and Intentset to intentset.org, both open. Streamlane and Driftline read "Open to invited guests" and link to no product URL for a visitor without an invitation; a signed-in invitee sees "Continue to *product*" for each active grant |
| CRV-004 | Keep independent adoption explicit | Page states that the products need not be adopted together |
| CRV-005 | Support mobile and desktop | At 390px and 1440px, cards and text fit without horizontal scrolling or clipped controls |
| CRV-006 | Provide accessible navigation | Semantic heading order, visible focus, skip link, keyboard-accessible links, readable contrast, meaningful labels |
| CRV-007 | **Superseded** by CRV-009 to CRV-014 (2026-10-04, Gary's decision). *v0.1 read:* Keep first release simple and portable; no account, backend, signup form, tracking dependency, or external font is required. The Pages page meets it until it is retired. | |
| CRV-008 | Supply basic search/share metadata | Page title, description, canonical URL and social preview metadata; no invented brand assets |
| CRV-009 | Interest form. *New in v0.2.* | Name, email, organization, how they want to take part (funding, design partner, advisor, other), message, the site they came from, a honeypot. Stored with status and notes; a storage notice on the form; no cookie set; limited per source and per address; a submission creates no person record |
| CRV-010 | Invite-only Google sign-in. *New in v0.2.* | Only an invited, verified Google address gets an account, and the invitation binds to the first Google identity that accepts it; anyone else is offered the form, prefilled; password sign-up is refused; a revoked invitee, another identity with the same address, or an invitee whose address has changed cannot sign in or refresh until an admin acts |
| CRV-011 | No tracking, no external font, no third-party script. *New in v0.2.* | Nothing loads from another origin except the AWS endpoints the form and sign-in need; storage only for sign-in tokens, the form's guest identity id and the scheme word; a /privacy/ page says what is stored, why, and for how long, and how to have it erased |
| CRV-012 | Admin views. *New in v0.2.* | Admins (Cognito group) review submissions by status, add notes, invite from a submission with site checkboxes, list, revoke, restore and rebind invitations, delete a person or erase an address, and see Activity |
| CRV-013 | Notification. *New in v0.2.* | Each submission notifies hello@coralreefventures.com with a link to it in the admin view, at most 10 a day, in plain text with the visitor's words marked as unverified; a failed notice never loses a submission |
| CRV-014 | The lock. *New in v0.2.* | streamlane.app and driftline.app serve nothing, not even a static asset, to a visitor without a valid door session: a page load gets the gate's own coming-soon page, anything else an empty 401, and a host not allowed a 403; the leak check proves it daily on every host |

## Content authority

The content files in `apps/web/content/`, the product table in `apps/web/lib/product-facts.ts` and the components'
own strings are the copy. Copy can be written and changed without approval (Gary, 2026-10-06). It never invents a
fact: no domain, link, contact address, price, legal or privacy claim, or claim that is not true today. A product links
out only to a confirmed destination; the one contact address is hello@coralreefventures.com; the privacy page quotes
the retention periods in `amplify/areas/retention.ts`, and a changed period is a decision (D3) that changes the page in
the same commit. The founder note on the door and the whitepaper are Gary's own text (2026-10-06); the whitepaper is
kept only at `/whitepaper/`, with no PDF beside it.

`/get-involved/` and its anchors `#involved` and `#invited` are linked from outside the app, by reef's gate on the
locked sites' coming-soon page and by the invitation text, so they do not move without those.

### The product cards

- Each card's tagline matches its product's own home page word for word (reef `docs/conventions.md`), so a card
  changes with its product's site.
- The areas name what each product handles: Documents (Markset), Intent (Intentset), Work (Streamlane), Usage
  (Driftline).
- Markset and Intentset are open foundations, never "products"; their documents and records are written by agents and
  reviewed by people, not written by hand.
- Driftline's description does not open with "product analytics", which its own positioning rules out.
- The maturity labels were confirmed 2026-10-04: Markset `Open source · v0`, Intentset `Open source · Early release`.
- Streamlane and Driftline read "Open to invited guests." for a visitor and link nowhere; a signed-in invitee sees
  "Continue to Streamlane" or "Continue to Driftline" (CRV-003).

## Visual direction

Generous whitespace, large readable typography, subtle coral/network suggestion, four restrained product accents. Preserve product identity. Do not imply that Markset or Intentset is a paid prerequisite to Streamlane.

Layout notes (2026-10-02): four equal product cards; Markset violet, Intentset teal, Streamlane warm amber and Driftline
sea blue as small accents. On a phone the cards stack in the same order, names and status stay visible, and actions
stay easy to tap. No animations and no large images. The mark is `packages/brand/icon.svg`; there is no social image,
so the social card is text only.

## Launch gates

Review product claims and availability; confirm outbound links; test responsive behavior and keyboard navigation;
verify metadata and broken links. The leak check (`scripts/leak-check.ts`) green on every host of each locked site, daily.

Hosting is decided by ADR 0001: the app on Amplify in the coral-reef project (us-east-2), serving coralreefventures.com
since 2026-10-05. GitHub Pages served the v0.1 page until the cutover and was turned off on 2026-10-06.
