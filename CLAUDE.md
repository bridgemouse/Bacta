# Bacta — Developer Guide

## What This Is

Bacta is a private health dashboard iOS PWA for one user: **Ethan**. It pulls biometrics nightly from Garmin Connect. An AI companion named **MX-4** (Star Wars-inspired droid, bacta-cyan identity `#2bc4e8`) narrates the data. The aesthetic is a dark sci-fi instrument console — not a health app, not a wellness product.

Saved to iPhone home screen, runs on local WiFi only (`bacta.local`). Runs on **LXC 109** (Debian 13) in a home Proxmox cluster. **No Docker.** Deploy path: `/opt/bacta`.

---

## CRITICAL CONVENTIONS — READ FIRST

- **Inline styles only.** No CSS files, no Tailwind, no CSS modules in components. Global CSS keyframe animations are defined in `client/index.css` and referenced by name in `animation` strings.
- **Dark UI always.** Never propose or implement light mode.
- **No multi-line paste** in terminal — use scripts or files.
- Commits go to `main` directly. No feature branches unless specified.
- `INSERT OR IGNORE` for idempotent DB writes.
- **Prefer editing existing files** over creating new ones.
- Do not add comments unless the WHY is genuinely non-obvious.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node/Express + TypeScript |
| Database | SQLite via `better-sqlite3` |
| Tests | Vitest + Testing Library |
| CI | GitHub Actions, self-hosted runner on LXC 109 |

**Dev commands:**
```bash
npm run dev:client     # Vite dev server
npm run dev:server     # Express dev server
npm run test:client    # Vitest client tests
npm run test:server    # Vitest server tests
npm test               # All tests
npx tsc --noEmit       # Type check client
npx tsc -p tsconfig.server.json --noEmit  # Type check server
```

---

## Design System

### Colors (in `client/src/theme.ts`)
```ts
MX4_COLOR = '#2bc4e8'   // bacta cyan — MX-4 identity

COLORS.base            = '#0f1117'   // app background
COLORS.surface         = '#111827'   // card/panel
COLORS.surfaceElevated = '#1e2d3d'   // elevated surfaces
COLORS.border          = '#1e2d3d'
COLORS.line            = '#27384a'   // hairlines, dividers
COLORS.text            = '#f4f7fb'   // primary text
COLORS.textSecondary   = '#94a3b8'
COLORS.textMuted       = '#56657a'
COLORS.mx4Green        = '#4ade80'   // POSITIVE tone only
COLORS.mx4Amber        = '#fbbf24'   // CAUTION tone only
COLORS.mx4Red          = '#f87171'   // FLAG tone only
```

### Section Accents (locked — do not change)
```ts
home:      '#2bc4e8'   // MX-4 cyan — his own surface
recovery:  '#7c9af8'   // periwinkle
training:  '#f5853a'   // ember
sleep:     '#b08cf0'   // lilac
nutrition: '#3ecf8e'
bloodwork: '#ef6f6c'
dailylog:  '#f5cf5e'
```

> **Note:** The `design_handoff_bacta_sections` README uses slightly different section accent values — use the values from `client/src/theme.ts` (above), which are authoritative for the codebase.

### Fonts
- **UI / body:** `'Hanken Grotesk', system-ui, sans-serif` — narrative prose, headlines
- **Mono:** `'JetBrains Mono', ui-monospace, monospace` — ALL numbers, labels, readouts

### CSS Keyframes (in `client/index.css`)
`mx4spin`, `mx4breathe`, `mx4ping`, `mx4tele`, `mx4blink`, `mx4glowbreathe`, `mx4shimmer`

### Utility Functions
- `client/src/lib/hexA.ts` — `hexA(hex, alpha)` converts hex + alpha → `rgba(r,g,b,a)`
- `client/src/lib/bactaTexture.ts` — `bactaTexture(accent)` generates scanline/grid CSS background

---

## Architecture

### App Shell Structure
```
<AppShell section={...}>
  <fixed column, full viewport>
    <TopBar />                  // BactaStatusBar — ~52px, fixed
    <content zone />            // flex:1, overflow-y:auto, padding 13px
    <BottomBar />               // BactaDock — fixed, always MX-4 cyan
  </fixed>
  <BottomSheet />               // NavSheet — All Systems slide-up
  <AskSheet />                  // Ask MX-4 slide-up
</AppShell>
```

**TopBar modes:**
- Home: `BACTA·OS` + idle MX4Sigil + MX-4 ONLINE indicator
- Section: back chevron + section Sigil + channel label

**BottomBar:** Ask MX-4 circle (left) + Overview/Trends toggle (center, built sections only) + Nav circle (right). **Always MX-4 cyan.**

### Component Tree
```
client/src/
├── theme.ts                          # Design tokens
├── lib/
│   ├── hexA.ts
│   ├── bactaTexture.ts
│   ├── TabContext.ts                  # Tab state context (overview/trends)
│   └── stubData.ts                   # Mock metric data
├── components/
│   ├── AppShell.tsx                  # Fixed iOS shell — top/content/bottom
│   ├── TopBar.tsx                    # BactaStatusBar
│   ├── BottomBar.tsx                 # BactaDock
│   ├── BottomSheet.tsx               # NavSheet (All Systems)
│   ├── AskSheet.tsx                  # Ask MX-4 sheet
│   ├── Sheet.tsx                     # Animated bottom-sheet wrapper
│   ├── MX4Card.tsx                   # TransmissionPanel (MX4Briefing deprecated, still used for briefing text stub)
│   ├── MetricTile.tsx                # SystemCard + MetricTile
│   ├── SectionShell.tsx              # Calibrating skeleton for unbuilt sections
│   └── primitives/
│       ├── MX4Sigil.tsx              # 6 moods: transmit/idle/listen/think/alert/pleased
│       ├── Sigil.tsx                 # Per-section geometric icons
│       ├── NavIcon.tsx               # Hex menu icon
│       ├── Ring.tsx                  # Circular progress ring
│       ├── Sparkline.tsx             # Area sparkline
│       ├── StatusCore.tsx            # Breathing status dot
│       ├── ReadinessDots.tsx         # 1–5 dot readiness
│       ├── Bracket.tsx               # Four-corner console bracket ticks
│       └── FTelemetry.tsx            # Animated telemetry bars
│   └── viz/
│       ├── Bars7.tsx                 # 7-bar chart
│       ├── BodyBattery.tsx           # Charge-cell bar
│       ├── Delta.tsx                 # ▲/▼ change badge
│       ├── Gauge.tsx                 # 270° arc gauge
│       ├── HeadlineCard.tsx          # Two-up headliner card shell
│       ├── IntensityBar.tsx          # Stacked moderate/vigorous
│       ├── LoadBand.tsx              # Horizontal load band
│       ├── LogEntry.tsx              # Activity log line
│       ├── Rail.tsx                  # Section divider rail
│       ├── HealthStatusTile.tsx       # Overnight vitals tile — accent chrome, StatusCore dot badge for inRange
│       ├── SleepDepth.tsx            # Topographic sleep depth chart
│       ├── StageDistribution.tsx     # Sleep stage bar (pct labels) + breakdown rows + footer
│       ├── StatusBanner.tsx          # Training status hero panel
│       ├── TrendRow.tsx              # Trends-tab row
│       ├── VitalTile.tsx             # Compact secondary metric tile
│       └── ZoneDistribution.tsx      # HR zone vertical list with bars + summary footer
├── hooks/
│   ├── useHomeData.ts                # Home SystemCard live data
│   ├── useRecoveryData.ts            # Recovery live data (fetches from /api/garmin)
│   ├── useSleepData.ts               # Sleep live data
│   ├── useTrainingData.ts            # Training live data (incl. HR zones, activities)
│   └── useSyncState.ts              # Sync button state
└── pages/
    ├── HomePage.tsx                  # Overview: MX4Briefing + SystemCard grid; Trends: cross-channel week
    ├── RecoveryPage.tsx              # COMPLETE: briefing + gauge + HRV + vitals; Trends: 6 metric rows
    ├── SleepPage.tsx                 # COMPLETE: briefing + duration + SleepDepth + StageSplit; Trends
    ├── TrainingPage.tsx              # COMPLETE (v3): briefing + status + zones + log; Trends
    ├── NutritionPage.tsx             # SectionShell (calibrating)
    ├── BloodWorkPage.tsx             # SectionShell (calibrating)
    └── DailyLogPage.tsx              # SectionShell (calibrating)
```

---

## Current State & Pending Work

### What's Complete (as of Jun 2026)

**Frontend:**
- App shell, TopBar, BottomBar, NavSheet, AskSheet, tab toggle — all complete
- All viz components in `components/viz/` including `ZoneDistribution` (Jun 2026)
- Home Overview + Trends: live data via `useHomeData` + cross-section `TrendRow` week view
- Recovery Overview + Trends: live data, all viz wired — **missing Body Battery HeadlineCard**
- Sleep Overview + Trends: live data, `SleepDepth` + `StageDistribution` (pct labels in top bar, per-stage rows) all wired
- Training Overview + Trends: live data, v3 layout (fitness age, ACWR, HR zones, activity log)
- Nutrition, BloodWork, DailyLog: `SectionShell` calibrating placeholders (correct — no data yet)

**Backend:**
- All API endpoints live: `/api/garmin/summary`, `/api/garmin/:metric`, `/api/garmin/activities`, `/api/garmin/weekly-volume`, `/api/garmin/weekly-avg-hr`, `/api/garmin/sync`
- DB healthy: ~4,500 garmin_snapshots (47 metrics), 64 garmin_activities, current through today
- Sparse metrics: `vo2max` (10 days), `spo2_avg` (5 days), `endurance_score` (0 days — not collected)
- `macrofactor_snapshots`, `blood_work`, `manual_inputs` tables exist but are empty

**Data pipeline:**
- `scripts/garmin_ingest.py` — historical import (365 days, ~35 min)
- `scripts/garmin_poller.py` — nightly 3AM via `bacta-garmin.timer` systemd unit
- Garmin tokens at `~/.garminconnect` on LXC 109

**Data stubs still in use:** `client/src/lib/stubData.ts` → `BRIEFS` (MX-4 briefing text). All metric data is live; only the AI narrative text is still stubbed.

### What's Next (in priority order)
1. **MX-4 orchestrator** — `mx4/orchestrator.py` has **never been run**. `insights/` is empty. All sections show static stub briefing text from May 29. Run manually to test, then schedule. This is the highest-impact remaining work.
2. **Body Battery in Recovery Overview** — `useRecoveryData` already fetches `body_battery_wake`/`body_battery_current` into `rec.battery`, but `RecoveryPage` never renders it. Add a `HeadlineCard` with the `BodyBattery` component between the HRV card and RHR/Stress row.
3. **LogEntry Phase C** — expand panel content (training effect, HR zones per activity) currently behind `hasContent = false` flag in `LogEntry.tsx`

**Deferred:** MacroFactor/Nutrition (no account), Blood Work (waiting on lab results), Daily Log (no data source)

---

## MX-4

MX-4 is the AI companion embedded in Bacta. He is a Cybot Galactica droid (not production line) with three personality matrices: TC-series baseline (cool, unflappable), Nines/TC-99 (intellectual, pushes back), Two-Boots/2B0T (protocol-transparent, Richard Ayoade deadpan). **Does not serve — collaborates.**

- `mx4/orchestrator.py` — scheduled Claude Code CLI job. Reads Garmin data + vault notes, writes HTML briefings to `insights/`
- `mx4/system-prompt.md` — health-scoped persona definition
- `HEARTBEAT.md` — standing orders (edit file, takes effect next run)
- Signal: `POST /api/mx4/run` triggers a run

His signature color is `#2bc4e8` (bacta cyan). When in a section, MX-4's sigil stays cyan; the section accent colors the frame/chrome around him.

**MX-4 Sigil moods:** `transmit` (Home, Training), `pleased` (Recovery), `alert` (Sleep), `listen` (Ask sheet), `idle` (nav/status), `think` (processing)

---

## Data

- **DB:** SQLite at `/opt/bacta/data/bacta.db`
- **Schema:** `server/db/schema.sql` — EAV tables `garmin_snapshots` + `macrofactor_snapshots` (date, metric, value, unit, source_json)
- **Poller:** `scripts/garmin_poller.py` — nightly 3AM via `bacta-garmin.timer` (installed)
- **Ingest:** `scripts/garmin_ingest.py` — historical import (365 days, ~35 min runtime)
- **Garmin tokens:** `~/.garminconnect` on LXC 109
- **~30 Garmin metrics:** HRV, body battery, resting HR, sleep stages/score/SpO2, stress, VO2max, training load/status, intensity minutes, activities, steps, weight, respiration
- **Vault:** ObsidianVault NFS-mounted read-only at `/mnt/vault` from LXC 106 (192.168.1.202)
- **Insights dir:** `/opt/bacta/insights/` — HTML briefings written by MX-4

**Stub data** (frontend still uses this until sections are wired): `client/src/lib/stubData.ts`
**API is ready:** backend endpoints at `/api/garmin`, `/api/insights`, etc. are fully implemented.

---

## Garmin API & Data Conventions

- `get_sleep_data(d)` returns sleep that *ended* on morning of `d` — store under `d`, not `d-1`
- `get_fitnessage_data()` field is `fitnessAge`, not `biometricAge`; never fall back to `chronologicalAge`
- `garmin_snapshots.source_json` stores the raw API response — query it to debug field names before touching the poller
- Summary queries must use per-metric `MAX(date)` — hardcoding `today` breaks when metrics arrive at different times
- Activities need a dedicated `garmin_activities` table — EAV can't represent multiple rows per day
- Use `INSERT OR REPLACE` (not `INSERT OR IGNORE`) for activity rows so re-syncs overwrite stale data
- Common Garmin `typeKey` values: `running`, `trail_running`, `walking`, `hiking`, `cycling`, `strength_training`, `multi_sport`
- `get_heart_rates(d)` returns minute-by-minute HR values — NOT zone minutes. For HR zone data use `get_activity_hr_in_timezones(activityId)` → field `secsInZone` per zone; aggregate across all activities for the day and divide by 60 for minutes
- `multi_sport` activities are containers — `get_activity_hr_in_timezones(parent_id)` returns empty. Use `_child_activity_ids(c, act_id)` (defined in `garmin_poller.py`) which checks `metaData.childActivityIdList` via `get_activity` then `get_activity_details`; query zones on each child instead

## Server & DB Gotchas

- `sqlite3` CLI not installed — query DB with Python: `python3 -c "import sqlite3,json; db=sqlite3.connect('/opt/bacta/data/bacta.db'); [print(json.dumps(dict(r))) for r in db.execute('SELECT ...').fetchall()]"` (the `node -e` / better-sqlite3 approach can fail if native bindings aren't compiled in the current shell)
- Express: define specific routes (`/activities`, `/sync/status`) **before** `/:param` wildcards or they get swallowed
- Some files in `client/src/components/viz/` are owned by root from initial scaffold — run `sudo chown wheat:wheat <file>` if Edit fails with EACCES
- `mx4spin` keyframe is global (defined in `client/index.css`) — use as `animation: 'mx4spin 1s linear infinite'` in inline styles
- `garmin_ingest.py` uses `errors` (not `err`), `SLEEP_PER_CALL` (not `SLEEP_BETWEEN`), and no `ok.append()` — variable names differ from `garmin_poller.py`; match the existing pattern in whichever file you're editing
- Ingest CLI: `python3 scripts/garmin_ingest.py --days 30` (uses `--days` flag, not positional arg)
- Validate Python script syntax before committing: `python3 -c "import py_compile; py_compile.compile('scripts/foo.py', doraise=True)"`
- Playwright `fullPage` screenshots only capture viewport height on this app — the outer shell is `position: fixed; overflow: hidden`. To screenshot scrolled content: use `browser_evaluate` to set `document.querySelector('[style*="overflow-y"]').scrollTop = N` then screenshot.

---

## Infrastructure

- **Repo:** `github.com/bridgemouse/bacta`
- **CI:** GitHub Actions, self-hosted runner on LXC 109 (labels: `bacta, self-hosted`)
- **PWA:** `client/public/manifest.json`, iOS meta tags in `client/index.html`
- **Fonts:** Google Fonts (Hanken Grotesk + JetBrains Mono) in `client/index.html`

---

## Design References (in repo)

- `design_handoff_mx4_home/` — Claude Design handoff after skeleton build; prototype HTML + screenshots
- `design_handoff_bacta_sections/` — Claude Design handoff for section content (Recovery/Sleep/Training/Home); prototype HTML + screenshots. **Primary reference for implementing section pages.**
- `docs/superpowers/plans/` — Superpowers implementation plans from each build session

**Prototype:** `design_handoff_bacta_sections/design/Bacta - Prototype.html` — open in browser to see full live prototype.

---

## Installed Plugins & MCP Servers

| Tool | Purpose |
|---|---|
| Playwright MCP | Browser automation / visual verification |
| Figma MCP | Design inspection and sync |
| Supabase MCP | Supabase integration (not used in prod, for dev tooling) |
| Context7 | Up-to-date library documentation |
| Superpowers | Planning, TDD, debugging skills |
| Feature Dev | Guided feature development |
| Claude Mem | Cross-session memory and codebase search |

Use `/run` to launch and visually verify the app. Use `/code-review` before merging significant changes. Use `superpowers:brainstorming` before implementing new features. Use `superpowers:writing-plans` for multi-step work.
