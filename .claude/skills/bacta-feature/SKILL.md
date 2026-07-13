---
name: bacta-feature
description: Use when starting any new feature, section, or significant UI work in Bacta
---

# Bacta Feature Workflow

## Overview
Enforces the read-first → brainstorm → plan → branch → implement → verify → PR sequence that keeps Bacta's visual and data layers consistent across sessions. This is the interactive counterpart to `bacta-issues`/`bacta-headless`/`bacta-pr-review`: use it for a whole new section or major UI surface built in one sequential session, not for discrete backlog items (those go through the issues/headless queue). It ends the same way headless PRs do — a PR reviewed by `bacta-pr-review`, never a direct commit to `main`. If the work involves creating a new reusable component, invoke `bacta-component` during Phase 3.

## Phase 0 — Read Protocol (before touching any code)

**First, check for a per-section design handoff:** does `design_handoff_<section>_v<n>/` exist at the repo root (e.g. `design_handoff_nutrition_v4/`)?

- **If yes:** follow that directory's own `CLAUDE_CODE_PROMPT.md` read order instead of the list below — it supersedes this list and is written specifically for that section's implementation.
- **If no:** read in this order:
  1. Open `design_bacta-handoff-package/Bacta - Prototype v3.html` in browser — this is the visual spec
  2. `CLAUDE.md` — conventions and current state
  3. `client/src/theme.ts` — authoritative design tokens
  4. Relevant section hooks (`useRecoveryData`, `useSleepData`, `useTrainingData`)
  5. Relevant section page (`RecoveryPage.tsx`, `SleepPage.tsx`, `TrainingPage.tsx`)
  6. Any existing viz components you'll reuse (`client/src/components/viz/`)

If adding a new API endpoint: also read `server/api/garmin.ts` for route ordering conventions (specific routes must come before `/:param` wildcards).

## Phase 1 — Brainstorm

- **If a design handoff exists (Phase 0):** its product/UX decisions were already made in Claude Design — skip full `superpowers:brainstorming`. Instead hold a short scoped discussion covering only:
  - Whatever the handoff's README explicitly flags as unresolved (look for an "open decisions" or "out of scope" note)
  - Implementation-only questions: branch name, worktree, build-order sequencing (the handoff's `CLAUDE_CODE_PROMPT.md` usually suggests a build order — confirm or adjust it)
  - Does this require a new reusable component? (If yes: invoke `bacta-component` in Phase 4)
- **If no handoff exists:** invoke `superpowers:brainstorming` in full, covering what the user sees/interacts with, data needs, reusable components, and edge cases (missing data, sparse metrics, conditional display).

## Phase 2 — Plan
**REQUIRED:** Invoke `superpowers:writing-plans` before writing any code.

Plan must include:
- Files to create (minimize — prefer editing existing)
- Files to modify
- Phased sequence: zero-new-polling first, new endpoints second (or the handoff's suggested build order, if one exists)
- TypeScript interfaces needed

## Phase 3 — Branch & Isolation
**REQUIRED — matches `bacta-headless`'s model, not direct-to-main.**

1. Branch off `main`: `feature/<section>` (e.g. `feature/nutrition`) — never commit directly to `main`.
2. Invoke `superpowers:using-git-worktrees` to isolate the build in `worktrees/` (gitignored). This is a multi-session build; isolation protects it from concurrent `bacta-headless` runs or scheduled routines touching the shared repo.
3. Confirm a clean baseline in the worktree before implementing: `npm test`.

## Phase 4 — Implement

### New reusable component?
If this feature requires a new reusable UI component, invoke `bacta-component` now before writing it.

### Hard constraints — no exceptions
- **Inline styles only** — no CSS files, no Tailwind, no CSS modules in components
- **Dark UI always** — never add light mode
- **Numbers/labels:** `fontFamily: "'JetBrains Mono', ui-monospace, monospace"`
- **Prose/narrative:** `fontFamily: "'Hanken Grotesk', system-ui, sans-serif"`
- **Colors:** always from `theme.ts` — never hardcode hex values in components
- **RGBA:** always `hexA(hex, alpha)` from `client/src/lib/hexA.ts`
- **Prefer editing existing files** over creating new ones
- `INSERT OR IGNORE` for idempotent DB writes

### Card size system (`minHeight`, never `height`)
| Size | px | Use for |
|---|---|---|
| hero | 220 | Score gauges |
| chart | 170 | Full chart cards |
| bar | 140 | 7-bar trend cards |
| pair | 110 | Half-width paired cards |
| tile | 88 | 2×2 quarter-grid tiles |
| row | 52 | Status banners, compact rows |

### Section accents
Always read from `theme.ts` (`SECTION_ACCENTS`). Older handoff docs may have wrong Round 1 values — `theme.ts` is authoritative.

## Phase 5 — Visual Verification
**REQUIRED after each section is implemented. Do not move to the next section until this passes.**

1. `/run` — launch the app
2. Playwright `browser_navigate` to the section
3. `browser_take_screenshot` — compare against the prototype or handoff screenshots
4. Fix any discrepancies before continuing
5. When verification is complete: call `browser_close`

## Phase 6 — Code Review
**REQUIRED before opening a PR:** invoke `/code-review` on changed files. This is your own pass, separate from the fresh-context pass Phase 7 gets via `bacta-pr-review`.

## Phase 7 — PR & Merge
**REQUIRED — stop here, do not merge yourself.**

1. Push the branch and open a PR (not draft — this is a completed build, not a partial headless attempt):
```bash
git push origin feature/<section>
gh pr create --repo bridgemouse/bacta --title "<concise title>" --body "<what/why, screens covered, any known gaps>"
```
2. Hand off to `bacta-pr-review` for the merge — same review bar every other PR gets (fresh `/code-review` at high effort, collision-zone check, client rebuild-on-merge step). This may be a separate session. Do not merge outside that skill, even for a PR you authored yourself — the point is a second, fresh-context look.

## Common Mistakes
| Mistake | Fix |
|---|---|
| CSS classes instead of inline styles | Delete and rewrite inline |
| Hardcoded hex color values | Replace with `COLORS.*` or `SECTION_ACCENTS.*` from `theme.ts` |
| `height` instead of `minHeight` on cards | Cards won't grow with content |
| Phase B before Phase A is verified | Always Playwright-verify current section first |
| Skipping brainstorm "because it's simple" | Even simple additions drift without it — but see Phase 1: a design handoff replaces this, it doesn't waive it |
| Committing straight to `main` | Always `feature/<section>` branch + PR, per Phase 3 |
| Merging your own PR without `bacta-pr-review` | Skips the fresh-context review gate every other PR gets |
