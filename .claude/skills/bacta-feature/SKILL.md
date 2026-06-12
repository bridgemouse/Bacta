---
name: bacta-feature
description: Use when starting any new feature, section, or significant UI work in Bacta
---

# Bacta Feature Workflow

## Overview
Enforces the read-first → brainstorm → plan → implement → verify sequence that keeps Bacta's visual and data layers consistent across sessions. If the work involves creating a new reusable component, invoke `bacta-component` during Phase 3.

## Phase 0 — Read Protocol (before touching any code)

Read in this order:
1. Open `design_bacta-handoff-package/Bacta - Prototype v3.html` in browser — this is the visual spec
2. `CLAUDE.md` — conventions and current state
3. `client/src/theme.ts` — authoritative design tokens
4. Relevant section hooks (`useRecoveryData`, `useSleepData`, `useTrainingData`)
5. Relevant section page (`RecoveryPage.tsx`, `SleepPage.tsx`, `TrainingPage.tsx`)
6. Any existing viz components you'll reuse (`client/src/components/viz/`)

If adding a new API endpoint: also read `server/api/garmin.ts` for route ordering conventions (specific routes must come before `/:param` wildcards).

## Phase 1 — Brainstorm
**REQUIRED:** Invoke `superpowers:brainstorming` before implementing any new component or data shape.

Cover:
- What does the user see and interact with?
- What data does it need and where does it come from?
- Which existing components can be reused?
- Does this require a new reusable component? (If yes: invoke `bacta-component` in Phase 3)
- What are the edge cases — missing data, sparse metrics, conditional display?

## Phase 2 — Plan
**REQUIRED:** Invoke `superpowers:writing-plans` before writing any code.

Plan must include:
- Files to create (minimize — prefer editing existing)
- Files to modify
- Phased sequence: zero-new-polling first, new endpoints second
- TypeScript interfaces needed

## Phase 3 — Implement

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

## Phase 4 — Visual Verification
**REQUIRED after each section is implemented. Do not move to the next section until this passes.**

1. `/run` — launch the app
2. Playwright `browser_navigate` to the section
3. `browser_take_screenshot` — compare against the prototype
4. Fix any discrepancies before continuing
5. When verification is complete: call `browser_close`

## Phase 5 — Code Review
**REQUIRED before marking complete:** invoke `/code-review` on changed files.

## Common Mistakes
| Mistake | Fix |
|---|---|
| CSS classes instead of inline styles | Delete and rewrite inline |
| Hardcoded hex color values | Replace with `COLORS.*` or `SECTION_ACCENTS.*` from `theme.ts` |
| `height` instead of `minHeight` on cards | Cards won't grow with content |
| Phase B before Phase A is verified | Always Playwright-verify current section first |
| Skipping brainstorm "because it's simple" | Even simple additions drift without it |
