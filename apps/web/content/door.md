---
markset: 0
---

{.eyebrow}
Coral Reef Ventures

# Keep control as agents build your software

{.lead}
Coral Reef Ventures is building open foundations and focused tools to connect product intent, the work that changes it, the checks that verify it, and what users experience.

***

{.eyebrow}
The problem

## Agents change the code. Your team still answers for the product

{.lead}
After every change an agent makes, someone still has to answer three questions.

{.questions}
1. **Which product promises changed?** A diff shows lines, not behaviors.
2. **What evidence supports each one?** A test that exists is not a test that passed on this commit.
3. **Are users better off?** That shows up after the release, far from the code that caused it.

The answers sit in the code, the tracker, the test runs and what users report. Today, putting them together takes an investigation.

***

{.eyebrow}
What we build

## Two open foundations. Two products

{.lead}
Markset and Intentset are open foundations: open source, for any team to adopt. Streamlane and Driftline are products: focused tools for coordinating work and learning from use.

{{products}}

***

{.eyebrow}
How they fit

## Where each one fits, from intent to feedback

{.lead}
Those three questions are easier to answer when a change can be followed from the promise it serves to what users experience.

:::steps{.lifecycle}
1. **Intent.** Write down what the product promises, and who owns each promise. [Intentset]{.kicker .intentset}
2. **Work.** Plan each change and move it forward, with people and agents on the same work. [Streamlane]{.kicker .streamlane}
3. **Verification.** See which promises have a check passing on this commit, and which have no check at all. [Intentset]{.kicker .intentset}
4. **Release.** Record what each release is meant to do for users, before it ships. [Driftline]{.kicker .driftline}
5. **Feedback.** Watch real users meet it, ask them why when adoption stalls, and take what you learn back to intent. [Driftline]{.kicker .driftline}
:::

{.foundation}
**Under every step, Markset.** Records stay readable Markdown that agents write and people review. Intentset's records are already Markset documents.

{.note}
None of the four requires another. Use each where it helps your team.

***

{.eyebrow}
Whitepaper

## Keeping product intent connected in agentic software development

{.lead}
As agents take on more of the implementation, a team still has to know what its product promises, whether a change keeps that promise, and whether users get the result. The whitepaper sets out that problem, the opportunity it creates, and how open foundations and focused products can keep intent, execution and outcomes connected.

{.actions}
[[Read the whitepaper](/whitepaper/)]{.button .primary}

{.note}
Free to read, with no form and no sign-up.

***

{.eyebrow}
Where to start

## Try Intentset on one capability

{.lead}
Have an agent model one capability your product already has, from its code, tests and decision records. Review what it wrote, and see which promises have a passing check, which only have one linked, and which have none. You do not need to reorganize your repository.

{.actions}
[[Try Intentset](https://intentset.org/start/)]{.button .primary}

{.paths}
- **Markset on its own.** For documents your agents write and people want to read, [start with Markset](https://markset.org).
- **Streamlane and Driftline.** Both are open to invited guests. If your team wants to help shape one, [ask about becoming a design partner](/get-involved/).

***

{.eyebrow}
Illustrative example

## One behavior, its owner and its status

Intentset keeps a short record like this for each behavior, beside the code that delivers it.

:::card[Example: Schedule an assessment]{.example}
- **Behavior:** A teacher chooses when a published assessment becomes available to a class.
- **Owner:** The assessment team, which owns the one slice of code that delivers it.
- **Verification:** Two tests, both passing on the commit under review.
- **Status:** Approved by the product owner. Agents never approve.

{.note}
Illustrative, adapted from Intentset's worked example for Lantern, an invented product.
:::

A linked check is not a passing one. Intentset counts a pass only when the check ran on the commit being reviewed.

***

{.eyebrow}
Why we exist

## Why we started Coral Reef Ventures

:::card{.origin}
Keeping track of what a software product does has always been a challenge, and the past two years of agentic development have magnified it. We built repositories with hundreds of thousands of lines of code, extensive documentation maintained by agents, deliberate architecture, and automated quality gates. Yet answering straightforward questions about product behavior still required investigation. The code and its documentation needed a much tighter connection.

The fragmentation extended beyond development. Planning, documentation, support, product analytics, and observability lived in separate systems. Each served a purpose, but connecting what we intended, what we built, and what users experienced took continual effort.

Coral Reef Ventures came out of those experiences: open foundations and focused tools that preserve readable documents, connect product intent to implementation, coordinate human and agent work, and bring user experience back into product decisions. The aim is to help teams retain a coherent understanding of their products as agents take on more of the work.
:::

***

{.eyebrow}
Next steps

## Talk to us

{.statement}
We are looking for funding, design partners and advisors. Tell us who you are and what you have in mind.

{.actions}
[[Take part](/get-involved/)]{.button .primary}

{.contact}
Or write to [hello@coralreefventures.com](mailto:hello@coralreefventures.com).
