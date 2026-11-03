---
markset: 0
---

{.eyebrow}
{{dateline}}

# Intentset in a million lines

{.lead}
A learning platform for schools is part way through writing down what it promises, one area at a time. In its first twelve days, the record found more than 500 gaps, and one modeled behavior led to four authorization fixes in four days.

## The largest of the three

This is the second of three adoption stories from one education company. The [first](/articles/intentset-before-scale/) adopted [Intentset](https://intentset.org) before a rebuild. This one is the company's largest repository, and the adoption is still under way.

The platform is an adaptive learning product for school districts. Students practice and build mastery of standards. Teachers see what each student should work on next. Curators review AI-generated questions into an item bank. Administrators run district reports, exports and scheduled deliveries. It has five product areas, each with its own backend, about 560,000 lines of code and another 450,000 of tests, some 26,000 of them. It is eight months old, and agents wrote most of the adoption's changes, each one read cold by separate reviewer and verifier agents before a person decided.

A codebase that size can't be written down in an afternoon. So the team did it in stages.

## In stages, area by area

**A pilot on one capability.** The district's mastery thresholds were written as 86 records. The pilot found 22 gaps in that one capability, and 13 more in how the model fitted the repository. Two were telling. The old architecture linter had four patterns that matched no file at all, so it passed while seven files broke the rules it was meant to enforce. And the capability's own end-to-end test would have failed if anything had run it, because it looked for a legend removed earlier. Nothing ran it.

**The whole repository on a baseline.** Every slice was mapped, and the architecture check started with 237 findings in a baseline that could only shrink. Five days later it was zero, and strict mode replaced the baseline.

**The gates in CI.** Validation and the drift review run on every pull request, and each CI run records which verifications passed on which commit.

**Then the areas, one by one.** Analytics, mastery, content, then platform and assessment. Each modeling pull request writes down what the code promises, and also writes a gap file: every place where the code, the docs, the screens and the tests did not agree. Fix waves follow the gap files.

## One gap, four fixes

The modeling of one teacher screen wrote down a rule: a learning map names a student in the map's own district. The server did not check that. Fixing it showed something worse. The district check in the data layer read the district from a fixed place in the request rather than from the input actually sent, so a hand-made request could write to another district's records on almost every district-scoped model.

The fix for that was read cold, and the review found the same hole on reads. The fix for reads was read cold, and the review found it in the check that keeps each student's own records to that student.

{.pull}
One modeled rule, four authorization fixes, four days.

The same modeling found that a student could list every map in the district, classmates' included, because only the browser filtered them; that background jobs took the word of the request about who started them; and that one route that runs AI calls checked no sign-in at all, though an earlier decision had required one. All of these are fixed, with tests.

## The ordinary contradictions

Most of what the gap files hold is not dramatic. It is the code quietly doing something other than what everyone believed:

- A concept graph's cycle check ran backwards. It accepted loops and refused valid chains.
- Reports scheduled for "every school day" ran on weekends.
- Exports were silently cut off at a million rows.
- A failed scheduled delivery was never retried.
- Curator decisions were recorded as made by "curator", not by the person who made them.
- One settings screen said "above this accuracy" in its label and "at least this accuracy" in its description. The code did "at or above".

Each was found by writing down the rule and then checking the code against it.

## Where it stood after twelve days

On 2 November, twelve days after the pilot:

:::metrics
| Measure | Value |
|---|---|
| Behaviors | 323 |
| Rules | 357 |
| Verifications | 2,400+ |
| Pull requests since the pilot | 298 |
:::

The behaviors and rules sit in 42 capabilities, and every verification is automated and bound to one of 749 test files. The platform's 46 feature documents had become knowledge records that the product's own help shows.

The gap files held 508 rows. 72 of them are defects, behavior the product should not have. About half the rows were fixed, and 29 waited on a product decision.

The team made one choice it records as temporary. The records came faster than the product owners could read them, so agents may approve their own drafts until the adoption closes, but only through a guard: a cold review, and a passing test for every verification. Every one of those approvals is listed for an owner to review. Many records were still drafts, and the last areas were being modeled.

## What we take from it

In a large codebase the value arrives before the record is finished. Each area written down turns up its own gaps, and the gaps are where the fixes come from. The cold review matters as much as the record: the chain of authorization fixes was found by reading each fix as carefully as the code it changed.

The [third story](/articles/intentset-before-launch/) is the opposite case: a new product, a month old, writing down its promises before its first release.
