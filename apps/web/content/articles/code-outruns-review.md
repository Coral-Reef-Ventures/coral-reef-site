---
markset: 0
---

{.eyebrow}
Article · 28 October 2026

# Code outruns review

{.lead}
An agent can open more pull requests in an afternoon than a team can review in a week. When the diff can no longer be where the product is decided, something else has to be.

## The review was always doing two jobs

Code review has long carried two jobs at once. The visible one is checking the code: is it correct, is it safe, does it fit the codebase. The quieter one is deciding the product. A reviewer who asks "should it really behave like that?" is making a product decision, and the pull request is where many of those decisions were actually made.

That worked while people wrote the code, because the pace of writing set the pace of deciding. A change arrived at the speed someone could type it, and someone else could read it at roughly the same speed.

## Agents broke the pace

Coding agents now make changes across files, run the tests and prepare the work for review. Turning a clear requirement into a working change has become the easy part. The volume of change goes up, and the time a person has for each one goes down.

Teams respond the way anyone would. They read less of each change. They lean on the summary at the top. They approve when the tests pass. Each of those is reasonable, and together they mean the product decisions inside each change are no longer being made by anyone in particular.

A large diff can hide a consequential change in behavior. A short summary can hide uncertainty just as easily. A passing test run shows that the tests that exist pass, not that every rule the product keeps has a test, or that the result belongs to the commit being shipped.

## The failure is drift, not bad code

What goes wrong is rarely a bad line of code. It is decisions nobody recorded. One area handles a case one way and the next area handles it another, because each agent session, like each person before it, resolved the ambiguity in front of it. Each decision was reasonable. Together they make a product nobody decided on.

Customers feel it first: the part of the product they learned behaves differently from the part they open next. By the time the team asks what the product is meant to do, the answer has to be reconstructed from code, tickets and memory.

Several agents at once make it faster. Two agents changing different code can still break a promise that spans both, if nothing says which code is accountable for which behavior.

## Move the decision earlier and higher

If the diff can't be where the product is decided, the decision has to happen before the code, and be written where every person and agent can find it.

That means a readable account of what the product promises: its behaviors, the rules each one keeps, the code accountable for each, and the evidence that each still holds on this commit. People agree what it promises. Agents keep it current in the same commit as the code they change.

Review then asks a different question. Not "what did this change do?", line by line, but "which promises did it change, and did it keep the rest?" That question has a short answer even when the diff is long, and a person can answer it.

## Review the product, not the diff

None of this makes code review go away. It gives the code review a smaller, clearer job, and gives the product decision a home of its own.

This is the problem everything we build at Coral Reef Ventures is aimed at. [Intentset](https://intentset.org), an open foundation, is where that account of the product's promises lives, in the repository beside the code. The [whitepaper](/whitepaper/) sets out the whole argument, with its sources.
