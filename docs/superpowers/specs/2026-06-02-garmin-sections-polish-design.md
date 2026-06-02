# Garmin Sections Polish — Design Spec

**Date:** 2026-06-02  
**Scope:** Recovery, Sleep, Training frontend polish — surface all unused Garmin metrics, fix shared bugs, add real trend data. HR zones (poller work) deferred to a follow-up session.  
**Approach:** Horizontal layers — shared primitives → data hooks → pages.

---

## Scope Summary

### In scope (this session)
- **Category 1** — Quick wins: data in DB, not yet rendered (stress_max, resp_max, battery consumed, stress label, Daily Activity panel)
- **Category 2** — Computed metrics: sleep debt, deep/REM ratios, stress category label, battery consumed
- **Category 3** — New trend fetches: sleep_resp, sleep_hr, sleep_stress, vo2max, steps, calories_total
- **Category 5** — Conditional SpO₂: hide both SpO₂ tiles (Recovery + Sleep) when data is null

### Deferred
- **Category 4** — HR zones (requires Python poller + ingest changes, separate session)

---

## Layer 1 — Shared Primitives

### `client/src/components/viz/Delta.tsx`

**Bug:** `Math.abs(value)` renders raw floats (e.g. `0.6999...`).  
**Fix:** Replace with `parseFloat(Math.abs(value).toFixed(1))` — rounds to 1 decimal, `parseFloat` drops trailing zeros so `1.0` → `1`.

### `client/src/components/viz/VitalTile.tsx`

**Enhancement:** Add optional `sub?: string` prop.  
When provided, renders a small secondary line between the value and the sparkline.  
Style: FONT_MONO, 8.5px, `COLORS.textMuted`.  
**Use cases:** stress category label ("LOW"), peak value annotations.

---

## Layer 2 — Data Layer

### `client/src/lib/garminApi.ts` — `GarminSummary` interface

Add 7 new optional fields:

```ts
stress_max?: number        // peak stress of day (0–100)
resp_max?: number          // peak respiration (br/min)
steps?: number
distance_m?: number
calories_total?: number
calories_active?: number
floors_up?: number
```

### `client/src/hooks/useRecoveryData.ts`

**Real 7-day averages for deltas:**  
Replace hardcoded stub averages for RHR, stress, and resp with `arrAvg(trend)` computed from the already-fetched trend arrays. Helper: `const arrAvg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null`. Fall back to stub only when trend is empty.

**Stress category label:**  
```ts
const stressLabel = avg < 26 ? 'LOW' : avg < 51 ? 'MODERATE' : avg < 76 ? 'HIGH' : 'VERY HIGH'
```
Exposed as `stressLabel?: string` on `RecoveryData`.

**New fields on `RecoveryData`:**
```ts
stressLabel?: string        // 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH'
stressMax?: number          // from summary.stress_max
respMax?: number            // from summary.resp_max
batteryConsumed?: number    // body_battery_wake − body_battery_current (computed in hook)
```

### `client/src/hooks/useSleepData.ts`

**New parallel fetches** (add to existing `Promise.all`):
- `fetchTrend('sleep_resp')` — 31+ rows available
- `fetchTrend('sleep_hr')` — 31+ rows available
- `fetchTrend('sleep_stress')` — 31+ rows available

**Computed metrics:**
```ts
sleepDebt  = Math.max(0, 480 - totalMins)         // deficit vs 8h target (minutes)
deepRatio  = Math.round(deepMins / totalMins * 100)
remRatio   = Math.round(remMins / totalMins * 100)
```

**New fields on `SleepData`:**
```ts
sleepDebt?: number           // minutes
deepRatio?: number           // integer %
remRatio?: number            // integer %
sleepRespTrend: number[]
sleepHrTrend: number[]
sleepStressTrend: number[]
```

Attach `sleepHrTrend` and `sleepStressTrend` to the existing `sleepHr`/`sleepStress` VitalTile `data` prop in the page (currently `data={[]}`).

### `client/src/hooks/useTrainingData.ts`

**New parallel fetches** (add to existing `Promise.all`):
- `fetchTrend('vo2max', 30)` — 30-day window to capture sparse 10 data points
- `fetchTrend('steps', 7)` — 367 rows available
- `fetchTrend('calories_total', 7)` — 367 rows available

**`vo2max.trend`** wired from the new fetch (currently the Trends tab uses `TRN.status.trend` for the VO2 Max row — this is a bug, fixed here).

**New `dailyActivity` object on `TrainingData`:**
```ts
dailyActivity: {
  steps: number | null
  distanceKm: number | null    // distance_m / 1000, rounded to 1 decimal
  caloriesTotal: number | null
  caloriesActive: number | null
  floors: number | null
  stepsTrend: number[]
  calTrend: number[]
}
```

All values sourced from `GarminSummary`. `distanceKm` computed in hook: `summary.distance_m != null ? Math.round(summary.distance_m / 100) / 10 : null`.

---

## Layer 3 — Pages

### `client/src/pages/RecoveryPage.tsx`

**Overview tab — Body Battery HeadlineCard:**  
Add `CONSUMED {rec.batteryConsumed}%` as a second line in the card's foot, below the BodyBattery bar. Style: FONT_MONO 8.5px `COLORS.textMuted`. Only rendered when `batteryConsumed != null`.

**Overview tab — Vitals grid (2-column, up to 3 rows):**

| Slot | Current | After |
|---|---|---|
| RHR | ✅ with real delta | delta uses real 7-day avg |
| Stress | ✅ | + `sub={rec.stressLabel}` e.g. "LOW" |
| Peak Stress | — | new: `label="Peak Stress" value={rec.stressMax} unit="max" lowerBetter` |
| Respiration | ✅ with real delta | delta uses real 7-day avg |
| Peak Resp | — | new: `label="Peak Resp" value={rec.respMax} unit="br/m" lowerBetter` |
| SpO₂ | stub showing | gated: `{rec.spo2.value != null && <VitalTile ... />}` |

**Trends tab:** No changes — trends already wired. Deltas improve automatically from real avgs. SpO₂ TrendRow should also be gated: `{rec.spo2.value != null && <TrendRow ... />}`.

---

### `client/src/pages/SleepPage.tsx`

**Overview tab — Duration HeadlineCard foot:**  
Replace single efficiency line with:
```
{efficiencyPct}% efficiency
DEBT {h}h {m}m          ← only if sleepDebt > 0, color: COLORS.mx4Amber
```
If debt is 0 (slept 8h+), second line is omitted.

**Overview tab — Stage Breakdown header:**  
Extend label string to surface ratios inline:
```
STAGE BREAKDOWN · 7h 36m · DEEP 13% · REM 21%
```
These are the most important derived metrics and belong right in the section header for quick scanning.

**Overview tab — SpO₂ tiles:**  
Both gated: `{slp.spo2.avg != null && <VitalTile label="SpO₂ avg" ... />}`. Currently null, so they silently disappear. Will surface automatically when watch is reconfigured.

**Overview tab — Sleep HR + Sleep Stress VitalTiles:**  
Wire real sparkline data: `data={slp.sleepHrTrend}` and `data={slp.sleepStressTrend}` (currently `data={[]}`).

**Trends tab — three new TrendRows** (all gated on `data.length > 0`):
```
Respiration  · br/m  · sparkline  · lowerBetter
Heart Rate   · bpm   · sparkline  · lowerBetter
Stress       · avg   · sparkline  · lowerBetter
```
Added after the existing Score TrendRow.

---

### `client/src/pages/TrainingPage.tsx`

**Overview tab — Daily Activity panel:**  
Inserted between the Intensity bar and the Activity Log Rail.

```
<Rail label="DAILY ACTIVITY" accent={A} right={steps != null ? `${steps.toLocaleString()} STEPS` : undefined} />
```

2×2 VitalTile grid (all gated on non-null value):
- Steps: `label="Steps" value={steps.toLocaleString()} unit="today"`
- Distance: `label="Distance" value={distanceKm} unit="km"`
- Calories: `label="Calories" value={caloriesTotal} unit="kcal"`
- Floors: `label="Floors" value={floors} unit="fl"`

If all four are null (no data), show the standard CALIBRATING placeholder (matching the existing empty activity log pattern).

**Trends tab — fixes and additions:**
- **Bug fix:** VO2 Max TrendRow `data` changes from `TRN.status.trend` → `TRN.vo2max.trend`
- **New:** Steps TrendRow — `kind="bars"`, gated on `TRN.dailyActivity.stepsTrend.length > 0`
- **New:** Calories TrendRow — `kind="bars"`, gated on `TRN.dailyActivity.calTrend.length > 0`

---

## Constraints & Rules (from research doc)

- **Trends tab rule:** Never show a TrendRow with empty data. Every TrendRow gated: `{arr.length > 0 && <TrendRow ... />}`
- **SpO₂ rule:** Never show stub SpO₂. Gate all SpO₂ tiles on real non-null data from DB.
- **Delta precision:** All `Delta` renders benefit from the Layer 1 fix — no page-level changes needed.
- **Body battery:** Use `body_battery_wake` (at wake) and `body_battery_current` (now). Avoid `body_battery_max`/`body_battery_min` from the battery endpoint (confusing field names, unreliable).
- **Inline styles only.** No CSS files, no Tailwind. All new styles inline.

---

## Files Changed

| File | Change |
|---|---|
| `client/src/components/viz/Delta.tsx` | Float precision fix |
| `client/src/components/viz/VitalTile.tsx` | Add `sub?: string` prop |
| `client/src/lib/garminApi.ts` | Expand `GarminSummary` with 7 new fields |
| `client/src/hooks/useRecoveryData.ts` | Real avgs, stressLabel, stressMax, respMax, batteryConsumed |
| `client/src/hooks/useSleepData.ts` | sleepDebt, deepRatio, remRatio, 3 new trend fetches |
| `client/src/hooks/useTrainingData.ts` | dailyActivity object, vo2max/steps/cal trends, bug fix |
| `client/src/pages/RecoveryPage.tsx` | Battery consumed, stress label+sub, peak tiles, SpO₂ gate |
| `client/src/pages/SleepPage.tsx` | Sleep debt, stage ratios, SpO₂ gate, real trend sparklines, 3 Trend rows |
| `client/src/pages/TrainingPage.tsx` | Daily Activity panel, trend bug fix, steps+cal Trend rows |
