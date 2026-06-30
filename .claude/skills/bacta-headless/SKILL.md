---
name: bacta-headless
description: Use when starting an autonomous development session to work through GitHub Issues unattended — branches, implements, tests, and creates PRs one issue at a time without human input
---

# Bacta Headless Development

## Overview

Autonomous overnight development protocol. Works through open GitHub Issues one at a time:
**triage → worktree → TDD → PR → repeat**

Never merges to main. Never operates silently — every skip and every outcome is documented on the issue. The human reviews PRs in the morning.

---

## Safety Rules — active throughout, no exceptions

- **Never push to `main` directly.** All work lives on `agent/issue-<number>-<slug>` branches.
- **Never auto-merge.** Create the PR and stop. Human reviews.
- **Never silently skip.** Every skipped issue gets a GitHub comment explaining why and what would unblock it.
- **Never start a new issue while tests are failing.** Fix or draft-PR the current issue first.
- **Loop detection.** If the same tool + same arguments fires 3 times in a row with no state change → abort the issue, create a draft PR, move on.
- **3-attempt limit.** Maximum 3 distinct strategy shifts on a failing implementation before creating a draft PR.
- **No `--dangerously-skip-permissions`.** Use the configured allowlist in `settings.local.json`. PreToolUse hooks are the safety net.

---

## Phase 0 — Session Setup

### 0a. Orient

Read `CLAUDE.md` — conventions, current state, Bacta hard constraints. If more than one session has passed since you last read it, re-read it now.

### 0b. Verify clean baseline on main

```bash
git checkout main && git pull origin main
git status          # must be clean — no uncommitted changes
npm test            # must pass — all tests green
npx tsc --noEmit
npx tsc -p tsconfig.server.json --noEmit
```

**If anything fails on main: stop.** Do not attempt any issue. Post a comment on the oldest open bug issue explaining the baseline is broken and listing the failure. Exit.

### 0c. Ensure `.worktrees/` is gitignored

```bash
grep -q '.worktrees' .gitignore || echo '.worktrees/' >> .gitignore
```

If you added it, commit: `git add .gitignore && git commit -m "chore: ignore .worktrees/"`

### 0d. Build the issue queue

```bash
gh issue list --repo bridgemouse/bacta --label bug --state open \
  --json number,title,labels,body --limit 50
gh issue list --repo bridgemouse/bacta --label enhancement --state open \
  --json number,title,labels,body --limit 50
gh issue list --repo bridgemouse/bacta --label polish --state open \
  --json number,title,labels,body --limit 50
```

**Queue order:** `bug` first (lowest number → highest), then `enhancement`, then `polish`.

**Remove from queue without comment** any issue carrying: `blocked`, `needs-design`, `needs-human-decision`, `wontfix`.

**Cap:** Process at most 6 issues per session. Quality over quantity — a solid draft PR beats three half-finished ones.

---

## Phase 1 — Issue Triage (per issue)

### 1a. Read the issue fully

- What is the expected behavior?
- What is the actual behavior (for bugs)?
- What are the acceptance criteria?
- Which files are likely involved? Grep the codebase to confirm.

### 1b. Triage gate — two questions, both must be YES

1. **Can I state clear acceptance criteria?** What does "done" look like in concrete terms?
2. **Can I write a meaningful failing test?** A test that fails now and passes when the issue is resolved.

**If NO to either → Phase 7 (Skip Protocol).** Do not rationalize past this gate.

### NOT_TESTABLE — acceptable only when one of these applies

| Code | Situation |
|---|---|
| `CONFIG_ONLY` | Change is pure configuration, no testable behavior |
| `EXTERNAL_DEP` | Requires an external system unavailable in the test environment |
| `NONDETERMINISTIC` | Output has no testable invariant |
| `VISUAL_ONLY` | Pure CSS/layout change with no component logic to assert |

Even visual issues often have testable behavior (component renders, data flows correctly). Exhaust this before declaring `NOT_TESTABLE`.

---

## Phase 2 — Branch + Worktree

### 2a. Create the branch

```bash
# Format: agent/issue-<number>-<slug>
# Slug: lowercase, alphanumeric + hyphens, max 40 chars
# Example: agent/issue-21-sleep-light-sleep-garmin-mismatch

git checkout main
git checkout -b "agent/issue-${NUMBER}-${SLUG}"
```

### 2b. Create the worktree

Invoke `superpowers:using-git-worktrees`. Use `.worktrees/` at the project root. Verify it is gitignored (Phase 0c covers this).

### 2c. Confirm clean baseline in the worktree

```bash
npm test
```

All tests must pass before implementation begins. If they fail, you have an environment problem — do not proceed.

---

## Phase 3 — Read + Plan

Targeted read before touching any code.

**Always:**
- The specific files identified in triage (read them, don't skim)
- `client/src/theme.ts` if any UI is involved

**For UI issues additionally:**
- The relevant section page (`RecoveryPage.tsx`, `SleepPage.tsx`, `TrainingPage.tsx`, `HomePage.tsx`)
- The relevant data hook (`useRecoveryData`, `useSleepData`, `useTrainingData`, `useHomeData`)
- `client/src/components/` — can you reuse an existing component?

**State the plan before writing code:**
1. Root cause (bugs) or implementation approach (features/polish)
2. Files to modify — prefer editing existing over creating new
3. Files to create (if unavoidable)
4. Test approach: what will the failing test assert, and in which test file?

---

## Phase 4 — TDD Cycle

**Invoke `superpowers:test-driven-development` and follow it exactly.** No shortcuts for headless work.

### RED — Write the failing test first

One test. Tests real behavior (not mocks unless unavoidable). Name describes the behavior being fixed.

```bash
npm test -- --reporter=verbose path/to/test.test.ts
```

The test must:
- **Fail** (not error, not skip — actually fail)
- Fail **for the expected reason** (feature missing / behavior wrong)
- Pass **immediately** if implementation is correct

**Test passes immediately?** You are testing existing behavior. The issue definition or your understanding of it is wrong. Re-read the issue and reassess before continuing.

### GREEN — Minimal implementation

Write the smallest change that makes the test pass. No refactoring, no extra features.

**Bacta hard constraints — no exceptions:**
- Inline styles only — no CSS files, no Tailwind, no CSS modules
- Dark UI always — no light mode
- All colors from `client/src/theme.ts` — never hardcode hex values
- Numbers, labels, readouts: `fontFamily: "'JetBrains Mono', ui-monospace, monospace"`
- Prose, narrative, headlines: `fontFamily: "'Hanken Grotesk', system-ui, sans-serif"`
- RGBA: always `hexA(hex, alpha)` from `client/src/lib/hexA.ts`
- Prefer editing existing files over creating new ones

Run the full suite after going green:

```bash
npm test
npx tsc --noEmit
npx tsc -p tsconfig.server.json --noEmit
```

All must pass. Any type error or test failure must be resolved before creating a PR.

### REFACTOR

Remove duplication, improve names, extract helpers. Do not add behavior. Tests stay green.

### If tests fail during GREEN — strategy limit

| Attempt | What to do |
|---|---|
| 1 | Reassess the root cause — is the bug where you thought? |
| 2 | Try a materially different approach |
| 3 | Simplify — is there a smaller fix that addresses the core? |
| After 3 | Create a draft PR (Phase 6b). Move to next issue. |

---

## Phase 5 — Visual Verification (UI issues only)

If the issue touches any React component or visual output:

```bash
npm run build:client
```

Then Playwright:
1. `browser_navigate` to the relevant section
2. `browser_take_screenshot` — confirm the change looks correct
3. Check one adjacent section for regressions
4. `browser_close`
5. `rm -rf /tmp/pw-*`

If Playwright reveals a regression, fix it before the PR. Do not ship a fix that breaks something else.

---

## Phase 6a — PR: Successful Implementation

Tests pass, types clean, visual confirmed (if applicable):

```bash
# Stage only intentional files — never git add -A
git add <specific files>
git commit -m "fix: <description> (closes #<number>)"
# or feat/polish depending on label
git push origin "$BRANCH"

gh pr create \
  --repo bridgemouse/bacta \
  --title "<concise title — under 70 chars>" \
  --body "$(cat <<'EOF'
## What changed
- `path/to/file.tsx`: <one-line summary>

## Why
Closes #<number>: <restatement of the issue in one sentence>.

## Test evidence
- **RED:** `<test name>` → `<expected failure message>`
- **GREEN:** all tests pass after `<brief description of the fix>`

## Checklist
- [x] Inline styles only (no CSS files or class names)
- [x] Colors from theme.ts
- [x] TypeScript clean (client + server)
- [x] Full test suite passing

## Known gaps
<Edge cases not addressed, or NOT_TESTABLE items. "None" if clean.>
EOF
)"
```

Post a comment on the issue:
```bash
gh issue comment <number> --repo bridgemouse/bacta \
  --body "PR opened for autonomous review: <pr-url>"
```

---

## Phase 6b — PR: Partial / Failed Implementation (Draft)

```bash
git add <whatever was completed>
git commit -m "wip: partial fix for #<number> — <what was attempted>"
git push origin "$BRANCH"

gh pr create \
  --draft \
  --repo bridgemouse/bacta \
  --title "WIP: <issue title> (#<number>)" \
  --body "$(cat <<'EOF'
## Status: Draft — needs human review

Closes #<number>

## What was attempted
<Description of approach>

## Where it failed
<Specific: test output, type error, or what couldn't be resolved>

## Attempts made
1. <approach 1 and why it failed>
2. <approach 2 and why it failed>
3. <approach 3 and why it failed>

## Suggested next steps
<What a human reviewer should look at first to unblock this>
EOF
)"
```

---

## Phase 7 — Skip Protocol

When an issue cannot be triaged or attempted:

```bash
gh issue comment <number> --repo bridgemouse/bacta --body "$(cat <<'EOF'
**Skipped by autonomous agent**

**Reason:** <VAGUE | NOT_TESTABLE:CONFIG_ONLY | NOT_TESTABLE:EXTERNAL_DEP | NOT_TESTABLE:NONDETERMINISTIC | NOT_TESTABLE:VISUAL_ONLY | NO_ACCEPTANCE_CRITERIA | BLOCKED>

**What would unblock this:**
<Specific — what information, decision, or prerequisite is needed before this can be implemented>
EOF
)"
```

Never pass over an issue without this comment.

---

## Phase 8 — Between Issues

After each issue (any outcome):

1. Return to main: `git checkout main`
2. Record the outcome: `DONE #<number> PR #<pr>` / `DRAFT #<number>` / `SKIP #<number>`
3. Check stopping conditions:
   - 6 issues processed → write session summary (Phase 9) and stop
   - Main has diverged since session start → stop, write session summary
   - Context feels stretched (deep into many iterations) → stop, write session summary

**Do not start an issue you cannot finish.**

---

## Phase 9 — Session Summary

At end of session, write a summary. Post it as a comment on the oldest open issue, or create a temporary GitHub gist via the CLI.

```
## Bacta Headless Session — <YYYY-MM-DD>

### Completed (PRs ready for review)
- #<N> <title> → PR #<pr> — <one line on what was done>

### Draft PRs (need human input)
- #<N> <title> → PR #<pr> — <why it's a draft>

### Skipped
- #<N> <title> — <reason code>

### Stats
- Issues processed: <N>
- PRs created: <N ready>, <N draft>
- Tests at session end: <count> passing
- Type errors: 0

### First thing to review
<Single most important PR or decision for the human to look at>
```

Then run `bacta-wrap` Steps 1–4 only (type check, tests, Playwright cleanup). No commit needed — the per-issue commits are already pushed.

---

## Quick Reference

| Situation | Action |
|---|---|
| Baseline tests fail at session start | Stop. Comment on oldest bug issue. Exit. |
| Can't state acceptance criteria | Skip → Phase 7 (VAGUE) |
| Can't write a failing test | Skip → Phase 7 (NOT_TESTABLE + code) |
| Test passes green immediately | Stop. Re-read the issue. Reassess. |
| Tests fail after 3 approaches | Draft PR → Phase 6b. Next issue. |
| 3 identical tool calls in a row | Abort issue. Draft PR. Next issue. |
| UI change without visual check | Not done. Run Playwright. |
| Type errors after implementation | Fix before PR. Never commit type errors. |
| 6 issues processed | Write session summary. Stop. |
| Context running low | Write session summary. Stop cleanly. |
| Tempted to push to main | Create a PR instead. |
| Tempted to merge | That is the human's job. Stop. |

---

## Common Mistakes

| Mistake | Consequence |
|---|---|
| Skipping the triage gate | Wastes time on unimplementable issues |
| Writing implementation before the failing test | Violates TDD — the test proves nothing |
| Using `git add -A` | Accidentally stages `.env`, screenshots, stray files |
| Starting a 7th issue | Context exhaustion mid-issue; unfinished work is worse than no work |
| Silent skip (no comment) | Human has no visibility into what was attempted |
| Merging the PR | Human review is non-negotiable for autonomous work |
| Not closing the Playwright browser | Chrome process accumulates in background |
