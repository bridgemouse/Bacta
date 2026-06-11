# QA Sweep Session Prompt

Paste this prompt at the start of a new Claude Code session.

---

You are working on **Bacta** — a private health dashboard iOS PWA for one user (Ethan). Dark sci-fi instrument console aesthetic. React 19 + TypeScript + Vite frontend, Node/Express + SQLite backend. Read `CLAUDE.md` in full before doing anything else — it is the authoritative project guide covering stack, conventions, component tree, and current build state.

## Mission

Full codebase QA sweep using two audit documents produced in the previous session, followed by targeted fixes, new data cards, and a written report.

---

## Phase 0 — Orient (complete before touching any code)

Read these in full:

1. `CLAUDE.md` — authoritative project guide
2. `docs/garmin-api-reference.md` — live API audit against Garmin Venu 4; endpoint catalog, confirmed field names, response shapes, v0.3.5 breaking changes, known gaps
3. `docs/data-usage-audit.md` — confirms which data paths are correct, which are bugs, what's missing, what's an opportunity
4. `design_bacta-handoff-package/` — v3 design handoff. Use as a **reference point only** — the app has iterated significantly since this was produced. Do not treat it as the source of truth for anything: component names, colors, or data. When it conflicts with `CLAUDE.md` or the actual codebase, the codebase wins.

Also read:
- `client/src/theme.ts` — authoritative color tokens and font constants
- All files in `client/src/pages/` — current section implementations
- All files in `client/src/hooks/` — current data hooks
- `client/src/lib/InfoCardContext.tsx` — InfoCard pattern (used throughout)

---

## Phase 1 — Fix confirmed bugs from the audit

Fix every open bug listed in `docs/data-usage-audit.md`. The two highest-priority unfixed items are:

**1. `get_rhr_day` navigation broken (`scripts/garmin_poller.py`)**
`safe(s, 'restingHeartRate')` always returns None. The actual response shape is:
```python
s['allMetrics']['metricsMap']['WELLNESS_RESTING_HEART_RATE'][0]['value']
```
Either fix the navigation path or remove the call entirely — `resting_hr` is already correctly stored via the `get_stats` block, so this call is redundant. Removing is cleaner.

**2. Recovery "OVERNIGHT VITALS" shows `stress_avg` (24h daytime)**
The rail is labeled "OVERNIGHT VITALS" but displays `stress_avg`, which is Garmin's 24-hour average including daytime stress. `sleep_stress` (HRV-derived during sleep only) is the correct metric here. It is already in the DB and already fetched in `useSleepData`. Wire it into `useRecoveryData` and update `RecoveryPage`.

**3. Sleep duration uses stage sum instead of `sleep_s`**
Both `useSleepData` and `useHomeData` compute duration as `(deepS + lightS + remS) / 60`. `sleep_s` is now correctly stored in the DB (fixed in prior session). Switch to `sleep_s` as the primary source with stage-sum as fallback:
```typescript
const sleepS = summary.sleep_s ?? (deepS + lightS + remS)
const totalMins = Math.round(sleepS / 60)
```

---

## Phase 2 — Web-verify all InfoCard content

Every section page defines `CardInfo` objects with `title`, `description`, and `source` fields. These are displayed in info overlays when the user taps a card. Use web search to verify every one of them:

- Is the label and unit we display what Garmin actually measures?
- Are the healthy-range thresholds we state medically accurate? (Check: AHA guidelines for RHR, ACSM norms for VO2max, AASM/Sleep Foundation for sleep stage targets, ESC/Garmin docs for HRV ranges)
- Is the descriptive copy accurate and not misleading?
- Does the `source` field correctly attribute the sensor/method? (Pattern: `'Garmin Venu 4 · [sensor or method]'`)

Also verify that Garmin's own documentation matches how we're computing or describing each metric — particularly: recovery score, body battery, training readiness, sleep score, training effect labels.

Flag anything wrong, corrected, or uncertain. Update any InfoCard content that is inaccurate.

---

## Phase 3 — New data cards

The `docs/garmin-api-reference.md` identifies data available in the API but not yet shown. Evaluate and implement:

**Implement (high priority):**

- **`recovery_time`** — `get_training_readiness(yesterday)` returns `recoveryTime` in hours (time until full recovery). This is not currently stored in DB. Add storage in `garmin_poller.py` (use `store(db, d_yesterday, 'recovery_time_h', ...)` pattern), add to the server summary whitelist, add to `useRecoveryData`, and surface in Recovery overview as a new card between the HRV card and the RHR/Stress row.

- **`sleep_stress` in Recovery** — already required by Phase 1 bug fix, but also consider a dedicated Trends row for it in the Recovery Trends tab.

**Evaluate and implement if clean:**

- **`body_battery_charged` / `body_battery_drained`** — currently stored under misleading names `body_battery_max` / `body_battery_min`. Rename the DB metrics (migration + poller + ingest update) and consider whether a "battery cycle" context display adds value to Recovery overview.
- **`race_predictions`** — check if any data is in the DB. If so, surface in Training section.
- **`achievable_fitness_age`** — if available alongside `fitness_age`, show as a goal/target annotation on the fitness age card.

**For each new card/row added:**
- Add poller storage if the metric isn't in DB yet
- Add to server `ALLOWED_METRICS` whitelist if needed
- Add to the relevant hook
- Build UI using existing viz primitives — do not create new components unless nothing in `client/src/components/viz/` fits

---

## Phase 4 — Additional sweep

With full context from the docs and your own codebase reading, look for:
- Metrics fetched from the API but never displayed anywhere
- Metrics displayed but sourced from a suboptimal field (reference `docs/garmin-api-reference.md` for preferred fields)
- Any remaining stub data in `stubData.ts` that should have been replaced by live data
- Any hooks, server endpoints, or display logic that looks wrong given the API audit findings

---

## Phase 5 — Visual verification

After each significant UI change, use Playwright MCP to screenshot the affected section and verify layout. The outer shell is `position: fixed; overflow: hidden` — `fullPage` screenshots only capture the viewport. To screenshot scrolled content:
```javascript
// via browser_evaluate before screenshotting:
document.querySelector('[style*="overflow-y: auto"]').scrollTop = 400
```
Check that new cards match the section's design language: spacing, font sizes, color usage, card borders.

---

## Phase 6 — Report

Write `docs/qa-sweep-report.md` covering:
- All bugs fixed (before/after)
- All new cards/metrics added
- Web-verification findings (confirmed correct / corrected / still uncertain)
- Any remaining issues found but out of scope for this session
- Anything deferred and why

---

## Established coding conventions — follow exactly

These are non-negotiable patterns already in use throughout the codebase.

### Styling
- **Inline styles only.** No CSS files, no Tailwind, no CSS modules. The only global CSS is keyframe animation names in `client/index.css`.
- **Dark UI always.** Never introduce light mode.
- **`hexA(hex, alpha)`** — always use this util (`client/src/lib/hexA.ts`) for any translucent color. Never write `rgba()` directly.
- **`bactaTexture(accent)`** — use for scanline/grid background texture on elevated surfaces.
- **`COLORS.*` and `FONT_MONO` / `FONT_UI`** — always import from `client/src/theme.ts`. Never hardcode hex strings or font names in component files.
- **Section accent** — always `const A = COLORS.<section>` at the top of the page component. Thread `A` through to all child components via `accent={A}` prop.

### InfoCard pattern
Every tappable metric card uses this exact pattern:

```typescript
// 1. Define CardInfo at file top (not inline):
const MY_METRIC_INFO: CardInfo = {
  title: 'Metric Name',
  description: 'What it measures and why it matters.',
  source: 'Garmin Venu 4 · [sensor or method]',
}

// 2. In component body:
const { isOpen, handleTap } = useCardInfoOverlay('unique-card-id', MY_METRIC_INFO, A)

// 3. In JSX, tap target:
<div onClick={handleTap} style={{ position: 'relative', ... }}>
  {/* card content */}
  {isOpen && <InfoOverlay info={MY_METRIC_INFO} accent={A} radius={11} onClick={handleTap} />}
</div>

// 4. Wrap page root:
<InfoCardProvider>
  {/* page content */}
</InfoCardProvider>
```

### Trends section pattern
Trends tab rows use config-driven `TREND_SECTIONS` object, not ad-hoc inline props:
```typescript
const TREND_SECTIONS = {
  myMetric: {
    railLabel: 'METRIC LABEL',
    period:    '7 DAYS',
    subtext:   'context sentence explaining the trend',
    info:      MY_METRIC_INFO,
  },
  // ...
}
```

### Typography
- **All numbers, units, labels, readouts:** `fontFamily: FONT_MONO` (JetBrains Mono)
- **Prose, narrative, headlines:** `fontFamily: FONT_UI` (Hanken Grotesk)
- Never mix these up on a single element.

### Components
- **Rail** — section dividers: `<Rail label="LABEL" accent={A} right="SUBLABEL" />`
- **HealthStatusTile** — overnight vitals tile with accent chrome and status dot
- **VitalTile** — compact secondary metric tile
- **HeadlineCard** — two-up headliner card shell for primary metrics
- Prefer editing existing components over creating new ones.

### Animation
Use keyframe names defined in `client/index.css`: `mx4spin`, `mx4breathe`, `mx4ping`, `mx4tele`, `mx4blink`, `mx4glowbreathe`, `mx4shimmer`. Reference by name in inline `animation` strings.

### Backend / DB
- **Query DB with Python**, not `sqlite3` CLI (not installed on this host) and not `node -e`:
  ```bash
  python3 -c "import sqlite3,json; db=sqlite3.connect('/opt/bacta/data/bacta.db'); [print(json.dumps(dict(r))) for r in db.execute('SELECT ...').fetchall()]"
  ```
- **`INSERT OR IGNORE`** for idempotent snapshot writes; **`INSERT OR REPLACE`** for activity rows.
- **Specific Express routes before `/:param` wildcards** — define `/activities`, `/sync/status`, etc. before `/:metric` or they get swallowed.
- **Summary endpoint uses `MAX(date)` per metric** — never hardcode `date = 'now'`; metrics arrive at different times.

### Python scripts
- **Validate syntax before committing:**
  ```bash
  python3 -c "import py_compile; py_compile.compile('scripts/foo.py', doraise=True)"
  ```
- Variable names differ between `garmin_poller.py` and `garmin_ingest.py` — match the existing pattern in whichever file you're editing; don't copy-paste between them.

### Type checking and tests
After any TypeScript change:
```bash
npx tsc --noEmit                              # client
npx tsc -p tsconfig.server.json --noEmit     # server
npm test                                      # all tests
```
Fix all type errors before committing.

### Git
- Commits go to `main` directly. No feature branches unless asked.
- Commit message: concise, imperative, explains the why not the what.
- Always add `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer.

---

## Skills and tools — use these

- **`superpowers:brainstorming`** — before implementing any new card in Phase 3, brainstorm the approach. Do not skip this.
- **`superpowers:writing-plans`** — after brainstorming, write an implementation plan before executing Phase 3.
- **`superpowers:subagent-driven-development`** — execute the Phase 3 plan using this skill.
- **Context7** — for any React, TypeScript, SQLite, or Express API questions. Fetch current docs rather than relying on training data.
- **Playwright MCP** — visual verification after every UI change (Phase 5).
- **Web search / WebFetch** — Phase 2 requires external verification against Garmin docs, AHA guidelines, ACSM norms, Sleep Foundation references. Use liberally.
- **`/code-review`** — run before committing significant changes.
