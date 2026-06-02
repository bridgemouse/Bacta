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
│   ├── MX4Card.tsx                   # TransmissionPanel + MX4Briefing (deprecated stub)
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
│       ├── SleepDepth.tsx            # Topographic sleep depth chart
│       ├── StageLegend.tsx           # Sleep stage legend
│       ├── StageSplit.tsx            # Proportional sleep stage bar
│       ├── StatusBanner.tsx          # Training status hero panel
│       ├── TrendRow.tsx              # Trends-tab row
│       └── VitalTile.tsx             # Compact secondary metric tile
└── pages/
    ├── HomePage.tsx                  # 2×3 SystemCard grid + MX4Briefing
    ├── RecoveryPage.tsx              # Old gauges — needs SectionShell replacement
    ├── SleepPage.tsx                 # Old gauges — needs SectionShell replacement
    ├── TrainingPage.tsx              # Old gauges — needs SectionShell replacement
    ├── NutritionPage.tsx             # SectionShell (calibrating)
    ├── BloodWorkPage.tsx             # SectionShell (calibrating)
    └── DailyLogPage.tsx              # SectionShell (calibrating)
```

---

## Current State & Pending Work

### What's Complete

**Frontend — primitives and shell:**
- All primitives (`client/src/components/primitives/`)
- App shell: TopBar, BottomBar, BottomSheet (NavSheet), AskSheet
- `TransmissionPanel` (in MX4Card.tsx), `SystemCard` (in MetricTile.tsx), `SectionShell`
- Home page: SystemCard 2×3 grid + old MX4Briefing (needs → TransmissionPanel)
- Nutrition, BloodWork, DailyLog: SectionShell (calibrating skeleton)
- All viz components in `components/viz/`

**Backend — fully built:**
- `server/api/garmin.ts` — serves Garmin metrics from SQLite by date/metric/range
- `server/api/health.ts` — health check
- `server/api/insights.ts` — reads MX-4 HTML briefings from `insights/`
- `server/api/bloodwork.ts`, `server/api/manual.ts` — manual data endpoints
- `server/api/poll.ts` — triggers Garmin ingest
- `server/api/mx4.ts` — triggers MX-4 orchestrator run
- `server/db/schema.sql` + `server/db/migrate.ts` — SQLite schema + migrations
- `server/db/client.ts` — better-sqlite3 connection

**Data pipeline:**
- `scripts/garmin_ingest.py` — historical import (365 days, ~35 min)
- `scripts/garmin_poller.py` — nightly 3AM via `bacta-garmin.timer` systemd unit
- Garmin tokens at `~/.garminconnect` on LXC 109

### Tab Residue (Known — needs cleanup)
`AppShell` still manages `TabContext`/`hasTabs` state and passes `hasTabs`/`tab`/`onTabChange` to `BottomBar`. Per Plan 1 spec, the tab toggle belongs in `BottomBar` itself keyed off `hasTabs`. This is intentional incomplete state — do not remove without understanding the sections design handoff.

### What's Next (in priority order)
1. **Wire Overview/Trends toggle** — tab state self-contained in BottomBar; AppShell passes `hasTabs` only
2. **Update Home page** — swap old `MX4Briefing` → `TransmissionPanel`
3. **Replace Recovery/Sleep/Training pages** — implement full section content per `design_handoff_bacta_sections/README.md` (viz components already exist in `components/viz/`)
4. **Connect frontend to API** — replace `client/src/lib/stubData.ts` usage with `fetch('/api/garmin/...')` calls per section
5. **MX-4 cron** — schedule `mx4/orchestrator.py`, wire vault-query MCP on LXC 109

**Deferred:** MacroFactor (no account), Blood Work (waiting on lab results)

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

## Server & DB Gotchas

- `sqlite3` CLI not installed — query DB with: `node -e "const db = require('better-sqlite3')('/opt/bacta/data/bacta.db'); console.log(db.prepare('...').all()); db.close()"`
- Express: define specific routes (`/activities`, `/sync/status`) **before** `/:param` wildcards or they get swallowed
- Some files in `client/src/components/viz/` are owned by root from initial scaffold — run `sudo chown wheat:wheat <file>` if Edit fails with EACCES
- `mx4spin` keyframe is global (defined in `client/index.css`) — use as `animation: 'mx4spin 1s linear infinite'` in inline styles

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
