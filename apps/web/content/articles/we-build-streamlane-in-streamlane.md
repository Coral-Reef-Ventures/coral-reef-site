---
markset: 0
---

{.eyebrow}
Article · 28 October 2026

# We build Streamlane in Streamlane

{.lead}
How an agent takes a piece of work from an item to a merged change, and why every change still traces back to a decision a person made.

## The item is the brief

Streamlane is work management built for teams and agents. We build it with Claude, and we track that work in Streamlane itself, in a team of its own.

Every change starts as an item: a task, a bug or an idea, written in plain language, with acceptance criteria where they help. The item is the brief. It is also where everything about the work ends up, so the next person, or the next agent, can find it without asking.

## The agent works on the item, not around it

An agent picks the item up with the same rights as the person who started it, and nothing more. Before it changes any code, it reads what the product already promises in the area it is about to touch: the behaviors, the rules each one keeps, and the code accountable for them.

It posts its plan on the item. When it needs a decision, it asks on the item too, and the question waits in that person's Inbox until they answer it in its thread. The agent does not guess at product decisions, and it does not quietly resolve an ambiguity that a person should resolve.

As it goes, it records where it is on the item: reviewing, building, waiting on someone, done. Anyone looking at the item can see what is happening without opening a terminal.

## The change carries its own account

The agent opens a pull request that names the item, so the two link up. The pull request carries the code, and it also carries the change to the product's written promises: which behaviors were added or changed, and which rules now apply.

The usual gates run on every pull request: formatting and lint, types, unit and contract tests, and a review of the product model against what changed in the code. A change to the code with no change to what the product says it does fails that review, unless the change states outright that no behavior changed.

When a person should try the change, the pull request can get its own review environment, and their comments come back to the agent as a round of feedback on the item.

## A person approves what the product should do

The agent never approves its own work. The promises a change makes are approved by a person, on the item, and a check on the pull request reports whether they have been. The tooling refuses an approval from an agent's sign-in outright.

This is the part that matters most to us. The point isn't speed, though it is fast. The point is that every change still traces back to a decision a person made, written down where the next person can find it.

## Why we work this way

We are building tools for teams whose software is increasingly written by agents. The fastest way to learn what those teams need is to be one. Every rough edge we hit building Streamlane this way becomes an item in Streamlane.

Streamlane is in development and open to invited guests. If you want to see it, [get in touch](/get-involved/).
