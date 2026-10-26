---
markset: 0
---

{.eyebrow}
Article · 15 October 2026

# Intent is the work: building software when agents write the code

{.lead}
When agents write the code, the work that remains is deciding what the product should do, proving that it still does, and learning whether it should. This paper sets out why, and what Coral Reef Ventures is building for it.

## Executive overview

If agents do not write all of your organization's code yet, they soon will. Turning a clear requirement into a working change is now the easy part. The hard parts are around it: deciding what to build before an agent starts, proving that what comes back is right, keeping documentation and people current, and learning from users.

Code produced at this rate outruns human review, and the cost arrives as drift: hundreds of reasonable changes that disagree. Different parts of the product behave differently, customers get confused, and in time no one can say what the product is meant to do, because it is the sum of decisions made by different people and agents at different times, and nobody holds them all.

Our thesis is that when agents write the code, the durable asset is a reviewed account of what the product promises: its behaviors, the rules they keep, the code accountable for each, the evidence that each holds on this commit, and the decisions behind them. Agents keep it current in the same commit as the code; people approve what it promises. Review then asks what a change kept rather than reading everything it did, and several agents can work on one product at once without colliding.

We build four offerings around that account, each adoptable on its own: Intentset and Markset, open foundations that record it and keep it readable, and Streamlane and Driftline, products that coordinate the work and connect releases to what users experience. [[1–3]](#sources-and-scope) On our own products, agents adopting Intentset brought 472 tolerated architecture violations to zero in five days, and the first capability they modeled had two of its three rules untested. Those results are internal, and [What exists today](#what-exists-today) sets out their limits.

This paper is for engineering and product leaders whose teams already delegate substantial work to agents. We are looking for design partners among them, and for investors and advisors who share the thesis.

## Writing the code is no longer the hard part

Coding agents make changes across files, run tools and prepare work for review. GitHub documents these capabilities alongside a continuing requirement for human review and validation, and Anthropic describes agents working through tool use and feedback, with human checkpoints where they are needed. [[4–5]](#sources-and-scope) How much a team delegates still varies by team, codebase and task, but we expect nearly all implementation to move to agents, and in some teams, ours among them, it already has.

### Where the work went

| Stage | The work that remains |
| --- | --- |
| Before the build | Planning and prioritizing; understanding the problem; settling the key decisions and writing them so people can follow them, before an agent starts. |
| During the build | Coordinating several agents at once, each of which starts without memory of the others or of the decisions made last week. |
| After the build | Validating the result, refining it and preparing the launch; updating internal and external documentation; telling the people the change affects. |
| After the release | Hearing from users, and carrying what they show you into the next decision. |

None of this work is new. What is new is its share. When implementation costs little, these steps are most of the cost, and they are the steps current tools support least.

### Product and engineering meet in the middle

The line between product management and engineering is moving. Product managers can now build working software. The skills that matter most in an engineer now include ones product management used to own: deciding what a change should do, specifying it precisely, and judging whether the result is right. More and more, whoever starts a piece of work carries it from idea to validated release. That person needs the product's promises, its decisions and the evidence behind them in one place, in words both roles read.

## Code outruns review, and the product drifts

When generating a change gets easier, understanding its effects does not. A large diff can hide a consequential change in behavior, and a short AI summary can hide uncertainty just as easily. Teams that delegate more read less of each change, and the gap between what was reviewed and what shipped widens with every merge.

### Drift is the failure mode

In a codebase agents build quickly, technical debt reaches customers before engineers see it. One area handles a case one way and the next area another. The interface grows inconsistent. Customers who learned one part of the product are confused by the next.

The cause is rarely bad code. It is decisions nobody recorded. Each agent session, like each person before it, resolves the ambiguity in front of it, preserving the local pattern while missing the product rule behind it. Each decision is reasonable, and together they make a product nobody decided on. When the team finally asks what the product should do, the answer has to be reconstructed from code, tickets and memory.

### Several agents at once speed it up

A team that delegates enough runs several agents at once, each starting without memory of the others. Two agents changing different code can still break a promise that spans both, if nothing says which code is accountable for which behavior, and a decision made in one session has to reach the next or be made again, possibly differently. The coordination people do by talking has to be carried, for agents, by what is written down in the repository.

### The usual signals prove less than they seem

A passing test run does not show that every rule has a check, or that the result belongs to the commit being shipped. A closed ticket shows that someone considers the work finished, not that a promise is kept. Errors and adoption metrics say something is wrong, but rarely which promise is affected or who owns it.

These problems existed before coding agents. Delegation makes them impossible to ignore, because the people approving a change increasingly did not write it.

## Why the tools teams already use leave the gap

Each system a team runs holds part of the answer, and none holds the product's promises.

| Tool | What it holds, and what it cannot answer |
| --- | --- |
| Work tracker | Who is doing what, and by when. Not what a change means for the product: a closed ticket is not a kept promise. |
| Specification for a change | What one change should do, written before it starts. Not what the product does once many changes have landed: a change's specification usually stops being updated when the change merges. |
| Documentation and wiki | Explanations for people. Not whether they still describe the code, which changes on a different schedule. |
| Test suite | Checks that ran, and whether they passed. Not whether each rule has a check, or whether a result belongs to this commit. |
| Analytics and observability | What users did and what failed. Not which promise is affected, or who owns it. |

The missing piece is the record all of them could point to: one account of what the product promises, organized by behavior rather than by change, that outlives every change made to it.

## One account of the product, kept with the code

### Intentset records what the product promises

Intentset starts with behavior a person could observe, written in product language. Each behavior has an identity, the rules that govern it, the slice of code accountable for delivering it, the checks that verify it, and the decision records that explain why it was built as it was. Records are short Markdown files in the repository, beside the code they describe. [[2]](#sources-and-scope)

This is a behavior record from Intentset's published scheduling example, shortened:

```markdown
---
intentset:
  id: BEH-ASMT-SCHEDULE
  type: behavior
  title: Schedule a student assessment
  owner: team-assessment
  links:
    governedBy:
    - RULE-ASMT-FUTURE
    - RULE-ASMT-AUTH
---

# Schedule a student assessment

## Behavior

A teacher submits a future release
time for a published assessment and
a class.
```

One of the two rules it names is a single sentence: "The server must reject scheduling unless the assessment is published and the actor is authorized to assign it to the requested class." A verification record names the behavior and both rules it checks. A reviewer, a product manager or an agent can read the whole chain without opening the code. [[7]](#sources-and-scope)

### People approve what the product promises

Agents can draft a model from existing requirements, code and tests, and propose updates as they work. That first reconstruction describes what the agent found; it does not prove the existing behavior is right. A person reviews the promises and rules, resolves the ambiguities, and approves them as intent. Intentset reserves approval for people. When an ambiguity is settled, the decision is recorded with the alternatives it rejected, so an agent in a later session reads why rather than deciding again. [[2]](#sources-and-scope)

### Review asks what a change kept

When an agent changes the implementation, the records and checks it affects change in the same commit. Intentset's review check lists each slice whose code changed while none of its records did, and can fail a pull request on it unless a commit says why. Evidence is tied to a commit, which separates four answers a single coverage percentage would blur: a rule with no check, a check that has not run, a check that failed, and a result from an earlier snapshot. [[2]](#sources-and-scope)

The reviewer gets a short account of what a change kept, where the diff gives a long one of what it did. Security-sensitive and complex changes still need engineering scrutiny of the implementation itself; the account tells the reviewer where to spend it.

### The slice is the unit of parallel work

One slice is accountable for each behavior, and Intentset's architecture check keeps other code out of a slice's internals. Two agents in two slices can therefore meet only at a declared contract, and an agent handed one slice's context makes a change that stays in that slice. Each branch shows whether it kept the promises it touched. That is what lets one person run several agents on one product at once, and Intentset publishes guidance for doing so inside a team's existing controls. [[2]](#sources-and-scope)

### Markset keeps it readable

Markset adds a small, closed vocabulary of layout to Markdown, with tooling that checks a document's structure, renders it and falls back to plain Markdown, so the plans, records and reports agents write stay readable by people and reviewable as plain text. Intentset's records are Markset documents. [[3]](#sources-and-scope)

### Coordination and learning point at the same account

Work management tools organize around a team, a project and a person, which answers who is doing what by when but not what a change means for the product. The model offers a second axis through the same work, and Streamlane is being developed to use it. A model is only as useful as it is current, so the first connections Streamlane has built, ahead of its release, are the ones that make it cheaper to maintain:

- **Agents handed the model with the work.** An agent assigned an item receives the behaviors, rules, checks and decisions that govern the code it is about to change. An agent started from an item is told to load the owning slice through Intentset's tools before it changes code, and the records it drafts show on the item for a person to approve. [[2]](#sources-and-scope)
- **Drift as assigned work.** Intentset reports each slice whose code changed without its records, and Streamlane turns each one into an item in its owning team's triage, because a report is more likely to be acted on as an item with an owner than as a failing step in a pipeline.

Release readiness stated by behavior followed, judged at the release's commit and read only for now. One rule holds throughout: completing work never asserts that a promise is kept. A tool that infers product state from work state reintroduces the drift the model exists to expose.

Driftline is planned to close the loop: each release carries what it is meant to do for users, and what users then experience, failures and stalled adoption included, is related to the behavior and the owner it concerns.

## A change followed through the lifecycle

Consider the team behind the scheduling example adding scheduled assessments to a learning app. A teacher sets a future release time for an assessment, and students gain access only then. This is an illustration, not a customer result, and step 4 depends on Driftline, which is still being built.

:::steps
1. **Decide the behavior and its rules.** A product owner and an agent draft the behavior in Intentset, with rules for time handling, cancellation and a teacher who loses access before the release time, and the product owner approves it. Open questions stay visible, and each one settled becomes a decision record, alternatives included.
2. **Coordinate and build.** In Streamlane, the work item references the approved behavior. The agent loads that part of the model, changes the owning slice, and updates its records and checks in the same commit. A change to a product rule goes back to a person.
3. **Review what the change kept.** The checks cover scheduling and cancellation, but nothing verifies the authorization rule at release time, and because each rule links to its checks, the gap is visible. The reviewer asks for the missing evidence and inspects the authorization code. The agent's change report, a Markset page, separates failed checks, checks not yet run and rules with no check.
4. **Watch the release meet users.** In Driftline, the release carries what scheduled assessments are meant to do. Feedback shows teachers cannot tell when an assessment will open, although every check passes. The team treats that as a hypothesis and asks affected users, with consent, before changing anything.
5. **Carry the learning back to intent.** A person approves a clearer release-time display, the behavior record changes, and new work and fresh evidence follow, still connected to the original decision.
:::

## What exists today

| Offering | Status on 2026-10-19 |
| --- | --- |
| Markset | Open source, v0. The site lists reference version 0.4.2, with tooling for authoring, checking and rendering. |
| Intentset | Open source. Specifications at v0.2, drafts in review, with reference toolchain 0.8.0 published to try them against. |
| Streamlane | In development. Open to invited guests. |
| Driftline | In planning. Its model was written ahead of its code, and its first capabilities are being built against Streamlane's evidence. Open to invited guests. |

These are published project statuses, not evidence of customer adoption or of a finished, connected platform. Versions and availability will change. [[1–3]](#sources-and-scope)

### What the adoption log shows

Intentset keeps a public log of its adoption in Streamlane and Driftline, Coral Reef's own unreleased products, and the adoption itself is done by agents, one capability at a time. [[2]](#sources-and-scope)

:::metrics
| Measure | Result |
| --- | --- |
| Rules untested in the first capability modeled | 2 of 3 |
| Tolerated architecture violations, at switch-on and five days later | 472 → 0 |
| Streamlane's slices over the same period | 37 → 43 |
:::

- **The first model found real gaps.** One Streamlane capability, modeled from its code, tests and a decision record, had two of three rules untested and three behaviors checked only through the browser.
- **The checks are a gate, not a report.** Since 2026-10-06 they have been a required step on every Streamlane pull request, drift check included.
- **The baseline reached zero.** The 472 violations present when the check went on were gone by 2026-10-11, including a dependency loop that had joined 25 of Streamlane's 39 slices. Any new violation now fails before it merges.
- **A model can come first.** Driftline's model was written before its code, so its first commits were checked against promises that already existed.
- **The model grew with the product.** By 2026-10-19 Streamlane's model held 1,282 records across 56 slices, and 312 of its 318 behaviors had a check linked. Its unit and contract results are read in on every commit, its browser tests at each release, and a production deploy is refused for a commit no full, passing browser run covers. The baseline has stayed at zero.

These show verification gaps and structural drift made visible in real repositories. They are internal, on unreleased products, and show no measured reduction in defects or review time yet. That is what a design partnership would measure.

## What this does not claim

The approach has limits, and we would rather state them once and plainly.

- **A connected model does not guarantee correctness.** An agent could make code, records and tests agree around the same mistaken interpretation. The checks expose omissions; they cannot show that the model is complete or right, so independent review of acceptance criteria remains, combining automated, model-based and human judgment. [[6]](#sources-and-scope)
- **A model has to earn its upkeep.** Each step of adoption has to return more than it costs to maintain, or the model will be abandoned.
- **Integrations depend on stable identities** that survive renaming and refactoring, and production feedback on explicit decisions about consent, access, retention and what data reaches an agent.
- **The model does not replace a team's controls.** Delegating more depends on the boundaries around agents: what their commands may touch, an environment of their own that holds no real data, and a path to the main branch that runs only through the review the team already requires. How a change is reviewed, merged and released stays the team's rule; the model makes the last of those boundaries, review, faster to pass well.
- **The market is still to be proven.** How large the opportunity is, and what teams will pay to keep this connection, remain questions for real use to answer.

## Starting with one capability

Start with one existing capability that has meaningful rules and a recognizable owner. Let an agent reconstruct its behavior from the repository, review the model, and connect the checks that already exist. The first question is whether that reveals something actionable and makes the next change easier to judge.

Then measure the effort of assessing comparable changes before and after: time spent reconstructing context, gaps found, records that proved stale, and the cost of upkeep. Track escaped defects and rework beside them, so that faster review cannot hide weaker review. Once one capability shows value, agents extend the model to the slices around it, in parallel, with a person approving the records.

## Working with us

Our vision is a team that keeps a shared, current understanding of its product while agents do the building, and lets what users experience shape the next decision.

We are looking for design partners: engineering and product teams that already delegate substantial work to agents and want to shape Streamlane and Driftline around how they work. We also welcome investors, advisors and collaborators who want to help establish open foundations for building software this way.

{.contact}
[Tell us about your team](/get-involved/), or write to [hello@coralreefventures.com](mailto:hello@coralreefventures.com).

## Sources and scope

Project descriptions and statuses were reviewed on 2026-10-19; the adoption figures are as the adoption log records them, counted on 2026-10-11 and, for the model's size and evidence, on 2026-10-19. The connected lifecycle, the proposed integrations and the commercial opportunity are Coral Reef's proposed direction. External sources establish what agents can do and the need to evaluate them; they do not validate Coral Reef's approach.

1. Coral Reef Ventures: [coralreefventures.com](https://coralreefventures.com/)
2. Intentset project overview, adoption log and guidance for running an adoption: [intentset.org](https://intentset.org/), [intentset.org/pilot/](https://intentset.org/pilot/), [intentset.org/adopt/](https://intentset.org/adopt/)
3. Markset project overview and tooling: [markset.org](https://markset.org/)
4. GitHub, Application card for Copilot Agents: [docs.github.com/en/copilot/responsible-use/agents](https://docs.github.com/en/copilot/responsible-use/agents)
5. Anthropic, Building effective agents: [anthropic.com/engineering/building-effective-agents](https://www.anthropic.com/engineering/building-effective-agents)
6. Anthropic, Demystifying evals for AI agents: [anthropic.com/engineering/demystifying-evals-for-ai-agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
7. Intentset's scheduling example: [github.com/intentset/intentset/tree/main/examples/scheduling](https://github.com/intentset/intentset/tree/main/examples/scheduling)
