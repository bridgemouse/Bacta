---
name: bacta-pr-review
description: Use when reviewing open GitHub PRs in the bacta repo before merging to main — especially PRs authored by bacta-headless, where CI green and tests passing don't yet mean the change is correct
---

# Bacta PR Review

## Overview

The counterpart to `bacta-headless` (which authors PRs) and `bacta-issues` (which
files the issues behind them). This skill reviews and merges what those
produce: **orient → order → review → fix-or-ask → merge → verify → repeat**.

Interactive only — always a live session with the user present to approve
fixes and merges. Never auto-merges unattended; `CONTRIBUTING.md` requires
maintainer review and CI passing before every merge, and that maintainer
review is this skill.

**Core lesson from the first backlog clear (14 PRs, Jul 1):** a fresh-context
`/code-review` pass caught real, high-confidence bugs in ~2/3 of headless-authored
PRs — not style nits, but a cron expression silently firing hourly instead of
every-2/4-hours, a stale timer clobbering a genuine in-flight retry, a cached-but-broken
client that only worked once, a progress bar left wired to the wrong data source
after a redefinition. **Green CI and passing tests only prove the code does what
its author thought to test.** They do not prove the author thought of the right
things. Do not skip the review pass because a PR "looks clean" from its diff or
description.

---

## Phase 0 — Orient

Read `CLAUDE.md` if more than one session has passed since you last read it.

```bash
git checkout main && git pull origin main
git status && npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

**If main isn't clean and green before you start, stop and fix that first** —
every later merge's baseline depends on it.

```bash
gh pr list --repo bridgemouse/bacta --state open \
  --json number,title,headRefName,author,createdAt
```

---

## Phase 1 — Order and Collision Check

**Default order: ascending PR number.** Older PRs branched from an older
main and are more likely to be the "true" origin of a shared change.

Before starting, check whether multiple open PRs touch the same file:

```bash
for n in <pr-numbers>; do
  echo "=== #$n ==="; gh pr diff $n --repo bridgemouse/bacta --name-only
done
```

Any file appearing under 3+ PRs is a **collision zone**. Note it now —
don't discover it cold at merge time. It means every merge past the first
two will likely need hand-combined logic, not a clean auto-merge.

---

## Phase 2 — Per-PR Review

```bash
gh pr checkout <N> --repo bridgemouse/bacta
```

Run `/code-review` at **high** effort. Do this even if:
- CI is green
- The PR description sounds complete
- You reviewed a similar PR from the same batch cleanly

A fresh-context review is the point — it has no memory of how the PR was
written and no attachment to the author's intent, which is exactly what
catches gaps the author's own tests didn't cover.

**What a solid pass covers** (adapted from Google's eng-practices review
standard, condensed to what actually surfaces bugs in this codebase):

| Category | What to check |
|---|---|
| Correctness | Does it do what the issue/PR description claims, including edge cases (empty state, first-run, retry, concurrent triggers)? |
| State & timers | New timeouts, intervals, or cached clients — do they get cleared/invalidated on the failure path, not just the happy path? |
| Shared surfaces | Does this PR touch a collision-zone file? If so, does it assume it's the only recent change to that file? |
| Tests | Do the tests assert the actual bug/behavior, or just that the code runs? |
| Bacta hard constraints | Inline styles only, dark UI only, colors from `theme.ts` (never hardcoded hex), `hexA()` for rgba, JetBrains Mono for all numbers/readouts |
| Scope | Does the diff match the issue, or did unrelated files sneak in? |

---

## Phase 3 — Handle Findings

Follow the established review-then-fix pattern:

**CONFIRMED, high-confidence, small well-scoped fix (a few lines, clear
root cause)** → fix it directly in the PR branch, add a regression test
proving the bug existed and is now fixed, verify (`npm test` + both
`tsc --noEmit` passes), then continue to Phase 4.

**Bug lives entirely outside this PR's diff, or the right fix needs a real
architectural tradeoff** → stop and ask the user. Don't guess at scope.

**No findings** → proceed straight to Phase 4.

Do not just report a confirmed bug and move on without fixing it — that
defeats the purpose of reviewing a backlog instead of merging it blind.

---

## Phase 4 — Merge

Update the branch against current main first — this is where collision
zones bite:

```bash
git fetch origin main && git merge origin/main
```

If conflicts appear in a flagged collision-zone file, **combine both sides'
logic** — a previous PR's fix living in that file is not automatically
inferior to this PR's change. Blind "ours"/"theirs" resolution silently
drops whichever fix isn't chosen. Re-run the full suite after resolving.

```bash
npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
git push origin <branch>   # if the merge produced new commits
gh pr merge <N> --repo bridgemouse/bacta --squash --delete-branch
```

Squash-merge is this repo's convention (one commit per PR, `(#N)` suffix,
confirmed in `git log`). If the PR's body says `closes #N`, verify GitHub
actually closed the linked issue after merge.

---

## Phase 5 — Verify Baseline Before Next PR

```bash
git checkout main && git pull origin main
npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

**Must be green before starting the next PR.** A merge that silently
broke something is the next review's problem to inherit if you don't
catch it here — especially likely right after resolving a collision-zone
conflict.

Clean up: delete any local worktree/branch for the PR just merged.

---

## Phase 6 — Session Summary

```
## PR Review Session — <YYYY-MM-DD>

### Merged clean
- #<N> <title>

### Merged with a fix
- #<N> <title> — <one line: bug found + fix>

### Blocked / needs a decision
- #<N> <title> — <what decision is needed>

### Final state
- Open PRs remaining: <N>
- main: <test count> passing, both typechecks clean
```

---

## Quick Reference

| Situation | Action |
|---|---|
| Main isn't green at session start | Stop, fix that first, don't touch any PR |
| PR looks clean from description/diff | Review it anyway — that's not evidence |
| CI green + tests passing | Necessary, not sufficient — still run `/code-review` |
| Confirmed small bug found | Fix directly + regression test, don't just flag it |
| Bug outside this PR's diff | Ask the user — don't scope-creep silently |
| File flagged as collision zone hits a merge conflict | Combine both sides' logic, never pick one blind |
| Merge just resolved a conflict | Re-run full suite before calling it done |
| About to start next PR | Confirm main is still green first |

## Common Mistakes

| Mistake | Consequence |
|---|---|
| Skipping `/code-review` because the PR "seems fine" | Misses exactly the class of bug this pattern exists to catch |
| Resolving a collision-zone conflict by picking one side | Silently reverts a previously-merged fix |
| Merging PR N+1 without re-verifying main after PR N | Compounds a bad merge across the whole session |
| Reporting a confirmed bug without fixing it | Leaves the backlog-clearing session no better than an unreviewed merge |
| Fixing an out-of-diff bug without asking | Scope-creeps the PR past what the user agreed to |
| Using `git merge -X ours/theirs` on a collision file | Same failure as manual blind resolution, just automated |
