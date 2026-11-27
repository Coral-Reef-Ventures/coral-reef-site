---
markset: 0
---

{.eyebrow}
{{dateline}}

# A test nobody ran

{.lead}
A rule with a linked test is a claim that it is checked, not proof. It counts only when the test runs, can fail, and passed on the code you are shipping.

## More than 2,400 verifications, and one that nothing ran

On 2 November, a learning platform for schools had written down more than 2,400 verifications of what it promises, every one automated and bound to one of 749 test files. Its first pilot had already found the gap this article is about. The capability it started with had its own end-to-end test, and that test would have failed if anything had run it, because it looked for a legend that an earlier change had removed. Nothing ran it.

The team had CI, and CI was green. The test was in the repository, and anyone counting tests would have counted it. It had been broken for some time, and nobody knew.

## How a test stops running

"CI is green" means that everything CI was told to run passed. It says nothing about a test CI was never told to run. The published story doesn't record why that one test was left out, and the reason rarely matters, because there are so many ordinary ways for it to happen:

- **The suite got slow.** End-to-end tests move out of the pull request check into a nightly job, and after a while nobody reads the nightly job.
- **The pipeline selects by path.** CI runs the folders or file patterns it was given. A test added somewhere else is never picked up.
- **A flaky test was skipped.** Someone marked it "skip" to unblock a release and meant to come back to it.
- **The test lives in another repository.** In one of the three adoptions, thirteen rules were checked only by an older server's tests, and that server's CI never ran them.
- **It needs something CI doesn't have.** A test that wants a database, a browser or a secret quietly skips itself where there isn't one.
- **The check matches nothing.** One team's linter had four patterns that matched no file, so it passed while seven files broke the rules it was meant to enforce.

None of these fails a build, which is why they last. If your project is more than a year old, it probably has at least one.

## What made the gaps visible

These gaps came to light because the teams were adopting [Intentset](https://intentset.org), an open foundation for writing down what a product promises. Each behavior and each rule it keeps becomes a small record in the repository, beside the code. A verification record then names the exact test that checks a rule: the file and the test's title.

Naming the test is the step that matters here. To bind a promise to a test, someone has to find the test, and then say when it last passed. For most rules the answer is easy. For some, it turns out that the test doesn't run, can't fail, or checks something else.

## The same gap, three times

The three adoption stories we published in November come from one education company, and each of its repositories had a version of this:

- Thirteen of one app's rules were checked only by tests no CI ran.
- One test passed only because it mocked the wrong route, and two asserted nothing.
- A dependency linter had never run in CI. In another repository, the boundary rules matched a folder layout the package manager doesn't use, so they had never fired.

None of these teams were careless. Each check was written in good faith, and each one passed.

{.pull}
A passing check that cannot fail looks exactly like one that works.

## Four answers a percentage hides

A coverage figure is one number. The honest answer about any one rule has more than one value:

1. **No check.** Nothing tests the rule at all.
2. **Not run.** A check exists, and nothing ran it.
3. **Failed.** It ran, and it failed.
4. **Passed on an earlier snapshot.** It passed, on code that has since changed.

Only a fifth answer, a pass on the code being shipped, says the rule holds. A single percentage folds all five together.

Agents make the fourth answer the common one. One of the three apps merged 122 pull requests in its busiest week. At that pace, last week's pass describes code that no longer exists.

## Evidence, and when it goes stale

Two words carry the rest of this article.

**Evidence** is a record that a test ran and what happened: it passed, failed or was skipped, on which version of the code. A test is not evidence. A test is how you get some, and a test that never runs produces none.

**Stale evidence** is a pass that was true when it was recorded, on code that has changed since. It is like an inspection certificate for a car whose brakes were replaced afterwards: the inspection was real, and it says nothing about the car as it is now. The fourth answer above is stale evidence.

A check counts when its evidence is current: the test ran, it passed, and what it checks has not changed since.

## Our own version of it

We build Streamlane the same way, and we met the same problem from the other side. Its browser tests need a deployed backend and take about half an hour, so they can't run on every commit. For weeks, "the browser tests pass" meant "they passed the last time someone ran them".

In October we started recording each pass against the code it covered, and counting it only while that code was unchanged. The first full browser run, judged a few commits later, was still current for 5 of 274 verifications. Part of that was our rule being too broad, and the next Intentset release narrowed it. Part of it was simply true: the code had moved on.

One full run that week looked like this:

:::metrics
| Tests | Count |
|---|---|
| Run | 655 |
| Passed | 643 |
| Skipped | 10 |
| Failed under load | 2 |
:::

A summary line would have said 98% passed. The ten skipped tests are ten promises nobody checked that day, and the two failures passed when run alone, so it took a second run to tell them from real bugs.

We settled it by deciding how fresh each kind of evidence has to be. Unit and contract tests are checked on every commit: on 19 October, 331 of 332 had a current pass. Browser tests are checked at each release, on the exact commit being shipped, and a production deploy is refused for a commit that no full, passing browser run covers.

## What makes a check count

None of this is exotic, and most of it is general practice:

- **Watch a new test fail first.** Run it once against the code without the change. A test that passes either way checks nothing. In one adoption, three new tests failed on the old code, which is how the team knew they worked.
- **Test the checks themselves.** One team now plants a violation for each architecture rule and proves that each one fails.
- **One gate, the same everywhere.** Use the same commands on a laptop and in CI, so an agent runs the gate before it opens a pull request, and nothing passes locally that CI skips.
- **Treat a skip as a result.** Count skipped tests in every run, and give each one an owner and a date.
- **Let a pass expire.** Record each pass against the code it checked, and stop counting it when that code changes. Intentset does this: its `intentset evidence stale` command lists every check whose evidence is missing or out of date.
- **Show linked and passing side by side.** A rule with a test linked and a rule with a current pass are different claims, and a report should never merge them.
- **Run the slow suite on what ships.** If a suite is too slow for every commit, run all of it on the commit you release.

## A fifteen-minute audit

You don't need to adopt anything to find your own version of this. Three checks, on the project you work on today:

1. **Count what ran.** Compare the number of tests in the repository with the number in your last CI run. If they differ, find out which ones are missing and why.
2. **List the skips.** Search for skipped and disabled tests. For each one, ask who skipped it and when.
3. **Break something on purpose.** Pick the rule your customers would miss most, break it on a branch, and see which test fails. If none does, you have found a test nobody ran, or a rule nobody tested.

If all three come back clean, your tests are proof. If not, you know which claims to fix first. The [three adoption stories](/articles/intentset-before-scale/) show what the same questions found in practice.
