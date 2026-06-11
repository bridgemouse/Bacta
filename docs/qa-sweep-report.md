# QA Sweep Report — June 11, 2026

> Full codebase audit against `docs/garmin-api-reference.md` and `docs/data-usage-audit.md`.
> All changes committed in this session.

---

## Bugs Fixed

### Bug 1 — Redundant `get_rhr_day` call removed (`garmin_poller.py`)

`safe(s, 'restingHeartRate')` on the `get_rhr_day` response was always returning `None` because the actual response is nested at `allMetrics.metricsMap.WELLNESS_RESTING_HEART_RATE[0].value`. The call was silent — no metric was ever stored from it, no error was raised. `resting_hr` was already correctly stored via the `get_stats` block. Removed the entire `get_rhr_day` block. Zero data impact, one fewer API call per nightly sync.

### Bug 2 — OVERNIGHT VITALS showed 24h `stress_avg` (`RecoveryPage.tsx`, `useRecoveryData.ts`)

The "OVERNIGHT VITALS" rail in Recovery Overview was displaying `stress_avg` — Garmin's 24-hour average including daytime activity, meetings, and exercise. Under a rail labeled "OVERNIGHT," this was semantically wrong. `sleep_stress` (HRV-derived stress score measured exclusively during the sleep window) is the correct metric. Fixed:
- Added `sleep_stress` fetch and `sleepStressTrend` to `useRecoveryData`
- Replaced the two stress tiles (Stress avg + Peak Stress, both 24h) with a single `Sleep Stress` `HealthStatusTile` using `rec.sleepStress` and `rec.sleepStressTrend`
- Before: OVERNIGHT VITALS showed `stress_avg = 14` (24h including day)
- After: OVERNIGHT VITALS shows `sleep_stress = 13` (overnight only, with green LOW · rest zone badge)

### Bug 3 — Sleep duration computed from stage sum instead of `sleep_s` (`useSleepData.ts`, `useHomeData.ts`)

Both hooks were computing `totalMins = Math.round((deepS + lightS + remS) / 60)`. After the prior session's poller fix, `sleep_s` is now correctly stored as `sleepTimeSeconds` from the Garmin API. Updated both hooks to use `sleep_s` as primary with stage-sum fallback:
```typescript
const sleepS = summary.sleep_s ?? (deepS + lightS + remS)
const totalMins = Math.round(sleepS / 60)
```
Practical impact is near-zero (both values derive from the same stage data) but semantic alignment is now correct.

---

## New Data Cards Added

### Recovery Time card — Recovery Overview + Trends (`recovery_time_h`)

`get_training_readiness(yesterday)` returns `recoveryTime` in hours — Garmin's estimate of time until full recovery from accumulated training stress. Previously uncaptured.

**Stack additions:**
- `garmin_poller.py`: `store(db, d, 'recovery_time_h', safe(item, 'recoveryTime'), 'h', s)` in training readiness block
- `server/api/garmin.ts`: Added `'recovery_time_h'` to `VALID_METRICS`
- `client/src/lib/garminApi.ts`: Added `recovery_time_h?: number` to `GarminSummary`
- `client/src/hooks/useRecoveryData.ts`: Fetches `recovery_time_h` trend and exposes `recoveryTimeH` + `recoveryTimeTrend`
- `client/src/pages/RecoveryPage.tsx`: Card renders between Body Battery and RHR/Stress pair — shows "READY NOW" badge when 0, hours countdown otherwise. Plus Trends row in Recovery Trends tab.

DB: Will populate on next nightly poller run (data was not collected pre-session).

### Sleep Stress Trends row — Recovery Trends tab (`sleep_stress`)

`sleep_stress` was already in DB (41 rows, current through today) and fetched in `useSleepData`, but never shown in Recovery context. Added:
- `useRecoveryData`: now fetches `sleepStressTrend`
- `RecoveryPage` Trends: new `TrendRow` under "SLEEP STRESS" rail with 7-day data

### Achievable Fitness Age — Training Fitness Age card (`fitness_age_achievable`)

`get_fitnessage_data` returns `achievableFitnessAge` — Garmin's best-attainable fitness age given optimal improvement. Previously uncaptured.

**Stack additions:**
- `garmin_poller.py`: `store(db, d, 'fitness_age_achievable', safe(s, 'achievableFitnessAge'), 'years', s)` alongside existing `fitness_age`
- `server/api/garmin.ts`: Added `'fitness_age_achievable'` to `VALID_METRICS`
- `client/src/lib/garminApi.ts`: Added `fitness_age_achievable?: number` to `GarminSummary`
- `client/src/hooks/useTrainingData.ts`: Exposes `fitnessAgeAchievable` in `vo2max` shape
- `client/src/pages/TrainingPage.tsx`: Shows as "goal X.X yr" annotation in green below the ELITE badge

DB: Will populate on next nightly poller run.

### Body Battery metric rename (`body_battery_max`/`min` → `body_battery_charged`/`drained`)

`body_battery_max` and `body_battery_min` stored the `charged`/`drained` delta amounts from `get_body_battery()` — NOT level readings, despite the misleading names. Renamed everywhere:

- **DB migration**: `UPDATE garmin_snapshots SET metric = 'body_battery_charged' WHERE metric = 'body_battery_max'` (63 rows), same for `body_battery_drained`
- `garmin_poller.py`: Now stores `body_battery_charged`/`body_battery_drained`
- `garmin_ingest.py`: Same rename
- `server/api/garmin.ts`: `VALID_METRICS` updated; old names removed
- `client/src/lib/garminApi.ts`: `GarminSummary` updated; old `body_battery_min` removed

No UI impact — these metrics were never displayed. The UI correctly uses `body_battery_wake` and `body_battery_current` (level readings from `get_stats`).

---

## InfoCard Content Verification

Verified against Garmin's published documentation, WHO guidelines, AASM standards, and peer-reviewed ACWR literature.

| InfoCard | Claim | Finding | Action |
|----------|-------|---------|--------|
| Recovery Score | "70+ = cleared for intensity" | **Wrong** — Garmin's documented thresholds are 60+ (high), 40–59 (moderate), <40 (rest) | **Fixed**: Updated description and trend subtext to "60+ = ready for hard work" |
| ACWR | "Above 1.5 raises injury risk 2–3×" | **Imprecise** — literature confirms >1.5 is elevated risk but specific multiplier is study-dependent and debated | **Fixed**: Removed "2–3×"; now "elevated injury risk" |
| WHO Intensity | "150+ moderate or 75+ vigorous weekly" | **Incomplete** — WHO 2020 says 150–300 moderate OR 75–150 vigorous (range, not just minimum) | **Fixed**: Updated to full range with "or an equivalent combination" |
| Sleep Efficiency | "Above 85% healthy; below 80% suggests fragmentation" | ✅ Confirmed — AASM guidelines use exactly these thresholds | No change |
| Sleep Architecture | "~20% deep, ~22% REM" | ✅ Confirmed — AASM norms: 15–20% deep, 20–25% REM | No change |
| HRV description | "overnight RMSSD" | ✅ Garmin uses RMSSD for overnight HRV | No change |
| Respiration | "12–20 br/m normal" | ✅ Standard clinical resting respiration range | No change |
| SpO₂ | "Above 95% normal, 97%+ excellent" | ✅ Clinically supported; 90% threshold for desaturation concern is correct | No change |
| RHR source | "sleep detection" | ✅ Garmin measures RHR during sleep window | No change |
| Garmin Stress thresholds | "0–25 rest, 26–50 low, 51–75 medium, 76–100 high" | ✅ Matches Garmin's documented stress zones | No change |
| Steps/mortality | "8,000–10,000 steps/day linked to reduced all-cause mortality" | ✅ Supported by multiple JAMA studies | No change |
| ACWR optimal range | "0.8–1.3 optimal" | ✅ Confirmed by systematic reviews | No change |
| HR Zone polarized training | "80% Z1-2, 20% Z3-5" | ✅ Standard polarized model; note this is a general training philosophy, not Garmin-specific | No change |
| Body Battery InfoCard | "Charges during deep low-stress sleep" | ✅ Correct — HRV + stress model | No change |
| Training Status InfoCard | "Updated after each workout" | ✅ Correct behavior | No change |

**Sleep Stress InfoCard** (new): Added `SLEEP_STRESS_INFO` with accurate description: "HRV-derived stress score measured only during the sleep window. Below 26 is the Rest zone."

**Recovery Time InfoCard** (new): Added `RECOVERY_TIME_INFO` describing Garmin's recovery time estimate.

---

## Remaining Issues (Deferred)

### Race Predictions — not implemented
`get_race_predictions()` returns 5K/10K/HM/Marathon predictions in seconds. Data is not in DB (would need new poller call). Deferred — non-trivial addition requiring new UI in Training and sparse data that only updates with VO2max (~weekly).

### Home Recovery tile mismatch (Finding 6)
`useHomeData` shows `body_battery_wake` (raw charge level) under the "Recovery" tile, while RecoveryPage headlines `recovery_score`. These are genuinely different concepts. Deferred — both values are valid; decision on which to show is a product question, not a data accuracy bug.

### `sleep_s`, `recovery_time_h`, `fitness_age_achievable` not yet in DB
All three fields are now stored in the next poller run. Historical backfill would require `garmin_ingest.py --days N` for sleep_s and a targeted script for the others. Not worth backfilling now; will populate naturally.

### Overnight VITALS — Peak Stress tile removed
The old "Peak Stress" tile (using `stress_max`, which is 24h) was removed along with the "Stress avg" tile as part of the Bug 2 fix. If a sleep-window peak stress metric becomes available from Garmin in a future API version, it could be re-added. For now the section shows Sleep Stress + Respiration + SpO₂.

### `sleep_awake_count` and `sleep_breathing_disruption` — not stored
These are mentioned in `garmin-api-reference.md` as high-value sleep extras. Not implemented — would add value to Sleep section but are low priority relative to other work.

---

## Visual Verification

- **Recovery Overview**: Hero gauge, HRV sparkline, Body Battery bar, RHR/Stress pair, OVERNIGHT VITALS (Sleep Stress ✅, Respiration ✅, SpO₂ ✅) — all render correctly
- **Recovery Time card**: Conditionally hidden (no DB data yet) — correct behavior
- **Training Overview**: Status banner, Fitness Age 19.1 ELITE, Acute Load OPTIMAL band, ACWR row — all intact. Achievable fitness age annotation will appear after next poller run.
- **Console errors**: 3 errors present on Recovery page (pre-existing — not introduced by this session's changes)
