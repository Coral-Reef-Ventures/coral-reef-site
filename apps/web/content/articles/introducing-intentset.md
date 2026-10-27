---
markset: 0
---

{.eyebrow}
Article · 28 October 2026

# Introducing Intentset, in 23 slides

{.lead}
Why we built Intentset, who the deck is for, and how to read it: the product's promises written down and kept true while agents change the code.

## Why a deck

A team used to understand its product because it wrote the code. Now agents write most of it, in changes too long to read line by line, and the question "what does our product actually promise?" has nowhere reliable to be answered. [Code outruns review](/articles/code-outruns-review/) makes that argument in prose. The deck shows the answer we are building for it, one idea per slide, in an order you can present to a team.

{.actions}
[[Read the deck on intentset.org](https://intentset.org/introducing/)]{.button .primary}

## What is in it

The deck has two halves.

**The first half needs no technical background.** It starts from the problem, then the idea in plain words: write down what the product promises, which code delivers each promise, how each one is checked and what you may tell people about it, and keep all of it true as the code changes. It shows how a team works with it, with agents doing the writing and people doing the deciding, and what a reviewer reads in place of the diff.

**The second half is under the hood**, for the people who will set it up and live with it: the records as files beside the code, the links between them, which part of the code owns each promise, how evidence counts as current, the checks that catch drift, and the tools that read it all. It ends with how to try it on one capability of your own.

## How to read it

Each slide has speaker notes beneath it, folded away until you open them. On a laptop, Page Down moves from slide to slide; on a phone, the slides stack and scroll. It prints one slide to a page.

The deck is written in Markset, the same open format as this page, so it is plain text in the repository and reads anywhere Markdown does.

## Where Intentset stands

Intentset is an open foundation: open source, MIT licensed, and an early release. Its specifications are dated drafts at version 0.2, and the toolchain is on npm. We are adopting it in two of our own products, and the [adoption log](https://intentset.org/pilot/) records what it caught, what it cost and what it changed, friction included.

If you want to try it, [start on one capability](https://intentset.org/start/). If you want to talk about it, write to hello@coralreefventures.com.
