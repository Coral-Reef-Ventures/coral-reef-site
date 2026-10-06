---
markset: 0
---

{.eyebrow}
Coral Reef Ventures

# Keep control as agents build your software.

{.lead}
Coral Reef Ventures is building open foundations and focused tools to connect product intent, the work that changes it, the checks that verify it, and what users experience.

{.actions}
[[Try Intentset](https://intentset.org/start/)]{.button .primary} [[Read the whitepaper](/whitepaper/)]{.button} [[Contact us](/get-involved/)]{.button}

***

{.eyebrow}
The problem

## Agents change the code. Your team still answers for the product.

{.lead}
After every change an agent makes, someone still has to answer three questions.

{.questions}
1. **Which product promises changed?** A diff shows lines, not behaviors.
2. **What evidence supports each one?** A test that exists is not a test that passed on this commit.
3. **Are users better off?** That shows up after the release, far from the code that caused it.

The answers sit in the code, the tracker, the test runs and what users report. Today, putting them together takes an investigation.

***

{.eyebrow}
The direction we are building toward

## One thread, from intent to feedback.

{.lead}
This is where the products are heading, not how they work together today. Markset and Intentset are open source; Streamlane is in development, and Driftline is in planning.

:::steps{.lifecycle}
1. **Intent.** Write down what the product promises, and who owns each promise. [Intentset]{.kicker .intentset}
2. **Work.** Plan each change and move it forward, with people and agents on the same work. [Streamlane]{.kicker .streamlane}
3. **Verification.** See which promises have a check passing on this commit, and which have no check at all. [Intentset]{.kicker .intentset}
4. **Release.** Know what each release is meant to do. [Driftline]{.kicker .driftline}
5. **Feedback.** Watch real users meet it, ask them why when adoption stalls, and take what you learn back to intent. [Driftline]{.kicker .driftline}
:::

{.foundation}
**Under every step, Markset.** Records stay readable Markdown that agents write and people review. Intentset's records are already Markset documents.

{.note}
None of the four requires another.

***

{.eyebrow}
Whitepaper

## The thinking behind it.

{.lead}
[WHITEPAPER SUMMARY: awaiting Gary]

{.actions}
[[Read the whitepaper](/whitepaper/)]{.button}

{.note}
Free to read, with no form and no sign-up.

***

{.eyebrow}
Where to start

## Try Intentset on one capability.

{.lead}
Have an agent model one capability your product already has, from its code, tests and decision records. Review what it wrote, and see which promises have a passing check, which only have one linked, and which have none. You do not need to reorganize your repository.

{.actions}
[[Try Intentset](https://intentset.org/start/)]{.button .primary}

{.paths}
- **Markset on its own.** For documents your agents write and people want to read, [start with Markset](https://markset.org).
- **Streamlane and Driftline.** Neither is publicly available yet. If your team wants to help shape one, [ask about becoming a design partner](/get-involved/).

***

{.eyebrow}
The products

## Four products. One direction.

{{products}}

{.note}
These offerings share a direction, not an adoption requirement. Use each where it helps your team.

***

{.eyebrow}
Illustrative example

## One behavior, its owner and its status.

Intentset keeps a short record like this for each behavior, beside the code that delivers it.

:::card[Example: Schedule an assessment]{.example}
- **Behavior:** A teacher chooses when a published assessment becomes available to a class.
- **Owner:** The assessment team, which owns the one slice of code that delivers it.
- **Verification:** Linked to one manual review. The review has not been run, so there is no pass to count.
- **Status:** Draft, until a person approves it. Agents never approve.

{.note}
Illustrative, adapted from Intentset's worked example for Lantern, an invented product. Not a live report.
:::

A linked check is not a passing one. Intentset counts a pass only when the check ran on the commit being reviewed.

***

{.eyebrow}
An internal pilot

## We tried it first on our own product.

On 2026-10-02 we ran an internal pilot of Intentset on Streamlane, one of Coral Reef's own products. An agent modelled one capability, how Streamlane marks work as blocked, from the code, tests and decision record already in the repository. It changed no code.

At the commit that added the records, all five behaviors it recorded were linked to a check, and three had a current pass. Behaviors checked only by browser tests, which need a deployed environment, had no run to count. Two of the three rules had no check at all.

{.note}
An internal pilot on one capability, not customer evidence. The records are drafts written by an agent, and the product owner has not yet reviewed them.

***

{.eyebrow}
From the founder

## Why I started Coral Reef Ventures.

:::card{.founder}
I’ve built software products throughout my career. Keeping track of what they do has always been a challenge, and the past two years of agentic development have magnified it. We built repositories with hundreds of thousands of lines of code, extensive documentation maintained by agents, deliberate architecture, and automated quality gates. Yet answering straightforward questions about product behavior still required investigation. The code and its documentation needed a much tighter connection.

The fragmentation extended beyond development. Planning, documentation, support, product analytics, and observability lived in separate systems. Each served a purpose, but connecting what we intended, what we built, and what users experienced took continual effort.

I also loved Markdown’s portability, while wanting documents that were more beautiful and easier to read. These experiences led me to start Coral Reef Ventures: open foundations and focused tools that preserve readable documents, connect product intent to implementation, coordinate human and agent work, and bring user experience back into product decisions. My aim is to help teams retain a coherent understanding of their products as agents take on more of the work.

{.byline}
Gary Clarke, founder
:::

***

{.eyebrow}
Next steps

## Talk to us.

{.statement}
Tell us what your team is building, and where keeping track of it is hard.

{.actions}
[[Contact us](/get-involved/)]{.button .primary} [[Read the whitepaper](/whitepaper/)]{.button}

{.contact}
Or write to [hello@coralreefventures.com](mailto:hello@coralreefventures.com).
