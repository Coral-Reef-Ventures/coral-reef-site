---
markset: 0
---

{.eyebrow}
Article · 12 November 2026

# Intentset before scale

{.lead}
A school assessment app wrote down what it promises before agents took on most of its work. In the twelve days after, it merged more pull requests than in the rest of the year so far, and writing it down found security gaps that code review had not.

## An app about to grow

This is the first of three adoption stories from one education company, which has adopted [Intentset](https://intentset.org) in three of its repositories. Each started from a different place. This one started from a deadline.

The app is the web front end of an assessment platform used by schools. Teachers and staff write test questions and reading passages in it, assign learning pathways, read reports and manage their accounts. It is twenty months old, about 265,000 lines of code, and it sits beside a much older server application that keeps half of most of the promises the app makes.

In October it was about to grow. Assessment screens were moving in from the older application, and a whole suite of internal staff tools was to be rebuilt inside it, with agents doing most of the writing. The team's decision record put the problem plainly: nothing tied what the app promises teachers and staff to the code that delivers it or the test that proves it. Reviewers read code changes, not product behavior. At the volume that was coming, the diff could not be where the product was decided.

So the record came first.

## Two days of adoption

The team adopted Intentset in a deliberate order, over two days:

1. A pilot on one capability, written as 125 records.
2. Boundaries for the agents: they never merge or deploy.
3. Test evidence on every CI run, recording which promises passed on which commit.
4. Every slice of the app mapped, with an architecture check over the whole repository and a baseline of 97 violations that could only shrink.
5. The drift review: a pull request that changes a slice's code without changing its records fails, unless it says outright that no behavior changed.
6. The old dependency linter retired. It turned out it had never run in CI.
7. The baseline taken from 97 to zero in a day, then strict mode with no baseline at all.
8. Every slice staying in the app modeled, with a report of every gap the modeling found and a brief of the decisions only the product owner could make.

## What writing it down found

Writing a behavior down from the code means reading the code as a promise. Read that way, about 90 numbered gaps and 28 product questions came out of the modeling. The product owner answered every question the same day.

Some of the gaps were security gaps, in the older server the app relies on:

- Signing in silently built the new person's session on top of the previous one, without a fresh session. Every sign-in now starts a new session, with tests that fail on the old code.
- Reading passages, the texts students answer questions about, could be read and edited by anyone signed in who had a passage's id. Reads and writes now check access, and a refused passage looks exactly like a missing one.
- Pathways and reports outside a school's license were hidden by the browser, not refused by the server, and a teacher could read data meant for administrators. The decisions brief asked whether the server could be relied on to refuse these. Before recommending an answer, the agent checked. It could not.
- One handler computed its permission checks and then never enforced them. It does now.

Each was fixed in the older server within a day or two of being found.

Others were plain behavior bugs, the kind that survive because nobody had written down what should happen:

- A refused sign-in still ran the steps for a successful one, and the "Invalid login" message could never appear.
- Removing an unsaved answer choice moved the correct-answer mark to a different choice.
- A teacher who typed the administrators' address saw the administrators' cards.
- In the pilot itself, the capability broke one of its own written rules: it fetched again every time the window regained focus. Three new tests failed on the old code.

And some were about the tests. Several functions were never called. One test passed only because it mocked the wrong route, and two asserted nothing. Thirteen of the pilot's rules were checked only by the older server's tests, which its CI never ran. It runs them now.

## Then the scale

Before adoption the app merged about four pull requests a week. In the twelve days after the gates went on, it merged 186, and 122 in a single week. The staff-tools rebuild started the day adoption closed.

The app now holds 2,883 records, 1,822 of them verifications bound to tests. Every change to a slice's code either changes what its records say or states that it did not change behavior, so the record stays true at that pace without anyone reading every diff.

The team made one trade-off openly. During adoption the records came faster than a person could review them, so they were approved in bulk and marked for review later, rather than holding the work back. The gates kept running all the same: an approved promise still has to be verified by a test that passes on the commit.

## What we take from it

The record paid for itself before the scale arrived, in what it found on the way in. It was the gates, more than the records alone, that made the pace safe: once every change has to say which promises it touched, a person can follow the product at a speed nobody could follow the diffs.

The [second story](/articles/intentset-in-a-million-lines/) is the company's largest repository, part way through the same work.
