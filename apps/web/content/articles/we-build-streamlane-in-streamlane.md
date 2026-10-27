---
markset: 0
---

{.eyebrow}
Article · 5 November 2026

# We build Streamlane in Streamlane

{.lead}
How an agent takes a piece of work from an item to a merged change in seven stages, and why every change still traces back to a decision a person made.

## The item is the brief

Streamlane is work management built for teams and agents. We build it with Claude, and we track that work in Streamlane itself, in a team of its own. More than 800 pull requests merged into Streamlane in its first four weeks.

Nobody reads 800 diffs. What a person can do is decide what each change is for before it is written, and check that it did that. Everything below is built around that.

Every change starts as an item: a task, a bug or an idea, written in plain language, with acceptance criteria where they help. The item is the brief. It is also where everything about the work ends up, so the next person, or the next agent, can find it without asking.

## Seven stages, on the item

When work starts, the item gets a working session with seven stages: Review, Refine, Spec, Build, Review environment, Feedback and Ship. The item's page shows them as a strip with the current one marked, and says whose move it is: the agent's, or a named person's. The stage moves as the work does. A person can move it by hand only by giving a reason, which the item's history keeps.

:::figure[A task in Ottervale, the invented company in Streamlane's demo, at its Feedback stage. Its pull request is in review, people have tried the change in its review environment, and the session waits on the agent to answer their comments.]{.shot}
![A Streamlane task page. Under the title, a delivery strip reads "In review · PR #120". A Working session panel shows seven stages with Review through Review environment ticked and Feedback current, and says it is waiting on the agent: it works through feedback round 1, answering each comment in its thread. Below it, a Review environment card for pr-120 has a Review it button and reads "Round 1 · 2 comments · 1 waits for an answer". The properties on the right show the branch and pull request #120, open.](/pictures/we-build-streamlane-in-streamlane/feedback-stage.png)
:::

A person starts the agent from the item, either by opening it in Claude Code or by assigning it to Claude, which runs it in the repository on GitHub. Either way the agent signs in as that person, with their rights and nothing more, and everything it does on the item says it was Claude Code, for them.

## The agent asks instead of guessing

Before it changes any code, the agent reads what the product already promises in the area it is about to touch: the behaviors, the rules each one keeps, and the code accountable for each.

It posts its review and its plan on the item. When it needs a decision, it asks on the item, and the question waits in that person's Inbox until they answer it in its thread. Meanwhile the session says it is waiting on them. The agent does not guess at product decisions, and it does not quietly settle an ambiguity that a person should settle.

:::figure[Another task in the same demo. Claude Code, working for the task's assignee, posts its plan, then asks the question the plan left open. The question waits for a person's answer.]{.shot}
![Two comments on a task, both by "Claude Code for Tomás Lindqvist". The earlier one is a plan: keep the offer's expiry on the waitlist entry, check it when the reminder job runs, and offer the slot to the next client once it passes; nothing yet says what happens outside opening hours. The later one, marked Needs an answer, asks whether an offer made at 7pm should expire at 9pm or two hours after the clinic opens the next morning.](/pictures/we-build-streamlane-in-streamlane/question-and-plan.png)
:::

Each person has one list of the work in motion: every session they started or that waits on them, across teams, with its stage.

## The change carries its own account

The agent opens a pull request that names the item, so the two link up and the item shows the pull request and its checks. The pull request carries the code, and it also carries the change to the product's written promises, kept as [Intentset](https://intentset.org) records beside the code: which behaviors were added or changed, and which rules now apply.

The gates run on every pull request: formatting and lint, duplication, types, unit and contract tests, and a review of the product's records against what changed in the code. A change to the code with no change to what the product says it does fails that review, unless the change states outright that no behavior changed. So does an approved promise that no test verifies.

When a person should try the change, the pull request gets its own review environment, opened from the item. Their comments come back to the agent as a round of feedback, which it answers comment by comment and closes with its next push. An acceptance criterion they tick there records the environment and the commit it was checked on.

## A person approves what the product should do

The session cannot move past Spec while the change's records wait for approval. A person reads them in the item's Spec section, as what the product will do rather than as a diff, and approves them there. The approval is committed to the pull request in their name, and a check on the pull request reports it.

The agent never approves its own work, and the tooling refuses an approval from an agent's sign-in outright. Once the records are approved and every gate is green, the agent merges. Production is different: a person starts every deploy to it.

This is the part that matters most to us. The point isn't speed, though it is fast. The point is that every change still traces back to a decision a person made, written down where the next person can find it.

## Why we work this way

We are building tools for teams whose software is increasingly written by agents. The fastest way to learn what those teams need is to be one. Every rough edge we hit building Streamlane this way becomes an item in Streamlane, and waits for a person in the same Triage as everything else.

Streamlane is in development and open to invited guests. If you want to see it, [get in touch](/get-involved/).
