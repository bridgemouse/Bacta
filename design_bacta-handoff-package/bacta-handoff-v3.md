# Bacta — Claude Code Handoff v3
**Date:** June 4, 2026  
**Prototype reference:** `Bacta - Prototype v3.html`  
**Previous briefing:** `design_handoff_bacta_sections/CLAUDE_CODE_BRIEFING.md`  
**Garmin data reference:** `uploads/garmin-data-reference.md`

---

## 1. What This Handoff Covers

The previous handoff (`CLAUDE_CODE_BRIEFING.md`) documented Rounds 1–2 of the prototype.
This document is the **v3 delta** — everything that changed, was added, or was redesigned
since then. It also contains a gap analysis: the exact difference between what the app
currently renders and what the v3 prototype shows.

---

## 2. Current App State vs. Prototype (Gap Analysis)

### ✅ Already live — no changes needed

| UI element | App file | Notes |
|---|---|---|
| Recovery score gauge + READY badge | `RecoveryPage.tsx` | Live — `recovery_score` |
| HRV card with band + sparkline | `RecoveryPage.tsx` | Live — `hrv`, `hrv_baseline_low/high` |
| Body Battery card (wake/now/consumed) | `RecoveryPage.tsx` | Live — `body_battery_wake/current` |
| Resting HR VitalTile + sparkline | `RecoveryPage.tsx` | Live — `resting_hr` |
| Stress avg VitalTile | `RecoveryPage.tsx` | Live — `stress_avg` |
| Peak Stress VitalTile | `RecoveryPage.tsx` | Live — `stress_max` |
| Respiration VitalTile | `RecoveryPage.tsx` | Live — `resp_avg` |
| SpO₂ VitalTile (conditional) | `RecoveryPage.tsx` | Live — `spo2_avg` (2 rows, growing) |
| Sleep duration hero + gauge | `SleepPage.tsx` | Live — `sleep_deep_s + light_s + rem_s` |
| Sleep score + state | `SleepPage.tsx` | Live — `sleep_score` |
| Stage split bar + legend | `SleepPage.tsx` | Live — computed from stage seconds |
| Sleep efficiency % | `SleepPage.tsx` | Live — computed: `totalMins/inBedMins` |
| Sleep debt | `SleepPage.tsx` | Live — computed: `max(0, 480 - totalMins)` |
| Sleep vitals (HR, resp, stress, SpO₂) | `SleepPage.tsx` | Live |
| Training status banner | `TrainingPage.tsx` | Live — `training_status_n` |
| VO2max gauge + fitness age | `TrainingPage.tsx` | Live |
| Acute load card + band | `TrainingPage.tsx` | Live |
| Intensity minutes bar | `TrainingPage.tsx` | Live |
| HR Zones bar | `TrainingPage.tsx` | Live — 23 rows, builds daily |
| Daily activity tiles (steps/distance/cal/floors) | `TrainingPage.tsx` | Live |
| Activity log (last 8 days) | `TrainingPage.tsx` | Live — `garmin_activities` |
| All Trends tabs (Recovery, Sleep, Training) | all pages | Live |

---

### 🆕 New in v3 Prototype — Needs Wiring

These exist in the prototype with stub data. Below is the exact data shape, source, and
implementation path for each.

---

#### 2.1 Recovery — Body Battery Intraday Arc

**What it is:** Circular arc showing Body Battery charge from ~22:00 previous night to current
hour. Wake event marked. Run event marked. Color shifts from low (amber) to full (cyan).

**Prototype data shape:**
```ts
bodyBatteryIntraday: {
  points: Array<{ h: string, v: number, event?: 'wake' | 'run' }>,
  wakeIdx: number,    // index of wake event
  currentIdx: number  // index of current time
}
```

**Backend:** `get_body_battery(date, date)` returns an array. Shape from Garmin:
```json
[{ "startTimestampGMT": "...", "endTimestampGMT": "...", "bodyBatteryValuesArray": [[ts, value], ...] }]
```
Store as `body_battery_intraday_json TEXT` column in `garmin_snapshots` (or a separate
`garmin_intraday` table). Downsample to hourly for display.

**New column to add:**
```sql
-- Option A: add to garmin_snapshots EAV (simplest)
INSERT INTO garmin_snapshots (date, metric, value, source_json)
VALUES (:date, 'body_battery_intraday', NULL, :json_array);
```

**API endpoint:** Extend `GET /api/garmin/summary` to include `body_battery_intraday`
or add `GET /api/garmin/body-battery-intraday?date=YYYY-MM-DD`.

---

#### 2.2 Recovery — HRV Direction Badge

**What it is:** A badge showing the 7-day HRV trend direction (↑ IMPROVING / → STABLE /
↓ DECLINING) with slope in ms/day. Displayed inline next to "IN RANGE" badge on the HRV card.

**Prototype data shape:**
```ts
hrvDirection: {
  slope: number,      // ms/day (positive = improving)
  direction: 'up' | 'stable' | 'down',
  label: '↑ IMPROVING' | '→ STABLE' | '↓ DECLINING',
  sub: '+1.1 ms/day'
}
```

**Backend:** Compute server-side from the 7-day `hrv` trend array already fetched.
Linear regression (least-squares) on `fetchTrend('hrv', 7)`.

**Where to compute:** In `useRecoveryData` hook — no new DB query needed.
```ts
const slope = linearRegressionSlope(hrv.trend); // rise/run across 7 days
const direction = slope > 0.3 ? 'up' : slope < -0.3 ? 'down' : 'stable';
```
Expose as `hrv.direction: { slope, direction, label, sub }` on `RecoveryData`.

**Zero new polling — pure computation from existing data.**

---

#### 2.3 Recovery — Peak Stress Sparkline

**What it is:** The peak stress tile (already showing `stress_max`) now has a 7-day
sparkline of peak stress values, not just the single day's value.

**Backend:** `stress_max` already has 54 rows in `garmin_snapshots`. Add `stress_max` to
`VALID_METRICS` in the API if not already present, then call `fetchTrend('stress_max', 7)`
in `useRecoveryData`.

**Expose on `RecoveryData`:**
```ts
stress: {
  ...existing fields,
  maxTrend: number[]   // 7-day array of peak stress values — ADD THIS
}
```

---

#### 2.4 Sleep — Architecture Score Badge

**What it is:** A single computed score (0–100) labelled "ARCH SCORE" displayed as a
pill badge on the sleep architecture card, next to the stage split bar.

**Formula (client-side, zero new data):**
```ts
const deepScore  = Math.min(deepMins  / (totalMins * 0.20), 1); // ideal: 20% of sleep
const remScore   = Math.min(remMins   / (totalMins * 0.22), 1); // ideal: 22% of sleep
const awakePen   = Math.max(0, 1 - awakeMins / (totalMins * 0.05)); // penalty for >5% awake
const archScore  = Math.round((deepScore * 0.4 + remScore * 0.4 + awakePen * 0.2) * 100);
```

**Expose on `SleepData`:** `archScore: number` — computed in `useSleepData`.
All source values (`sleep_deep_s`, `sleep_rem_s`, `sleep_awake_s`) already in DB.

---

#### 2.5 Sleep — Consistency Card

**What it is:** A 7-bar chart showing bedtime variation across the past 7 nights.
Each bar = minutes-past-midnight of bedtime. Shows stddev and avg bedtime label.

**Prototype data shape:**
```ts
consistency: {
  bedtimes:    number[],  // minutes past midnight, 7 values
  labels:      string[],  // ['Tu', 'We', 'Th', 'Fr', 'Sa', 'Su', 'Mo']
  stdDev:      number,    // minutes
  status:      'GREAT' | 'MODERATE' | 'POOR',
  statusColor: string,
  avgLabel:    string     // '22:41'
}
```

**Backend:** Store `sleep_start_timestamp` (epoch ms, GMT) per night in `garmin_snapshots`.

Get it from `get_stats(date)` → `sleepStartTimestampGMT` field (already in `source_json`
stored by the poller — check before adding a new field).

```sql
-- New metric to poll (or extract from existing source_json):
INSERT INTO garmin_snapshots (date, metric, value)
VALUES (:date, 'sleep_start_ts', :epoch_minutes_past_midnight);
```

**Computation in `useSleepData`:**
```ts
const trend = await fetchTrend('sleep_start_ts', 7);
const bedtimes = trend.map(t => t.value);
const stdDev = Math.round(stdDeviation(bedtimes));
const avgMins = average(bedtimes);
const avgLabel = minsToTime(avgMins); // '22:41'
```

---

#### 2.6 Training — Load Ratio

**What it is:** A row card showing acute ÷ chronic load ratio. If > 1.3 = overreaching,
< 0.8 = undertraining, 0.8–1.3 = optimal.

**Prototype data shape:**
```ts
loadRatio: { value: 1.10, acute: 505, chronic: 460, state: 'Optimal' }
```

**Backend:** Chronic load = 42-day rolling avg of `training_load`.
```ts
// In useTrainingData:
const acuteLoad  = summary.training_load;
const loadTrend42 = await fetchTrend('training_load', 42);
const chronicLoad = average(loadTrend42.map(t => t.value));
const ratio = Math.round((acuteLoad / chronicLoad) * 100) / 100;
```
**Zero new polling — extend `fetchTrend` to support 42-day range.**

---

#### 2.7 Training — Weekly Volume Chart

**What it is:** 6-week bar chart of total training hours per week.

**Prototype data shape:**
```ts
weeklyVolume: Array<{ w: string, h: number, current?: boolean }>
// e.g. [{ w: 'W48', h: 5.2 }, ..., { w: 'W1', h: 2.3, current: true }]
```

**Backend — new API endpoint:**
```ts
// GET /api/garmin/weekly-volume?weeks=6
// Query:
SELECT
  strftime('%W', date) AS week,
  SUM(duration_s) / 3600.0 AS hours
FROM garmin_activities
GROUP BY week
ORDER BY MIN(date) DESC
LIMIT 6
```

Add to `useTrainingData` as `training.weeklyVolume: WeeklyVolume[]`.

---

#### 2.8 Training — Fitness Age 30-Day Trend

**What it is:** A sparkline / area chart of `fitness_age` over the past 30 days.
Declining = improving. Currently only displayed as a static number.

**Backend:** `fitness_age` already has 368 rows. Extend `VALID_METRICS` to allow
`fetchTrend('fitness_age', 30)`.

**Expose on `TrainingData`:**
```ts
vo2max: {
  ...existing,
  fitnessAgeTrend: number[]   // 30 values — ADD THIS
}
```

---

#### 2.9 Training — Avg Activity HR by Week

**What it is:** 6-week bar chart of average heart rate across all HR-tracked activities.
Declining trend = aerobic improvement.

**Backend — new API endpoint:**
```ts
// GET /api/garmin/weekly-avg-hr?weeks=6
SELECT
  strftime('%W', date) AS week,
  ROUND(AVG(avg_hr), 0) AS avg_hr
FROM garmin_activities
WHERE avg_hr IS NOT NULL AND avg_hr > 0
GROUP BY week
ORDER BY MIN(date) DESC
LIMIT 6
```

Add to `useTrainingData` as `training.activityHrByWeek: number[]`.

---

#### 2.10 Training — Garmin Coach Phase (Week 4 · Build)

**What it is:** The training status banner shows "Week 4 · Build" as a sub-label.
Currently stubbed as a hardcoded string.

**Investigation path:**
```bash
cd bacta
python3 scripts/probe_training_status.py --all
```

Look in `probe_output.json` for `coach`, `plan`, `phase`, `build`, `block`, `week` keywords.
Likely candidates:
- `results.training_status` — may contain `trainingPhasePeak`, `cycleStart` fields
- `results.get_workouts` — Garmin Coach scheduled workouts
- `results.get_training_load` — may contain phase label

If found, store as `training_phase TEXT` + `training_week INT` in `garmin_snapshots`.
If not found by the API, fall back to computing from `training_status_n` progression:
- `training_status_n` rising 3+ consecutive weeks → "Build Phase"
- plateau → "Maintenance"

---

#### 2.11 Training — Activity Run Dynamics (Expanded Log Entries)

**What it is:** Tapping a run activity in the log shows Cadence / Stride / Vert Osc /
Ground Contact as a 2×2 grid inside the expanded entry.

**Prototype data shape (patch on activity objects):**
```ts
runDynamics: {
  cadence: number,           // spm
  strideLength: number,      // cm
  vertOscillation: number,   // cm
  groundContact: number      // ms
}
activityHrZones: Array<{ zone: number, pct: number, color: string }>
```

**Backend — extend `garmin_activities` table:**
```sql
ALTER TABLE garmin_activities ADD COLUMN avg_run_cadence INTEGER;
ALTER TABLE garmin_activities ADD COLUMN avg_stride_length REAL;
ALTER TABLE garmin_activities ADD COLUMN avg_vertical_oscillation REAL;
ALTER TABLE garmin_activities ADD COLUMN avg_ground_contact_time INTEGER;
ALTER TABLE garmin_activities ADD COLUMN aerobic_training_effect REAL;
ALTER TABLE garmin_activities ADD COLUMN anaerobic_training_effect REAL;
ALTER TABLE garmin_activities ADD COLUMN recovery_time_h INTEGER;
ALTER TABLE garmin_activities ADD COLUMN primary_benefit TEXT;
ALTER TABLE garmin_activities ADD COLUMN hr_zone_1_pct REAL;
ALTER TABLE garmin_activities ADD COLUMN hr_zone_2_pct REAL;
ALTER TABLE garmin_activities ADD COLUMN hr_zone_3_pct REAL;
ALTER TABLE garmin_activities ADD COLUMN hr_zone_4_pct REAL;
ALTER TABLE garmin_activities ADD COLUMN hr_zone_5_pct REAL;
```

**Polling:** On each new activity ingested, call `get_activity(activityId)` and
`get_activity_hr_in_timezones(activityId)` to populate these columns.

`probe_training_status.py` already calls both — check `probe_output.json` field names
to confirm exact keys before writing the ingest code.

---

### 🆕 New Sections — Labs and Daily Log

---

#### 2.12 Labs (Blood Work) Section

**What it is:** A full section for blood panel results. Shows 6 panels (Hormones, Thyroid,
Metabolic, Lipids, Iron/Vitamins, CBC) each as a collapsible card. Each marker shows value,
unit, in-range bar, and NORMAL/WATCH/FLAG status.

**Prototype reference card IDs:** `labs-summary`, `labs-panel-hormones`,
`labs-panel-thyroid`, `labs-panel-metabolic`, `labs-panel-lipids`,
`labs-panel-vitamins`, `labs-panel-cbc`.

**Existing `blood_work` table — confirm schema:**
```sql
-- Verify this table exists and has these columns.
-- If not, create it:
CREATE TABLE IF NOT EXISTS blood_work (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,           -- 'YYYY-MM-DD' of blood draw
  panel_id    TEXT NOT NULL,           -- 'hormones' | 'thyroid' | 'metabolic' | 'lipids' | 'vitamins' | 'cbc'
  marker_name TEXT NOT NULL,
  value       REAL NOT NULL,
  unit        TEXT NOT NULL,
  range_low   REAL,
  range_high  REAL,
  flag        TEXT DEFAULT 'normal',   -- 'normal' | 'watch' | 'flag'
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**API routes needed:**
```
GET  /api/bloodwork/latest          → most recent full panel set
GET  /api/bloodwork/history/:marker → trend for a single marker over time
POST /api/bloodwork/upload          → PDF ingestion (OCR/parse → INSERT)
```

**MX-4 briefing fields** (`BACTA.brief.bloodwork`):
```ts
{ tone, mood, meta: 'PANEL · MAR 15 · 2026', line, chips }
```
Brief text should be AI-generated from the panel summary: count flags, highlight
notable values (testosterone tier, CRP, HbA1c).

**Prototype stub data is complete** — the 23-marker, 6-panel structure is in
`bacta-v3-data.jsx → BACTA.metrics.bloodwork`. Map it directly to the DB schema.

---

#### 2.13 Daily Log Section

**What it is:** A behavioral logging interface. The user logs daily inputs
(caffeine, alcohol, supplements, bedtime compliance, diet quality, readiness, mood).
MX-4 correlates these against biometric outcomes over time.

**New DB table:**
```sql
CREATE TABLE IF NOT EXISTS daily_behaviors (
  date             TEXT PRIMARY KEY,            -- 'YYYY-MM-DD'
  caffeine_mg      INTEGER,
  caffeine_time    TEXT,                         -- 'HH:MM'
  alcohol_drinks   INTEGER DEFAULT 0,
  preworkout       BOOLEAN DEFAULT 0,
  screens_before   TEXT,                         -- 'none' | '<30m' | '30-60m' | '>60m'
  late_meal        BOOLEAN DEFAULT 0,
  stress_event     TEXT,
  bedtime_on_target BOOLEAN,
  diet_quality     INTEGER,                      -- 1–5
  water_glasses    INTEGER,
  supplements      TEXT,                         -- JSON array: ['Omega-3', 'Magnesium']
  readiness        INTEGER,                      -- 1–5 subjective
  mood             TEXT,                         -- 'Great' | 'Good' | 'Okay' | 'Low'
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**API routes needed:**
```
GET  /api/behaviors/:date      → fetch log for a date (returns {} if none)
POST /api/behaviors/:date      → upsert full behavior object
```

**MX-4 correlation insight** (requires ≥21 days of logs):
```
GET /api/insights/correlation  → compute Pearson r between supplement combos × HRV
```

**Prototype stub data:** `bacta-v3-data.jsx → BACTA.metrics.dailylog.behaviors`
Shape maps 1:1 to the table schema above.

---

## 3. UI Architecture Changes (v3)

These are structural UI changes the frontend React app needs to adopt from the prototype.

### 3.1 InfoCard Component

Every card now has a tap-to-reveal info overlay. The overlay shows:
- Card title (e.g. "Heart Rate Variability")
- Description (italic, centered, explains what the metric means)
- Source line (e.g. "Garmin Fenix 7X · overnight RMSSD")

**Implementation notes:**
- Overlay is a frosted glass panel positioned `absolute, inset: 0` over the card content
- Frost color is tinted to the section accent (e.g. `rgba(100,181,246,0.18)` for Recovery)
- First tap = open. Second tap anywhere on card = close. Tap outside = close. Only one open at a time.
- `compact` prop: overlays on small tiles (88px) skip the title, show only description + source
- `noStretch` prop: full-width standalone cards don't get `flex: 1` injected on their children

**Prototype source:** `bacta-v3-infocard.jsx → InfoCard`

All card descriptions are currently hardcoded in the JSX props. For production, move them
to a `card-registry.ts` — a `Record<cardId, { title, description, source }>` object.

---

### 3.2 Card Size System

Six height tiers enforced as `minHeight` on every card:

```ts
export const CARD_SIZES = {
  hero:  220,   // Score gauges
  chart: 170,   // Full chart cards (HRV band, Body Battery arc, Architecture)
  bar:   140,   // Bar chart cards (7-day trends, weekly volume)
  pair:  110,   // Half-width paired cards (HeadlineCards)
  tile:   88,   // 2×2 quarter-grid tiles
  row:    52,   // Compact rows (status banner, intensity bar)
} as const;

export type CardSize = keyof typeof CARD_SIZES;
```

Apply as `minHeight: CARD_SIZES[size]` on the card root div. Cards in a flex row
auto-equalize to the tallest sibling — `minHeight` not `height` so content can grow.

---

### 3.3 Section Layout Grid

Each section uses a consistent layout pattern. The prototype's grid is:

```
┌─────────────────────────────────┐  ← hero (full, 220px)
├─────────────────────────────────┤  ← chart (full, 170px)
├────────────────┬────────────────┤  ← pair × 2 (half, 110px)
├───────┬────────┴───┬────────────┤  ← tile × 4 in 2×2 grid (88px)
│ tile  │    tile    │    tile    │
└───────┴────────────┴────────────┘
```

The layout is defined by `layout: 'full' | 'half' | 'quarter'` per card. Half-width cards
are in a `display: flex, gap: N` row. Quarter tiles are in a `display: grid, gridTemplateColumns: 1fr 1fr` grid. The containing `RecScroll` (or equivalent) is a vertical stack with consistent `gap`.

**Future modularity:** Each section's layout can be expressed as a `CardConfig[]` array
(see Section 5 below). This is the foundation for user-configurable card order.

---

### 3.4 Navigation Sheet Color

The "All Systems" navigation sheet background is now the same blue as the dock/header
(`#111827` base with cyan accent border), not a separate color. Match prototype.

---

## 4. Sync Button Enhancement

The SYNC button now has three states:

| State | Display | Behavior |
|---|---|---|
| `idle` | "↻ SYNC" | Tap to trigger `POST /api/garmin/sync` |
| `running` | Spinner + elapsed time "↻ 0:23" | Timer increments; poll `/api/garmin/sync/status` every 2s |
| `done` | "✓ SYNCED" | Show for 3 seconds, then revert to idle |

**The `GET /api/garmin/sync/status` endpoint already exists** — it returns
`{ status: 'idle'|'running'|'done'|'error', startedAt: number|null }`.

Prototype source: the sync button logic is in `bacta-v3-app.jsx` → header area.

---

## 5. Future: Modular Card Registry

When user-configurable layouts are implemented, each section's cards should be driven
by a config array rather than hardcoded JSX:

```ts
// card-registry.ts
export interface CardConfig {
  id: string;
  size: CardSize;
  layout: 'full' | 'half' | 'quarter';
  section: 'recovery' | 'sleep' | 'training' | 'bloodwork' | 'dailylog';
  order: number;
  visible: boolean;
  title: string;
  description: string;
  source: string;
}

// recoveryLayout in card-registry.ts
export const recoveryLayout: CardConfig[] = [
  { id: 'rec-score',   size: 'hero',  layout: 'full',    order: 0, visible: true,
    title: 'Recovery Score',
    description: 'Garmin\'s composite daily readiness index (0–100). Synthesizes overnight HRV, resting HR, sleep quality, and recent training load. 70+ = cleared for intensity.',
    source: 'Garmin Fenix 7X · training readiness algorithm' },
  { id: 'rec-hrv',     size: 'chart', layout: 'full',    order: 1, visible: true,
    title: 'Heart Rate Variability',
    description: 'Millisecond variation between heartbeats measured overnight. Higher vs your baseline = better recovered. Trend direction (↑/→/↓) shows 7-day slope.',
    source: 'Garmin Fenix 7X · overnight RMSSD' },
  // ... etc
];
```

Stored in `user_preferences.section_layouts` (JSON). Renderer iterates config,
groups half+quarter by `order`, renders each group as a flex row.

---

## 6. Prioritized Implementation Plan

### Phase A — Zero New Polling (do first)

All of these use data already in `garmin_snapshots` or compute from it.

| Task | Effort | Where |
|---|---|---|
| HRV Direction badge | ~1h | `useRecoveryData` — linear regression on existing 7-day trend |
| Peak Stress sparkline | ~30m | Add `stress_max` to `VALID_METRICS`, fetch 7-day trend |
| Architecture Score | ~30m | `useSleepData` — formula from existing stage seconds |
| Fitness Age 30d trend | ~30m | Add `fitness_age` to `VALID_METRICS`, call `fetchTrend(30)` |
| Load Ratio | ~1h | `useTrainingData` — extend `fetchTrend` to 42 days, compute |
| Sleep Debt as computed field | ✅ already live | Already in `useSleepData` |

### Phase B — New Queries (existing DB, new SQL)

| Task | Effort | Where |
|---|---|---|
| Weekly volume chart | ~2h | New `/api/garmin/weekly-volume` endpoint + `garmin_activities` query |
| Avg activity HR by week | ~2h | New `/api/garmin/weekly-avg-hr` endpoint + `garmin_activities` query |

### Phase C — New Polling (adds new data)

| Task | Effort | Notes |
|---|---|---|
| Body Battery intraday arc | ~3h | `get_body_battery(date, date)` → store `body_battery_intraday_json` |
| Sleep consistency card | ~2h | Extract `sleepStartTimestampGMT` from `source_json` or re-poll |
| Run dynamics + per-activity HR zones | ~4h | `get_activity()` + `get_activity_hr_in_timezones()` per new activity |
| Garmin Coach phase | ~2h | Run `probe_training_status.py --all`, inspect `probe_output.json` |

### Phase D — New Sections

| Task | Effort | Notes |
|---|---|---|
| Labs section wiring | ~4h | Confirm `blood_work` schema, add API routes, wire bloodwork page |
| Daily Log section | ~6h | New `daily_behaviors` table, CRUD API, wire log UI |
| MX-4 AI briefings (all sections) | ~4h | Replace hardcoded briefs with AI-generated from nightly sync context |

---

## 7. Data Shape Contract

The prototype's `BACTA.metrics` object is the target data shape for every hook.
Below is the delta — new fields added in v3 that hooks don't yet expose.

```ts
// RecoveryData — new fields
hrv: {
  ...existing,
  direction: {
    slope: number;
    direction: 'up' | 'stable' | 'down';
    label: string;    // '↑ IMPROVING'
    sub: string;      // '+1.1 ms/day'
  };
};
battery: {
  ...existing,
  intraday: {
    points: Array<{ h: string; v: number; event?: 'wake' | 'run' }>;
    wakeIdx: number;
    currentIdx: number;
  } | null;  // null if not yet polled
};
stress: {
  ...existing,
  maxTrend: number[];  // 7-day peak stress
};

// SleepData — new fields
archScore: number;      // 0–100, computed from stages
consistency: {
  bedtimes: number[];   // minutes-past-midnight, 7 values
  labels: string[];
  stdDev: number;
  status: 'GREAT' | 'MODERATE' | 'POOR';
  statusColor: string;
  avgLabel: string;
} | null;

// TrainingData — new fields
weeklyVolume: Array<{ w: string; h: number; current?: boolean }> | null;
activityHrByWeek: number[] | null;
activityHrLabels: string[] | null;
loadRatio: {
  value: number;
  acute: number;
  chronic: number;
  state: 'Optimal' | 'High' | 'Low';
} | null;
vo2max: {
  ...existing,
  fitnessAgeTrend: number[];   // 30 values
};
// Each GarminActivity in activities[] — new optional fields:
interface GarminActivity {
  ...existing,
  runDynamics?: {
    cadence: number;
    strideLength: number;
    vertOscillation: number;
    groundContact: number;
  };
  activityHrZones?: Array<{ zone: number; pct: number; color: string }>;
  aerobicEffect?: number;
  anaerobicEffect?: number;
  recoveryTimeH?: number;
  primaryBenefit?: string;
}
```

---

## 8. File Reference

### Prototype (design reference)
| File | Purpose |
|---|---|
| `Bacta - Prototype v3.html` | Full interactive prototype — the source of truth for all UI |
| `bacta-v3-app.jsx` | App shell, routing, sync button logic |
| `bacta-v3-data.jsx` | All v3 stub data — exact shape the hooks should expose |
| `bacta-v3-infocard.jsx` | InfoCard component with tap-to-reveal overlay |
| `bacta-v3-viz.jsx` | New visualizations: BodyBatteryArc, HRVDirectionBadge, StageSplitV3, etc. |
| `bacta-v3-recovery.jsx` | Recovery section layout — card IDs, sizes, descriptions |
| `bacta-v3-sleep.jsx` | Sleep section layout |
| `bacta-v3-training.jsx` | Training section layout |
| `bacta-v3-bloodwork.jsx` | Labs section layout |
| `bacta-v3-dailylog.jsx` | Daily Log section layout |

### Data references
| File | Purpose |
|---|---|
| `uploads/garmin-data-reference.md` | Complete Garmin metric inventory, row counts, API endpoints |
| `design_handoff_bacta_sections/CLAUDE_CODE_BRIEFING.md` | Round 1–2 design spec (still valid for shell/token reference) |
| `Bacta/scripts/probe_training_status.py` | Run with `--all` to investigate Garmin Coach data |

---

## 9. Known Constraints (Don't Re-Solve)

| Constraint | Detail |
|---|---|
| Overnight depth chart (hypnogram) | Garmin API does NOT expose per-epoch sleep staging. The chart is cosmetic — keep the stub hypnogram. Do not attempt to wire it. |
| `sleep_spo2` | 1 data point. Watch was misconfigured. Show conditionally; it will grow. |
| `spo2_avg` | 2 data points. Same issue. |
| `vo2max` trend | Only 10 rows over several months. Garmin updates very infrequently. Sparse sparkline is correct — do not fabricate data. |
| `body_battery_max/min` | These EAV fields are unreliable (they mean charged/drained amounts, not absolute levels). Always use `body_battery_wake` and `body_battery_current`. |
| `floors_up/down` | Garmin returns decimals (e.g. 1.09). Always `Math.round()` before display. |
| `body_composition` | All 0 rows. MacroFactor not set up. Do not show. |
