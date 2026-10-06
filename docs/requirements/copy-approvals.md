# Copy approvals

The approved words of coralreefventures.com live where they are served: the content files in `apps/web/content/`,
the product cards in `apps/web/lib/product-facts.ts`, and the strings in the components named below. This file
records what Gary approved, when, and why it reads as it does. It replaced `site-copy.md` on 2026-10-06, when the
content files became the copy's source.

**How copy changes.** New or changed copy goes into its file in a pull request, with an entry here marked
**proposed**. It goes live only once Gary approves it; the entry then gets the date. A change to anything marked
approved is proposed again until he approves the new words. Do not write marketing copy, domains, GitHub links,
contact channels or brand assets that are not recorded here; the one contact address is hello@coralreefventures.com.

## The door, `/` (proposed 2026-10-06)

`apps/web/content/door.md`, the page's title and description in `apps/web/app/page.tsx`, and the footer statement in
`apps/web/lib/site.tsx`. Rewritten at Gary's request on 2026-10-06: lead with the customer's outcome, explain the
problem before the products, show how they fit together as a direction rather than a dependency, give concrete
starting points (Intentset first, Markset directly, a design-partner conversation for Streamlane and Driftline), show
an illustrative worked example and the internal Intentset pilot, introduce the founder, and place the whitepaper
after the shared vision. The founder introduction is Gary's own text, given 2026-10-06, and is used word for word.

Before this, the door approved on 2026-10-05 read "Building for software teams in the agentic era." over the four
cards; it is in the history at `apps/web/content/door.md` before this change.

## The whitepaper, `/whitepaper/` (proposed 2026-10-06)

`apps/web/content/whitepaper.md`, and the PDF it came from at `/coral-reef-whitepaper.pdf` (`apps/web/public/`),
ungated. Gary's own text, "Keeping Product Intent Connected in Agentic Software Development" (whitepaper draft,
October 2026), given 2026-10-06, converted to Markset with his leave to reformat. The words are his; what changed is
form: the title in sentence case, the bracketed citations as links to the sources, the five lifecycle stages as a
steps list, the two tables as Markset tables, and dates written 2026-10-05.

## The product cards (approved 2026-10-03 and 2026-10-04)

`apps/web/lib/product-facts.ts`. The cards' taglines match each product's own home page word for word
(reef `docs/conventions.md`), so a card changes with its product's site.

- The areas name what each product handles: Documents (Markset), Intent (Intentset), Work (Streamlane), Usage
  (Driftline). "Product" fit neither Intentset nor Driftline (2026-10-03).
- Markset and Intentset take their sites' headlines as taglines and say who writes the documents and the records:
  agents, reviewed by people. Intentset's "Start with readable files" went, because its records are not meant to be
  written by hand (2026-10-04).
- Driftline's description does not open with "product analytics", which its own positioning rules out (2026-10-04).
- The open-source labels say how mature each is: Markset `Open source · v0`, Intentset `Open source · Early release`
  (confirmed 2026-10-04).
- Streamlane and Driftline read **Open to invited guests.** on the door and link nowhere for a visitor; a signed-in
  invitee sees **Continue to Streamlane** or **Continue to Driftline** (CRV-003, 2026-10-05).
- No dependency between the four products is implied (CRV-004).

## Get involved, `/get-involved/` (approved 2026-10-05)

`apps/web/content/get-involved.md`. The interest form (`#involved`) and the invitation sign-in (`#invited`), moved
off the home page on 2026-10-05. The page's name, path and anchors are also used by the locked sites' coming-soon
page and the invitation text, below.

### The interest form

`apps/web/src/features/interest/interest-form/`.

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

`apps/web/src/features/access/door-session/` and the pages under `/signed-in/` and `/signout/`.

| Moment | Copy |
|---|---|
| Signed out | Button: Sign in with Google |
| Signed out, arriving from a locked site (`?site=<id>`) | The site's name alone, above the button: Streamlane or Driftline. No sentence naming it is approved, so none is shown. |
| No invitation for that account | There is no invitation for that Google account yet. You can tell us about yourself in the form above. |
| A site's ticket was refused | That sign-in did not work. Please sign in again. |
| Working | Checking your sign-in… · Opening Google… · Opening the door… |
| Signed in, no site asked for | You are signed in. Then one link per invited site, "Continue to *site*", "Admin" for an admin, and "Sign out". |
| Sign-in failed | Sign-in did not work. Please try again, or write to hello@coralreefventures.com. Link: Try again |
| Returning from Google (`/signed-in/`) | Heading: Signing you in. Without scripting: Signing in needs scripting. |
| Sign out (`/signout/`) | Heading: Sign out. Signing you out… then You are signed out. On failure: Signing out did not finish. Close this browser window to end the session, or write to hello@coralreefventures.com. Link: Back to the door |
| Signed out (`/signout/done/`) | Heading: Signed out. Signing you out of the sites… then You are signed out of the door. The sites clear their own session within the hour. Without scripting: Your sign-in is ended. Each site clears its own session within the hour; back to the door. |

## Privacy, `/privacy/` (approved 2026-10-05)

`apps/web/content/privacy.md`, which Google's consent screen links to. Its periods are the plan's retention table
(§2.3a), confirmed by Gary with the page on 2026-10-05 (plan decision D3). They are constants in
`amplify/areas/retention.ts`, and `amplify/areas/retention.test.ts` holds the page to them, so a changed period changes
the page and needs his approval again.

The third-cookie sentence in "What your browser keeps" ("A third, kept for 30 days ...") is Gary's own wording,
approved on 2026-10-05 when he chose to keep the door's sign-back-in cookie (`__Host-crv_door_seen`, reef 0.4.0).

## Invitation text (approved 2026-10-05)

`invitationText` in `amplify/functions/access/operations/common.ts`: what "Copy invitation" in the admin view
prepares, for Gary to send from his own mail. *site list* is the invited sites by name ("Streamlane", "Driftline" or
"Streamlane and Driftline"), *address* is the invited email, and *door* is `https://coralreefventures.com`.

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

## The locked sites' coming-soon page (approved 2026-10-05)

Not this app's page: reef's gate (`@coralreefventures/site-tools`, `packages/site-tools/src/door/page.ts`) serves it
on streamlane.app and driftline.app to a page load without a session. It is recorded here because it is the door's
words on the products' domains. *Product* is the site's name.

| Part | Copy |
|---|---|
| Lockup | The product's mark and name |
| Heading | *Product* is coming soon. |
| Lead | Open for now to invited guests. |
| Button | Have an invitation? Sign in (to the gate's `/_door/signin`) |
| Link | Get involved (to `https://coralreefventures.com/get-involved/?site=<id>`) |

## The mark (approved 2026-10-03)

`packages/brand/icon.svg`, served as `apps/web/public/icon.svg`: a puffer fish on a coral tile (`#b8461f`), its spines
ending in dots. There is no social image, so the social card is text only.

## Layout notes (2026-10-02)

Four equal product cards; Markset violet, Intentset teal, Streamlane warm amber and Driftline sea blue as small
accents. On a phone the cards stack in the same order, names and status stay visible, and actions stay easy to tap.
No animations and no large images.
