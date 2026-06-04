# Bacta — Handoff Package v3
**Date:** June 4, 2026

## Start Here

1. **Open `Bacta - Prototype v3.html`** in a browser — this is the full interactive prototype.
   All 6 sections (Home, Recovery, Sleep, Training, Labs, Daily Log) are clickable and scrollable.

2. **Read `bacta-handoff-v3.md`** — the complete implementation spec.
   - Section 2: exact gap analysis (what's live vs. what needs wiring)
   - Section 6: prioritized 4-phase implementation plan
   - Section 7: TypeScript data shape contract for all new hook fields

3. **Read `garmin-data-reference.md`** — full Garmin metric inventory with row counts,
   API endpoint docs, and known constraints. Essential context before touching any data layer.

## Package Contents

```
Bacta - Prototype v3.html     ← Open this first — full interactive UI reference
bacta-handoff-v3.md           ← Implementation spec (READ THIS)
garmin-data-reference.md      ← Garmin data inventory + API docs
CLAUDE_CODE_BRIEFING-v1.md    ← Original Round 1-2 design spec (shell/token reference)

scripts/
  probe_training_status.py    ← Run with --all to investigate Garmin Coach data

src/                          ← All prototype component source files
  bacta-core.jsx              ← Design tokens, shared primitives (hexA, Gauge, Ring, etc.)
  bacta-data.jsx              ← Base stub data shape
  bacta-data-v2.jsx           ← Real Garmin data (2026-06-02 values)
  bacta-v3-data.jsx           ← v3 new metrics (intraday, trends, labs, daily log)
  bacta-viz.jsx               ← Base visualizations (MX4Briefing, SleepDepth, etc.)
  bacta-viz-v2.jsx            ← v2 viz components (HealthStatusTile, MetricRingTile)
  bacta-v3-viz.jsx            ← v3 viz (BodyBatteryArc, HRVDirectionBadge, StageSplitV3)
  bacta-v3-infocard.jsx       ← InfoCard with tap-to-reveal overlay + 6-tier size system
  bacta-final.jsx             ← App shell (StatusBar, Dock, SystemCard)
  bacta-navsheet.jsx          ← All Systems nav sheet + Ask MX-4 sheet
  bacta-app.jsx               ← BactaApp root (routing, state)
  bacta-v3-app.jsx            ← v3 app shell with sync button states
  bacta-home.jsx              ← Home section (Overview + Trends)
  bacta-v3-recovery.jsx       ← Recovery section (v3 layout + card configs)
  bacta-v3-sleep.jsx          ← Sleep section (v3 layout + card configs)
  bacta-v3-training.jsx       ← Training section (v3 layout + card configs)
  bacta-v3-bloodwork.jsx      ← Labs section
  bacta-v3-dailylog.jsx       ← Daily Log section
  ios-frame.jsx               ← iOS device frame component
```

## Quick Reference — What Needs Backend Work

### Zero new polling (use existing DB)
- HRV direction badge — linear regression on existing 7-day hrv trend
- Architecture score — formula from existing stage seconds
- Peak stress sparkline — `stress_max` already has 54 rows, just fetch trend
- Fitness age 30d trend — 368 rows exist, extend VALID_METRICS
- Load ratio — extend fetchTrend to 42 days, compute acute÷chronic

### New SQL queries (existing garmin_activities table)
- Weekly volume chart — `SUM(duration_s)/3600 GROUP BY strftime('%W', date)`
- Avg activity HR by week — `AVG(avg_hr) GROUP BY week`

### New polling required
- Body battery intraday arc — `get_body_battery(date, date)`
- Sleep consistency card — extract `sleepStartTimestampGMT` from stats
- Run dynamics + per-activity HR zones — `get_activity()` + `get_activity_hr_in_timezones()`
- Garmin Coach phase — run `scripts/probe_training_status.py --all`

### New sections
- Labs — confirm `blood_work` table schema, add `/api/bloodwork/*` routes
- Daily Log — new `daily_behaviors` table + `/api/behaviors/:date` CRUD

## Design Tokens

```
base:      #0f1117    app background
surface:   #111827    card backgrounds
elevated:  #1e2d3d    elevated surfaces
line:      #27384a    borders/hairlines
text:      #f4f7fb    primary
text2:     #94a3b8    secondary
text3:     #56657a    meta/axis

Accents:
  Home/MX-4:  #2bc4e8
  Recovery:   #64b5f6
  Training:   #fb923c
  Sleep:      #a78bfa
  Labs:       #ef6f6c
  Daily Log:  #f5cf5e

Fonts:
  UI/body: 'Hanken Grotesk', system-ui
  Mono:    'JetBrains Mono', ui-monospace
```
