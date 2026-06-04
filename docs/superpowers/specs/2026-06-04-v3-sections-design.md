# Bacta v3 Section Pages — Design Spec
**Date:** 2026-06-04  
**Prototype reference:** `design_bacta-handoff-package/Bacta - Prototype v3.html`  
**Handoff spec:** `design_bacta-handoff-package/bacta-handoff-v3.md`

---

## 1. Scope

Rebuild Recovery, Sleep, and Training section pages to match the v3 prototype exactly.
Covers Phase A (zero new polling) and Phase B (two new SQL endpoints). Phase C (new polling)
and Phase D (Labs/Daily Log) are out of scope.

---

## 2. Architecture Decisions

### 2.1 InfoCard — prop-based, not wrapper-based

The info overlay capability is a built-in prop on each card component, not a separate wrapper.

```ts
interface CardInfo {
  description: string   // always shown — required
  title?: string        // omit to hide (small tiles skip this)
  source?: string       // omit to hide (small tiles skip this)
  // Future: source could be derived from a metric→device registry instead of hardcoded
}
```

Usage per card:
```tsx
// Small tile — description only
<VitalTile info={{ description: "HRV-derived stress during sleep..." }} ... />

// Full chart card — all three
<HeadlineCard info={{ title: "Heart Rate Variability", description: "...", source: "Garmin Fenix 7X · RMSSD" }} ... />
```

Presence of each field = shown. Absence = hidden. No separate boolean flags.

### 2.2 InfoCard state — React Context at section level

`InfoCardContext` provides `{ openId: string | null, open(id: string): void, close(): void }`.

Provider wraps the scrollable content inside each `*Content` component (`RecoveryContent`,
`SleepContent`, `TrainingContent`) — not the AppShell. This is the right scope for the
eventual card registry: section state (open card ID, card order, hidden cards) all lives here.

Each card component that accepts `info` generates a stable ID (passed as a prop or derived
from `label`), registers with the context, and renders its overlay when `openId === id`.

Outside-click dismissal: `document.addEventListener('click', dismiss, { once: true })` with
a 30ms guard to avoid self-dismissal on the opening tap.

### 2.3 Future customization alignment

This design is forward-compatible with the planned card registry (`CardConfig[]` per section,
per spec §5). When that arrives:
- `CardInfo` fields (`title`, `description`, `source`) map directly to registry entries
- `InfoCardContext` grows to hold `cardOrder`, `hiddenCards`, etc. at the same level
- `source` can eventually be derived from a metric→data-pipeline lookup rather than hardcoded

---

## 3. New Files

| File | Purpose |
|---|---|
| `client/src/components/viz/HealthStatusTile.tsx` | VitalTile variant with `inRange` indicator |

No standalone `InfoCard.tsx` — overlay logic lives as a shared hook consumed inside each
card component that supports the `info` prop.

---

## 4. Modified Files

| File | Changes |
|---|---|
| `client/src/theme.ts` | Add `CARD_SIZES` + `CardSize` type |
| `client/src/components/viz/HeadlineCard.tsx` | Add `id`, `info?: CardInfo` props + overlay |
| `client/src/components/viz/VitalTile.tsx` | Add `id`, `info?: CardInfo` props + overlay |
| `client/src/hooks/useRecoveryData.ts` | Add `hrv.direction`, `stressMaxTrend` |
| `client/src/hooks/useSleepData.ts` | Add `archScore` |
| `client/src/hooks/useTrainingData.ts` | Add `loadRatio`, `fitnessAgeTrend`, Phase B fields |
| `client/src/pages/RecoveryPage.tsx` | Full layout rebuild |
| `client/src/pages/SleepPage.tsx` | Full layout rebuild |
| `client/src/pages/TrainingPage.tsx` | Full layout rebuild |
| `server/api/garmin.ts` | Add `/weekly-volume` + `/weekly-avg-hr` routes (Phase B) |
| `client/src/lib/garminApi.ts` | Add `fetchWeeklyVolume` + `fetchWeeklyAvgHr` (Phase B) |

---

## 5. CARD_SIZES

Added to `client/src/theme.ts`:

```ts
export const CARD_SIZES = {
  hero:  220,   // score gauges
  chart: 170,   // full chart cards (HRV band, Architecture)
  bar:   140,   // 7-bar trend cards, weekly volume
  pair:  110,   // half-width paired cards
  tile:   88,   // 2×2 quarter-grid tiles
  row:    52,   // compact rows (status banner, intensity bar)
} as const
export type CardSize = keyof typeof CARD_SIZES
```

Applied as `minHeight: CARD_SIZES[size]` on each card's root div. `minHeight` not `height`
so content can grow. Half-width flex rows auto-equalize to the tallest sibling.

---

## 6. HealthStatusTile

New component `client/src/components/viz/HealthStatusTile.tsx`.

Props: same as VitalTile + `inRange?: boolean`.

When `inRange` is defined:
- 3px left border colored green (`COLORS.green`) if in range, amber (`COLORS.amber`) if not
- `sub` text renders in matching color
- Background tint: `hexA(inRange ? COLORS.green : COLORS.amber, 0.05)`

Used for all Overnight Vitals grids (Recovery and Sleep sections).

---

## 7. Shared InfoCard overlay hook

`useCardInfoOverlay(id: string, info: CardInfo | undefined, accent: string)` returns
`{ open, isOpen, overlayProps }` where `overlayProps` contains the ready-to-spread style
and onClick for the overlay div.

**Two usage patterns:**

1. **Component-level** — HeadlineCard, VitalTile, HealthStatusTile each accept `id?: string`
   and `info?: CardInfo` props and call the hook internally. If `id` is omitted, derived from
   `label` via `label.toLowerCase().replace(/\s+/g, '-')`.

2. **Inline JSX** — Custom full-width cards in page files (Recovery Score hero, HRV band,
   Sleep hero, Architecture card, Load Ratio row) call `useCardInfoOverlay` directly in the
   page component. The page is responsible for passing a stable unique `id` string and
   rendering the `{isOpen && <overlay>}` div inside the card's root.

Overlay visual: `backdropFilter: blur(22px)`, tinted to section accent (`hexA(ac, 0.32)`
gradient), 1px accent border. Title in FONT_MONO 8px uppercase. Description in FONT_UI
12px italic. Source in FONT_MONO 7px below description. Compact variant (tiles): no title,
11.5px description, no source line.

---

## 8. Hook changes

### 8.1 useRecoveryData additions

```ts
// New fields on RecoveryData
stressMaxTrend: number[]   // 7-day peak stress trend
hrv: {
  ...existing,
  direction: {
    slope: number           // ms/day (positive = improving)
    direction: 'up' | 'stable' | 'down'
    label: string           // '↑ IMPROVING' | '→ STABLE' | '↓ DECLINING'
    sub: string             // '+1.1 ms/day'
  } | null
}
```

`fetchTrend('stress_max', 7)` added to `Promise.all` (already in VALID_METRICS).

HRV direction: least-squares linear regression over the 7-value trend array (x = index 0–6,
y = HRV ms). `slope > 0.3` → up; `slope < -0.3` → down; else stable.

### 8.2 useSleepData additions

```ts
archScore: number   // 0–100, computed from existing stage seconds
```

Formula (verbatim from spec §2.4):
```ts
const deepScore  = Math.min(deepMins  / (totalMins * 0.20), 1)
const remScore   = Math.min(remMins   / (totalMins * 0.22), 1)
const awakePen   = Math.max(0, 1 - awakeMins / (totalMins * 0.05))
const archScore  = Math.round((deepScore * 0.4 + remScore * 0.4 + awakePen * 0.2) * 100)
```

Zero new fetches — all source values already in the hook.

### 8.3 useTrainingData additions

```ts
// New fields
fitnessAgeTrend: number[]    // 30-day trend (fetchTrend('fitness_age', 30))
loadRatio: {
  value: number              // rounded to 2dp
  acute: number
  chronic: number            // 42-day rolling avg of training_load
  state: 'Optimal' | 'High' | 'Low'
} | null                     // null if insufficient data

// Phase B
weeklyVolume: Array<{ w: string; h: number; current?: boolean }> | null
activityHrByWeek: number[] | null
activityHrLabels: string[] | null
```

`fetchTrend('training_load', 42)` added for chronic load.
`fetchTrend('fitness_age', 30)` added (already in VALID_METRICS).
Load ratio state: `value < 0.8` → Low, `value > 1.3` → High, else Optimal.

---

## 9. Page layouts (Phase A)

### 9.1 Recovery Overview

```
[MX4Briefing]
Rail: READINESS · SYNTHESIZED
[InfoCard hero] Recovery Score gauge + state badge + narrative text
[InfoCard chart] HRV full-width: value + Delta + IN RANGE badge + direction badge + sparkline + baseline legend
Flex row:
  [InfoCard pair] Resting HR — HeadlineCard: value + sparkline + Delta footer
  [InfoCard pair] Stress — HeadlineCard: value + sparkline + label footer
Rail: OVERNIGHT VITALS · HEALTH STATUS
2×2 grid (HealthStatusTile):
  [InfoCard tile] Stress avg   (description only)
  [InfoCard tile] Peak Stress  (description only — sparkline from stressMaxTrend)
  [InfoCard tile] Respiration  (description only)
  [InfoCard tile] SpO₂         (description only — conditional on spo2.value != null)
```

### 9.2 Sleep Overview

```
[MX4Briefing]
Rail: LAST NIGHT · [bedtime stub]
[InfoCard hero] Sleep hero: big duration text (left) + Score Gauge (right) + stage chips + efficiency line
Flex row (equal height):
  [InfoCard pair] Efficiency — left-border stripe card: effPct%, progress bar, awake-in-bed sub
  [InfoCard pair] Sleep Debt — left-border stripe card: debt duration, RESTORED/BELOW GOAL label
[InfoCard chart] Architecture: SleepDepth + axis labels + StageSplit + ARCH SCORE badge + StageCards grid
Rail: OVERNIGHT VITALS · WHILE ASLEEP
2×2 grid (HealthStatusTile):
  [InfoCard tile] Heart Rate    (description only)
  [InfoCard tile] Respiration   (description only)
  [InfoCard tile] Sleep Stress  (description only)
  [InfoCard tile] SpO₂          (description only — conditional)
```

### 9.3 Training Overview

```
[MX4Briefing]
[InfoCard row] StatusBanner
Rail: PERFORMANCE · CURRENT
Flex row:
  [InfoCard pair] Fitness Age — HeadlineCard: large accent number + yr + ELITE badge; VO2max in footer
  [InfoCard pair] Acute Load  — HeadlineCard: value + state badge + LoadBand footer
[InfoCard row] Load Ratio row — conditional on loadRatio != null
Rail: INTENSITY THIS WEEK · GOAL N MIN
[InfoCard row] IntensityBar
Rail: HR ZONES · N MIN TODAY (conditional)
[InfoCard bar] HR Zones panel (conditional)
Rail: DAILY ACTIVITY · N STEPS
[InfoCard bar] Steps 7-bar chart card (Bars7 component)
2×2 grid:
  [InfoCard tile] Distance    (description only)
  [InfoCard tile] Calories    (description only)
  [InfoCard tile] Active Cal  (description only)
  [InfoCard tile] Floors      (description only)
Rail: ACTIVITY LOG · N RECENT
LogEntry rows (no InfoCard — tap already expands)
```

---

## 10. Phase B — New API endpoints

Two routes added to `server/api/garmin.ts` **before** the `/:metric` wildcard (CLAUDE.md
gotcha: specific routes must precede wildcards or they are swallowed).

```
GET /api/garmin/weekly-volume?weeks=6
GET /api/garmin/weekly-avg-hr?weeks=6
```

Queries (verbatim from spec §2.7 and §2.9):
```sql
-- weekly-volume
SELECT strftime('%W', date) AS week, SUM(duration_s)/3600.0 AS hours
FROM garmin_activities GROUP BY week ORDER BY MIN(date) DESC LIMIT :weeks

-- weekly-avg-hr
SELECT strftime('%W', date) AS week, ROUND(AVG(avg_hr), 0) AS avg_hr
FROM garmin_activities WHERE avg_hr IS NOT NULL AND avg_hr > 0
GROUP BY week ORDER BY MIN(date) DESC LIMIT :weeks
```

Client functions in `garminApi.ts`: `fetchWeeklyVolume(weeks = 6)` and
`fetchWeeklyAvgHr(weeks = 6)`.

Training Trends tab additions (Phase B):
- Weekly Volume 6-week bar chart (Bars7 or inline bars)
- Fitness Age 30-day sparkline (Sparkline component)
- Avg Activity HR 6-week TrendRow

---

## 11. Execution order

1. Foundation: CARD_SIZES in theme.ts · HealthStatusTile · `useCardInfoOverlay` hook ·
   InfoCard prop additions to HeadlineCard + VitalTile
2. Hook changes: useRecoveryData · useSleepData · useTrainingData
3. RecoveryPage rebuild → `/run` + Playwright verify
4. SleepPage rebuild → `/run` + Playwright verify
5. TrainingPage rebuild → `/run` + Playwright verify
6. Phase B: server routes · garminApi.ts · TrainingTrends additions → Playwright verify

---

## 12. Known non-issues (do not investigate)

- Hypnogram depth chart is cosmetic stub — Garmin does not expose per-epoch staging
- `sleep_spo2` / `spo2_avg` have 1–2 rows; display conditionally, data will grow
- `vo2max` trend has ~10 rows; sparse sparkline is correct
- `body_battery_max/min` unreliable; always use `body_battery_wake/current`
- `floors_up/down` returns decimals; always `Math.round()` before display
