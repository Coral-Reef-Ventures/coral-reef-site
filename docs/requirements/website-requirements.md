# Coral Reef Ventures website requirements v0.2

**Status:** v0.2 is proposed (2026-10-04). Gary approves it with the door copy in `site-copy.md` (plan step P8) before
coralreefventures.com moves to the app. The decision behind it is
[ADR 0001](../decisions/0001-the-door-and-the-app.md). Until the cutover the GitHub Pages page (`site/`) still meets
v0.1, CRV-007 included, and its tests keep checking it; the old page and those tests go 14 days after the cutover.

## Purpose

Explain the company thesis, introduce four independent offerings, open Markset and Intentset to everyone, and be the
one door to Streamlane and Driftline: interest from anyone, entry for invitees. The site is also the company's system
of record for that interest and access.

*v0.1 read:* Explain the company thesis, introduce four independent offerings, and direct visitors to confirmed product
destinations. This is a concise company site, not a combined product application.

| ID | Requirement | Acceptance |
|---|---|---|
| CRV-001 | Build the door page: header, hero, product cards with the independence note, "Get involved" (the interest form), "Have an invitation?" (Google sign-in), closing contact address, footer. *Amended in v0.2; v0.1 was one page without the form and the sign-in.* | All approved copy sections are present in a meaningful reading order |
| CRV-002 | Present Markset, Intentset, Streamlane, and Driftline as distinct offerings | Separate names, descriptions, maturity labels, and independently configured destinations |
| CRV-003 | Use real status and destinations. *Amended in v0.2.* | Markset points to markset.org and Intentset to intentset.org, both open. Streamlane and Driftline read "Open to invited guests" and link to no product URL for a visitor without an invitation; a signed-in invitee sees "Continue to *product*" for each active grant |
| CRV-004 | Keep independent adoption explicit | Page states that the products need not be adopted together |
| CRV-005 | Support mobile and desktop | At 390px and 1440px, cards and text fit without horizontal scrolling or clipped controls |
| CRV-006 | Provide accessible navigation | Semantic heading order, visible focus, skip link, keyboard-accessible links, readable contrast, meaningful labels |
| CRV-007 | **Superseded** by CRV-009 to CRV-014 (2026-10-04, Gary's decision). *v0.1 read:* Keep first release simple and portable; no account, backend, signup form, tracking dependency, or external font is required. The Pages page meets it until it is retired. | |
| CRV-008 | Supply basic search/share metadata | Approved page title, description, canonical URL and social preview metadata; no unapproved brand assets |
| CRV-009 | Interest form. *New in v0.2.* | Name, email, organization, how they want to take part (funding, design partner, advisor, other), message, the site they came from, a honeypot. Stored with status and notes; a storage notice on the form; no cookie set; limited per source and per address; a submission creates no person record |
| CRV-010 | Invite-only Google sign-in. *New in v0.2.* | Only an invited, verified Google address gets an account, and the invitation binds to the first Google identity that accepts it; anyone else is offered the form, prefilled; password sign-up is refused; a revoked invitee, another identity with the same address, or an invitee whose address has changed cannot sign in or refresh until an admin acts |
| CRV-011 | No tracking, no external font, no third-party script. *New in v0.2.* | Nothing loads from another origin except the AWS endpoints the form and sign-in need; storage only for sign-in tokens, the form's guest identity id and the scheme word; a /privacy/ page says what is stored, why, and for how long, and how to have it erased |
| CRV-012 | Admin views. *New in v0.2.* | Admins (Cognito group) review submissions by status, add notes, invite from a submission with site checkboxes, list, revoke, restore and rebind invitations, delete a person or erase an address, and see Activity |
| CRV-013 | Notification. *New in v0.2.* | Each submission notifies hello@coralreefventures.com with a link to it in the admin view, at most 10 a day, in plain text with the visitor's words marked as unverified; a failed notice never loses a submission |
| CRV-014 | The lock. *New in v0.2.* | streamlane.app and driftline.app serve nothing, not even a static asset, to a visitor without a valid door session; the leak check proves it daily on every host |

## Content authority

`site-copy.md` is the editorial source. A product links out only to a confirmed destination. Do not invent domain
ownership or GitHub links. New copy is drafted in `site-copy.md` marked proposed, and goes live only once Gary approves
it.

## Visual direction

Generous whitespace, large readable typography, subtle coral/network suggestion, four restrained product accents. Preserve product identity. Do not imply that Markset or Intentset is a paid prerequisite to Streamlane.

## Launch gates

Review product claims and availability; confirm outbound links; test responsive behavior and keyboard navigation;
verify metadata and broken links; approve final copy. Door copy approved; the leak check green on every host.

Hosting is decided by ADR 0001: the app on Amplify in the coral-reef project (us-east-2), with GitHub Pages serving the
v0.1 page until the cutover.
