# Chart Avg Lines, Recovery & Sleep Polish — Design Spec
_2026-06-13_

## Scope

Eight coordinated fixes across Training/Recovery/Sleep. No new sections. No new DB schema. Poller unchanged.

---

## 1. Bars7 — Avg Label Left Side

**Problem:** Avg label sits at `justifyContent: flex-end` (right), overlapping the today-value label displayed above the last bar.

**Fix:** Move the label group to `justifyContent: flex-start`, swap `paddingRight` → `paddingLeft`. The absolute-positioned avg container naturally superimposes over bar bodies when the avg is near the top of the chart — no explicit gate logic needed.

**Scope:** `client/src/components/viz/Bars7.tsx` only. All callers (Training, Sleep, Recovery Trends) get the fix automatically.

---

## 2. Sparkline — Avg Line Support

**New prop:** `avgLine?: number`

When provided, the Sparkline SVG draws:
- A horizontal `<line>` across the full width at the y-position corresponding to `avgLine` within the data's `min..max` range
- Style: `stroke-dasharray="3 3"`, `strokeWidth=1`, `stroke={COLORS.textMuted}` at 40% opacity
- A small text label `"AVG"` at the left edge (7px FONT_MONO, `COLORS.textMuted`, 65% opacity), sitting just above the line

If `avgLine` falls outside the data's `min..max` range, clamp to the chart boundaries rather than drawing outside the SVG.

**Scope:** `client/src/components/primitives/Sparkline.tsx`

---

## 3. TrendRow — Avg Pass-Through

**New prop:** `avg?: boolean`

When true and `kind='spark'` (default), compute `mean(data)` and pass as `avgLine` to Sparkline. Has no effect when `kind='bars'` (Bars7 handles avg internally).

**Scope:** `client/src/components/viz/TrendRow.tsx`

---

## 4. useRecoveryData — Data Fixes

### 4a. Recovery Time Unit Fix
`summary.recovery_time_h` from Garmin Training Readiness returns **minutes** despite the metric name. The DB stores raw minutes (e.g. 1234 = 20.6h).

Fix in hook: `Math.round((summary.recovery_time_h / 60) * 10) / 10` when setting `recoveryTimeH`. Apply the same `/60 * 10 / 10` rounding to every value in `recoveryTimeTrend`.

### 4b. SpO2 Trend
Add `fetchTrend('spo2_avg')` to the parallel fetch array. Store result in new field `spo2Trend: number[]` on `RecoveryData` type (default `[]`).

### 4c. Sleep HR
Add `fetchTrend('sleep_hr')` to the parallel fetch array. Store value in new field `sleepHrTrend: number[]` (default `[]`). Use `fetchSummary().sleep_hr` for the point-in-time value in new field `sleepHrNight: number | null` (default `null`).

**Scope:** `client/src/hooks/useRecoveryData.ts`

---

## 5. RecoveryPage — UI Fixes

### 5a. HRV Overview — Avg Line
The HRV card sparkline already has a legend entry "7d avg Xms" with a dashed line icon. Wire it: add `avgLine={rec.hrv.avg ?? undefined}` to the Sparkline in the HRV overview card. Now the legend describes a real line.

### 5b. SpO2 Tile — Add Graph
Add `data={rec.spo2Trend}` to the existing SpO2 `HealthStatusTile`.

### 5c. 4th Overnight Vital — Sleep HR
Add new `SLEEP_HR_INFO` CardInfo constant:
```ts
const SLEEP_HR_INFO: CardInfo = {
  title: 'Sleep Heart Rate',
  description: 'Average heart rate during the sleep window. Lower signals better cardiovascular efficiency at rest. Elevation above your norm often flags alcohol, illness, or overtraining stress.',
  source: 'Garmin Venu 4 · optical HR',
}
```
Add 4th tile to the overnight vitals 2-col grid:
```tsx
{rec.sleepHrNight != null && (
  <HealthStatusTile label="Sleep HR" value={rec.sleepHrNight} unit="bpm" accent={A}
    data={rec.sleepHrTrend} info={SLEEP_HR_INFO} />
)}
```

### 5d. Recovery Time Display
After the hook fix, `rec.recoveryTimeH` is now `20.6` (hours). The existing display `{rec.recoveryTimeH}h to full recovery` renders correctly. No layout change needed.

### 5e. Recovery Trends — Avg Lines
Add `avg` prop to all TrendRow entries that use the default sparkline:
- RHR (`lowerBetter`)
- Stress (`lowerBetter`)
- Sleep Stress
- Recovery Time (`lowerBetter`)
- Respiration (`lowerBetter`)

Add `avgLine={rec.hrv.avg ?? undefined}` to the HRV bespoke Sparkline in RecoveryTrends (mirrors 5a, but in the Trends tab).

**Scope:** `client/src/pages/RecoveryPage.tsx`

---

## 6. Server — Sleep Hypnogram Endpoint

**New route:** `GET /api/garmin/sleep-hypno`

Must be registered **before** any `/:param` wildcard in `server/api/garmin.ts`.

Logic:
1. Query `garmin_snapshots WHERE metric = 'sleep_score' ORDER BY date DESC LIMIT 1`
2. Parse `source_json`: extract `dailySleepDTO.sleepStartTimestampGMT`, `sleepEndTimestampGMT`, and `sleepLevels[]`
3. Resample to 24 fixed blocks:
   - `blockMs = (endMs - startMs) / 24`
   - For each block, find which `sleepLevels` segment covers the block's midpoint
   - Default to `3` (awake) if no segment matches
4. Convert Garmin encoding to SleepDepth encoding: `hypnoValue = 3 - garminActivityLevel`
   - Garmin 0 (deep) → 3 (bottom of chart)
   - Garmin 1 (light) → 2
   - Garmin 2 (REM) → 1
   - Garmin 3 (awake) → 0 (top of chart)
5. Also extract local start/end times from `sleepStartTimestampLocal` / `sleepEndTimestampLocal` for dynamic time-axis labels
6. Return: `{ hypno: number[], startLocal: string, endLocal: string }`

On any error (no data, parse failure), return `{ hypno: [], startLocal: null, endLocal: null }`.

**Scope:** `server/api/garmin.ts`

---

## 7. useSleepData — Data Additions

### 7a. SpO2 Trend
Add `fetchTrend('sleep_spo2')` to the parallel fetch array. New field: `sleepSpo2Trend: number[]` (default `[]`).

### 7b. Arch Component Scores
The hook already computes `deepScore`, `remScore`, `awakePen` as intermediate locals. Expose them on `SleepData`:
- `archDeepScore?: number` — 0–1 (deep mins / target deep mins, capped at 1)
- `archRemScore?: number` — 0–1 (rem mins / target rem mins, capped at 1)
- `archAwakePenalty?: number` — 0–1 (1 = no penalty)

### 7c. Real Hypnogram
Add `fetchHypno()` call (a thin fetch of `/api/garmin/sleep-hypno`) to the load sequence. On success, override `hypno` with the returned array. Falls back to `SLEEP.hypno` stub on empty array or error. Also store `hypnoStartLocal` and `hypnoEndLocal` as `string | null` fields for dynamic time-axis labels.

**Scope:** `client/src/hooks/useSleepData.ts`

---

## 8. SleepPage — UI Changes

### 8a. SpO2 Tile — Add Graph
Add `data={slp.sleepSpo2Trend}` to the existing SpO2 `HealthStatusTile` in overnight vitals.

### 8b. Arch Score Badge — Remove from Architecture Card Header
Remove the inline `{slp.archScore != null && <div>ARCH {slp.archScore}</div>}` block from the architecture card's header row. The score moves to its own card (8c).

### 8c. Dynamic Hypnogram Time Labels
Replace the hardcoded `['23:00', '01:00', '03:00', '05:00', '07:00']` with 5 evenly-spaced times derived from `slp.hypnoStartLocal` and `slp.hypnoEndLocal`. Format as `"HH:MM"`. Fall back to the hardcoded array if either is null.

### 8d. Arch Score Dedicated Card
New full-width BESPOKE_CARD between the Architecture card and the Overnight Vitals Rail. Has its own `ARCH_SCORE_INFO` CardInfo and `useCardInfoOverlay` hook call.

Layout:
```
┌─────────────────────────────────────────────┐
│ [Bracket]  [top accent gradient]            │
│ ARCHITECTURE SCORE           82  [● GOOD]  │
│ ─────────────────────────────────────────── │
│ DEEP    [████████░░]  78% of target        │
│ REM     [███████░░░]  71% of target        │
│ AWAKE   [██████████]  96% penalty free     │
└─────────────────────────────────────────────┘
```

- Score number: `FONT_MONO`, 28px, `COLORS.text`
- Color badge: green ≥80, amber ≥60, red <60
- Component bar rows: label (left, 60px), filled track (flex-1, 6px tall, `borderRadius 3`), pct text (right, 40px)
- Track fill color: same as badge color
- Track background: `hexA(COLORS.textMuted, 0.12)`
- "GOOD" / "FAIR" / "NEEDS WORK" label in badge
- Tappable: InfoOverlay with `ARCH_SCORE_INFO`

`ARCH_SCORE_INFO`:
```ts
const ARCH_SCORE_INFO: CardInfo = {
  title: 'Architecture Score',
  description: 'Bacta-computed composite of how well your sleep stages matched clinical targets: 40% weight on deep sleep (target ≥20% of total), 40% on REM (target ≥22%), 20% on time-awake penalty (target <5%). 80+ optimal · 60–79 good · below 60 needs attention.',
  source: 'Bacta-computed · Garmin Venu 4 stage data',
}
```

Only rendered when `slp.archScore != null`.

### 8e. Sleep Trends — Avg Lines
Add `avg` prop to TrendRow for HR, Respiration, Sleep Stress rows. Add `avgLine` to the Score bespoke Sparkline computed as `Math.round(slp.score.trend.reduce((s,v)=>s+v,0)/slp.score.trend.length)` when `slp.score.trend.length > 1`, otherwise `undefined`. No Garmin-provided 7d sleep score avg exists, so this is derived from the trend array.

**Scope:** `client/src/pages/SleepPage.tsx`

---

## Files Changed

| File | Change |
|---|---|
| `client/src/components/viz/Bars7.tsx` | avg label → left side |
| `client/src/components/primitives/Sparkline.tsx` | add `avgLine?: number` prop |
| `client/src/components/viz/TrendRow.tsx` | add `avg?: boolean` prop |
| `client/src/hooks/useRecoveryData.ts` | recov time ÷60, add spo2Trend, sleepHrTrend/sleepHrNight |
| `client/src/pages/RecoveryPage.tsx` | HRV avg line, SpO2 data, 4th vital, avg on trends |
| `server/api/garmin.ts` | new /sleep-hypno endpoint |
| `client/src/hooks/useSleepData.ts` | add sleepSpo2Trend, arch component scores, real hypno |
| `client/src/pages/SleepPage.tsx` | SpO2 data, remove arch badge, dynamic time labels, Arch Score card, avg on trends |

---

## Not In Scope
- DB schema changes
- Garmin poller changes (data already collected via source_json)
- New section pages
- Light mode
