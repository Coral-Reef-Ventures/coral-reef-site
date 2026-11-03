---
markset: 0
---

{.eyebrow}
Article · 25 November 2026

# Intentset before launch

{.lead}
A new product for teachers, a month old and not yet released, wrote down its 41 behaviors and bound every promise to the test that proves it, in one pull request. Everything it found, it found while nobody depended on the product yet.

## The cheapest moment

This is the third of three adoption stories from one education company. The [first](/articles/intentset-before-scale/) adopted [Intentset](https://intentset.org) before a rebuild, and the [second](/articles/intentset-in-a-million-lines/) is adopting it across a million lines. This one is small and new, and that is the point.

The product lets teachers search a curated set of printable classroom resources, such as worksheets and graphic organizers, by keyword, grade, subject and curriculum standard. They can preview a resource in the page, print or download it, and save it to a list of their own. A second screen lets staff curators approve, reject or park resources, edit their details and preview what a teacher will see. It runs inside the company's existing apps.

It is a month old, about 18,000 lines with 838 tests, and it has not launched. Before launch is the cheapest moment to write down what a product promises. Nothing else depends on it yet, and every gap found is a gap no customer has met.

## One setup, copied unchanged

The team didn't design its adoption. It copied the setup the company's largest repository already runs: Intentset in strict mode with no baseline, the same pinned version, and the same three checks in CI (validation, strict validation and the drift review). The checks need no secrets and finish within a five-minute limit.

Then it wrote the product down: 380 records in all. Four capabilities (search, resources, saved lists and curation) hold 41 behaviors and 64 rules, and 232 verifications name an existing test, file and exact title. Seven slice records say what each part of the code owns, which other parts it may use, and what it exposes.

The drift review stayed off until the behavior records existed, and went on in the next commit. From then on, code and records change together.

## Rules that never fired

The product already had architecture rules, in a dependency linter. Earlier, the team had found that its boundary rules had never fired: they matched a folder layout the package manager doesn't use, so they passed everything. A self-test now plants one violation per rule and proves each one fails.

When Intentset came in, the team measured it the same way, one probe file per rule. Intentset's strict check replaced 10 of the 18 rules, and 8 were kept. It also enforces three things the linter never did: every file belongs to exactly one slice, every import across slices is declared, and a test may reach into its own slice only.

Making the code pass took a few small fixes. Routers had reached into slices for their loading screens, a shared test setup reset two slices' private state, and one test imported a private error type. None of them changed behavior.

## What writing it down found

Writing each behavior down from the code turned up the seams a reviewer reading a diff would miss:

- A message confirmed that a resource had been removed from a teacher's list before the removal succeeded.
- A line promising that the list is private showed in a fallback mode where it did not apply as written.
- When two curators work the same queue, one can overwrite the other's newer decision, and paging can skip resources between them.
- An analytics event was declared and never sent. Two input limits were defined in two places, and the browser's field limits were kept in step with the server's by hand, with no test to notice if they drifted.
- The documented interface was shorter than the real one.
- Seven things the product does had no test at all, from printing in the preview to the delay before search suggestions appear.

None of these is dramatic, and that is why they matter. Each is now recorded on the behavior it affects, where the next person or agent working on that behavior will find it, instead of in a review thread nobody will read again.

## What we take from it

A new repository gets the most from Intentset for the least effort. Adoption here was one pull request, set up by copying a working configuration from a sister repository. The architecture check holds the shape of the code from its first month. Every promise is bound to a test before anyone depends on it, and every gap was found while fixing it was still cheap.

Across the three stories the order changes, but the finding doesn't: writing down what the product promises, and checking the code against it, finds what review alone does not.
