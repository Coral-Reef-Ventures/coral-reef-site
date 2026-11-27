---
markset: 0
---

{.eyebrow}
{{dateline}}

# Tickets measure the wrong constraint

{.lead}
A ticket tracker counts how much work gets built. When agents do the building, that is the one thing a team is no longer short of.

## What a ticket was built to ration

Picture a restaurant whose kitchen can cook a hundred meals an hour, with one waiter to carry them. It serves as many meals as the waiter can carry. Counting meals cooked tells the owner nothing useful, because the kitchen was never what held the restaurant back. The step that limits everything else is called the constraint, and it is the only step worth measuring closely.

For as long as people wrote the code, the constraint in software was building. There were more ideas than engineer hours, so teams built tools to ration those hours. A ticket is a unit of someone's building time. Points estimate how much of that time it takes. A sprint is a budget of it, and velocity is how fast the team spends it. The board's columns follow a ticket through the building: to do, in progress, in review, done.

All of that made sense, and every part of it assumes that building is what the team is short of.

## The count that stopped meaning anything

A school assessment app we wrote about in November was merging about four pull requests a week. Then it began a rebuild with agents doing most of the writing.

:::metrics
| Pull requests merged | Count |
|---|---|
| A week, before | about 4 |
| The busiest week after | 122 |
:::

On a velocity chart that is about thirty times the output. The team didn't get thirty times bigger, and the people on it didn't get thirty times more hours to read, decide and check.

The same team said so in its own record. The written account of what the app promises came faster than a person could review it, so it was approved in bulk and marked for a proper review later. A larger platform at the same company hit the same limit: its records came faster than its product owners could read them. Twelve days in, 29 of its findings were waiting on a product decision.

We see it in our own work. More than 800 pull requests merged into Streamlane in its first four weeks, and nobody reads 800 diffs.

{.pull}
When building is cheap, a count of what got built measures the one thing you have plenty of.

## Three things that are now in short supply

When agents do the building, a team runs short of three other things. A ticket says very little about any of them.

**Deciding what to build.** An agent builds whatever the ticket says, including the parts the ticket left out. Where the description is silent, the agent picks an answer, and that answer becomes how the product behaves. A tracker records that a ticket exists and who holds it. It doesn't record whether anyone decided what the software should do, or who agreed to it.

**Trusting what was built.** "Done" is a status somebody set. It shows that a person, or an agent, considers the work finished. It doesn't show that the change does what was asked, or that the product's other promises survived it. [A test nobody ran](/articles/a-test-nobody-ran/) is about how wide that gap can be even when the tests are green.

**People's attention.** An agent can finish a change in twenty minutes, and the change can then wait two days for a person to answer a question or approve it. On the board, both show as "In review". The column doesn't say whose move it is, or how long they have had it.

## What the board shows on Monday

Imagine a team that hands most of its building to agents and keeps its board as it was. This is an illustration, not one of our stories, and you may recognize parts of it.

On Monday morning the board looks better than it ever has. Forty tickets moved to Done last week. The burndown is ahead of plan, and velocity has tripled.

The same week looks different from the inside. Three of those changes each settled the same question in a different way, because no ticket asked it. Eleven pull requests are waiting on one person, who is also the only one who can answer the two questions that block six more. A customer has found a behavior that changed, and nobody chose to change it.

Every number on the board is true. None of them is about the place where the work is stuck.

## Count the waiting, not the building

If building is no longer the constraint, measure the steps that are. Four numbers do most of it:

1. **Time from an agreed intent to production.** The clock starts when a person approves what the change should do, not when someone starts typing. A long time here means the work is stuck somewhere, and the next number says where.
2. **Time waiting on a person.** Of that total, how much was spent waiting for someone to answer, review or approve? For most teams working with agents this will be most of it.
3. **How often work comes back.** A change that takes three rounds of feedback was usually under-specified. It points at the first shortage, deciding, and not at the agent.
4. **How much of "done" has evidence.** Of the changes that shipped, how many have a check that ran and passed on the code that went out?

None of this means deleting your tracker. A team still needs to know who is working on what, and what is planned. The change is in what you count as progress.

## Where we are with this

We are not finished with this ourselves. Every piece of Streamlane work carries a session that says what stage it is at and whose move it is, the agent's or a named person's, and a question for a person waits in their inbox until they answer it. So Streamlane already records each wait. It doesn't yet show any of them as a number.

We are building that report now: the time from approved intent to production, and the time spent waiting on a person. We expect our own numbers to be uncomfortable, and we will publish what we learn.

## Three questions for your own tracker

You can check your own position this week, with the tools you already have. Take the last ten items your team finished.

1. **Where is the decision?** For each one, find where it says what the software should do, and who agreed to it. A ticket title doesn't count.
2. **What shows it works?** For each one, find the check that passed on the code that shipped. "It was merged" doesn't count.
3. **How long did it wait?** For each one, compare the time it was being built with the time it waited on a person.

If the building time is the smaller number, your tracker is measuring the kitchen. The [whitepaper](/articles/intent-is-the-work/) sets out the whole argument, and [We build Streamlane in Streamlane](/articles/we-build-streamlane-in-streamlane/) shows how one piece of work moves when the waiting is written down.
