---
name: bacta-wrap
description: Use at the end of any Bacta development session before closing
---

# Bacta Session Wrap

## Overview
Closes a session cleanly: type-check, test, visual spot-check, clean up Playwright artifacts, commit, sync docs, capture memory.

## Step 1 — Type Check
```bash
npx tsc --noEmit
npx tsc -p tsconfig.server.json --noEmit
```
Fix all errors before proceeding. Do not commit with type errors.

## Step 2 — Tests
```bash
npm test
```
Fix all failures before proceeding.

## Step 3 — Visual Spot Check (if UI was touched)
- `/run` — confirm the app starts clean
- Playwright: navigate to each modified section, take one screenshot
- Confirm no regressions in adjacent sections (check at least one neighbouring section)

## Step 4 — Playwright Cleanup
After visual verification is done:
1. Call `browser_close` — closes the Playwright browser process
2. Run:
```bash
rm -rf /tmp/pw-*
```
Playwright accumulates browser profile dirs in `/tmp/pw-*` across verification rounds. These are unused after the session and should be cleared every time.

## Step 5 — Commit
- Stage only intentional files — no `.env`, no stray debug files, no screenshot artifacts
- Commit message: explain WHY, not what (the diff shows what)
- Push to `main`

## Step 6 — ROADMAP.md Sync
Update `docs/ROADMAP.md` if any of these are true:
- A task moved to complete
- A new blocker was discovered
- Something was deferred that wasn't previously noted
- A known issue was resolved

## Step 7 — Session Observation
Record a claude-mem observation capturing:
- What was completed this session
- What was discovered (API quirks, data gaps, component gotchas)
- What's next (so the next session has a clean starting point)

## Common Mistakes
| Mistake | Consequence |
|---|---|
| Committing with TypeScript errors | Breaks CI; next session opens with broken state |
| Skipping Playwright cleanup | `/tmp/pw-*` dirs accumulate and waste disk |
| Not closing the browser | Playwright Chrome process runs in background |
| Skipping ROADMAP.md update | Next session has stale context, reruns discovery work |
| No observation recorded | Context is lost between sessions |
