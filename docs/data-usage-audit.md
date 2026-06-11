# Garmin Data Usage Audit — June 2026

Comprehensive review of every place the app reads or derives Garmin data: poller storage, server endpoints, client hooks, and UI display. Produced from live API probing against a Garmin Venu 4 account.

---

## Summary

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **Bug** | `weekly-intensity` endpoint uses rolling 7 days instead of Garmin's Monday week | ✅ Fixed |
| 2 | **Bug** | `useRecoveryData` battery.min = current (BodyBattery bar renders broken) | ✅ Fixed |
| 3 | **Bug** | `get_rhr_day` navigation always returns None (wasted poller call) | Documented |
| 4 | **Wrong context** | Recovery "OVERNIGHT VITALS" shows 24h `stress_avg`; `sleep_stress` is correct | Documented |
| 5 | **Minor** | Sleep duration computed from stages instead of `sleep_s` | Documented |
| 6 | **Design note** | Home Recovery tile shows `body_battery_wake`, not `recovery_score` | Documented |
| 7 | **Opportunity** | `training_readiness` sub-factors not captured (sleepScore, hrvWeeklyAverage, recoveryTime, factor%) | Documented |
| 8 | **Naming** | `body_battery_max`/`body_battery_min` DB metrics are amount-drained/charged, not level readings | Documented |

---

## Section: Training

### Finding 1 — `weekly-intensity` endpoint overcounts by ~35% ✅ FIXED

**File:** `server/api/garmin.ts:117`

**Problem:** The `/api/garmin/weekly-intensity` endpoint was summing `intensity_mod_min` and `intensity_vig_min` over a rolling 7-calendar-day window (`date >= date('now', '-6 days')`). Garmin's intensity-minute accounting resets on Monday (confirmed by comparing DB sums to `get_intensity_minutes_data().weeklyModerate/weeklyVigorous`).

**Live evidence (week of Jun 8–11):**
```
Rolling 7 days (old): mod=168, vig=111
From Monday Jun 8  : mod=104, vig=83   ← matches Garmin API weeklyModerate/weeklyVigorous exactly
```

**Impact:** ~37% overcount on moderate, ~34% on vigorous. The IntensityBar in `TrainingPage` was showing the wrong weekly progress against the 150-min WHO goal.

**Fix applied:**
```sql
-- Before
AND date >= date('now', '-6 days')

-- After
AND date >= date('now', '-' || CAST((CAST(strftime('%w', 'now') AS INTEGER) + 6) % 7 AS TEXT) || ' days')
```
`strftime('%w')` returns 0=Sun…6=Sat. `(weekday + 6) % 7` gives days since Monday (0 on Monday, 3 on Thursday, 6 on Sunday). This correctly selects from the most recent Monday.

---

### Verification: Intensity storage is correct

`get_stats.moderateIntensityMinutes` stores today's contribution only (e.g., 25 min). `get_intensity_minutes_data().weeklyModerate` confirms it's an additive week. The poller correctly stores daily contributions; only the server endpoint's window was wrong.

---

### Verification: HR zone data is correct

`get_activity_hr_in_timezones(activity_id)` → `secsInZone` per zone, divided by 60 for minutes. Multi-sport containers return empty zones; the poller correctly resolves child activity IDs via `metadataDTO.childIds`. Aggregation across activities and display in `ZoneDistribution` is accurate.

---

### Verification: ACWR is correct

`useTrainingData` computes ACWR as the most recent `training_load` value (7-day acute proxy) divided by the 42-day moving average (chronic). Both source from the `training_load` metric in `garmin_snapshots`. This is a standard 1:1 ACWR model; Garmin doesn't expose acute/chronic components directly.

---

## Section: Recovery

### Finding 2 — `useRecoveryData` battery.min = current ✅ FIXED

**File:** `client/src/hooks/useRecoveryData.ts:111`

**Problem:**
```typescript
// Before
min: summary.body_battery_current ?? RECOVERY.battery.min,

// After
min: 0,
```

`battery.min` is passed to `BodyBattery` as the lower bound of the rendered range. When `min === now`, the bar has zero width for the "below current" region, making the fill appear to occupy 100% of the component — the visual range is meaningless.

Setting `min = 0` makes the bar show current level relative to the full 0–100 scale, with `max = wake` defining the top of the day's capacity.

**Note on `body_battery_max`/`body_battery_min` in DB (Finding 8):** These DB metrics store `charged` and `drained` amounts (deltas), NOT level readings. They are correctly ignored by the UI. See Finding 8.

---

### Finding 4 — Recovery "OVERNIGHT VITALS" uses wrong stress metric

**File:** `client/src/hooks/useRecoveryData.ts:71`, `client/src/pages/RecoveryPage.tsx`

**Problem:** The "OVERNIGHT VITALS" section rail in `RecoveryPage` displays `stress_avg` — Garmin's 24-hour stress average, which includes daytime activity, meetings, and exercise. Under a rail explicitly labeled "OVERNIGHT," this is semantically wrong.

**Better metric:** `sleep_stress` — Garmin's HRV-derived stress score computed only during the sleep window. This is already:
- Stored in `garmin_snapshots` as `sleep_stress`
- Fetched in `useSleepData.ts` (`fetchTrend('sleep_stress')`)
- Displayed in the Sleep page

The fix is to fetch `sleep_stress` in `useRecoveryData` and substitute it for `stress_avg` in the OVERNIGHT VITALS section. `stress_avg` can remain available on the card as a secondary/daytime context value.

---

### Verification: HRV data is correct

`hrv` from `get_stats.avgWakingRespiration`... wait, no. `hrv` comes from `get_stats.lastNight.avgOvernightHrv` (confirmed in `garmin_poller.py`). Stored as `hrv`. Used correctly in `useRecoveryData`. `hrv_week_avg` is computed server-side from 7-day rolling average in the summary endpoint.

---

### Verification: RHR data is correct (with caveat)

`resting_hr` is stored from `get_stats.restingHeartRate`. This is accurate. See Finding 3 for the broken `get_rhr_day` path which silently wastes a call.

---

### Verification: Body battery wake/current are correct semantics

`body_battery_wake` ← `get_stats.bodyBatteryAtWakeTime`  
`body_battery_current` ← `get_stats.bodyBatteryMostRecentValue`

These are instantaneous level readings (0–100). Correct for the headline BodyBattery display (wake = max = "how charged you woke up", current = now = "current level").

---

## Section: Sleep

### Finding 5 — Sleep duration computed from stages, not `sleep_s`

**Files:** `client/src/hooks/useSleepData.ts:50`, `client/src/hooks/useHomeData.ts:30`

Both hooks compute:
```typescript
const totalMins = Math.round((deepS + lightS + remS) / 60)
```

After the poller fix (commit b356428), `sleep_s` is now stored as `sleepTimeSeconds` from the Garmin API. Garmin's `sleepTimeSeconds` is their "total sleep time" — which is the same as deep + light + REM (awake-in-bed periods are tracked separately as `sleep_awake_s`).

**Practical impact:** Near-zero. The two values should be identical or within rounding difference (Garmin computes both from the same stage data). This is minor technical debt rather than a data accuracy bug.

**Recommendation:** Switch to `sleep_s` as primary with stage-sum fallback, for semantic alignment:
```typescript
const sleepS = summary.sleep_s ?? (deepS + lightS + remS)
const totalMins = Math.round(sleepS / 60)
```

`inBed` should remain `totalMins + awakeMins` (correct as-is).

---

### Verification: Sleep stage breakdown is correct

Deep, Light, REM seconds are stored individually and displayed as percentages of total sleep time. The `StageDistribution` component computes percentages from the stage values at render time, not from stored percentages. This is correct.

---

### Verification: Sleep score and trend are correct

`sleep_score` from `get_stats.sleepScore`. Trend uses `fetchTrend('sleep_score')` → 7-day rolling from `garmin_snapshots`. Correct.

---

### Verification: SpO2 data is sparse by design

`spo2_avg` has only 5 days of historical data — Garmin only measures SpO2 when "Pulse Ox" is enabled during sleep. Not a bug. The UI handles null gracefully.

---

## Section: Home

### Finding 6 — Home Recovery tile shows `body_battery_wake`, not `recovery_score`

**File:** `client/src/hooks/useHomeData.ts:53`

```typescript
recovery: {
  value: String(s.body_battery_wake ?? 74),  // shows e.g. "87"
  sub:   hrvSub,                              // shows e.g. "HRV ↑ 61ms"
}
```

The Recovery section page uses `recovery_score` (a Garmin composite 0–100 "body battery recovery" metric, computed overnight) as its primary headline. The Home tile uses `body_battery_wake` instead — a different concept (the raw charge level at wake time, not a composite recovery quality score).

**Is this a bug?** Arguably not — wake battery is a quick, intuitive energy readout ("you woke up at 87%"). But it means tapping the Recovery tile takes you to a page whose headline metric differs from what the tile showed. Consider:
- If Home tile should preview the Recovery page: use `recovery_score`
- If Home tile is a standalone "current energy level" readout: `body_battery_wake` is fine but should be labeled accordingly (not under "Recovery")

---

## Poller-Level Findings

### Finding 3 — `get_rhr_day` navigation always returns None

**File:** `scripts/garmin_poller.py`

The poller calls `get_rhr_day(d)` and navigates with:
```python
safe(s, 'restingHeartRate')  # or safe(s, 'value')
```

Live API probe confirms the actual response shape is:
```json
{
  "allMetrics": {
    "metricsMap": {
      "WELLNESS_RESTING_HEART_RATE": [{ "value": 46.0, ... }]
    }
  }
}
```

`safe(s, 'restingHeartRate')` returns None. The metric is never stored from this call.

**Impact: zero.** `resting_hr` is correctly stored via the `get_stats` block:
```python
store(db, d, 'resting_hr', safe(s, 'restingHeartRate'), 'bpm', s)
```
where `s` in the `get_stats` block is `get_stats(d)`, which does return `restingHeartRate` at the top level. The `get_rhr_day` call is a duplicate that was never working.

**Fix (optional cleanup):**
```python
# Either remove the get_rhr_day call entirely, or fix navigation:
r = c.get_rhr_day(d) or {}
rhr_list = ((r.get('allMetrics') or {}).get('metricsMap') or {}).get('WELLNESS_RESTING_HEART_RATE') or []
if rhr_list:
    store(db, d, 'resting_hr', rhr_list[0].get('value'), 'bpm', r)
```

---

### Finding 8 — `body_battery_max`/`body_battery_min` are delta metrics, not level readings

**File:** `scripts/garmin_poller.py`, `scripts/garmin_ingest.py`

Both scripts store:
```python
store(db, d, 'body_battery_max', safe(batt, 'charged'), ...)
store(db, d, 'body_battery_min', safe(batt, 'drained'), ...)
```

`charged` and `drained` from `get_body_battery()` are **amounts** (e.g., charged=45 means you recharged 45 units today), NOT level readings. The metric names `body_battery_max` and `body_battery_min` strongly imply "highest/lowest level today," which is wrong.

**Current impact: zero** — these metrics are never read by any hook or server endpoint. The UI only uses `body_battery_wake` and `body_battery_current` (which are correct level readings from `get_stats`).

**Recommendation:** Rename in both poller and ingest scripts:
```python
store(db, d, 'body_battery_charged', safe(batt, 'charged'), ...)
store(db, d, 'body_battery_drained', safe(batt, 'drained'), ...)
```
Renaming requires a one-time `UPDATE garmin_snapshots SET metric = 'body_battery_charged' WHERE metric = 'body_battery_max'` migration.

---

## Opportunity: Training Readiness Sub-Factors

**Not a bug; enrichment opportunity.**

`get_training_readiness(yesterday)` (must use yesterday — today returns empty) returns rich factor data that is not currently captured:

| Field | Description | DB status |
|-------|-------------|-----------|
| `score` | 0–100 readiness score | ✅ stored as `training_readiness` |
| `sleepScore` | Sleep quality contribution | ❌ not stored |
| `hrvWeeklyAverage` | HRV baseline for readiness calc | ❌ not stored |
| `recoveryTime` | Hours until full recovery | ❌ not stored |
| `hrv5MinHigh` | Peak overnight HRV reading | ❌ not stored |
| `acuteLoad` | Short-term training load factor % | ❌ not stored |
| `sleepHistory` | Sleep consistency factor % | ❌ not stored |
| `stressHistory` | Stress history factor % | ❌ not stored |
| `recentActivityLoad` | Recent activity factor % | ❌ not stored |

`recoveryTime` in particular would be a high-value addition to the Recovery overview — "next optimal training window."

---

## Confirmed Correct Behaviors

These were audited and verified as working correctly:

- **`resting_hr`** — sourced from `get_stats.restingHeartRate`; correct value (46 bpm confirmed)
- **`hrv`** — sourced from `get_stats.lastNight.avgOvernightHrv`; overnight-window only (not 24h)
- **`hrv_week_avg`** — computed server-side as 7-day rolling average
- **`training_load`** — stored daily; ACWR computed from acute (latest) ÷ chronic (42-day avg)
- **`fitness_age`** — from `get_stats.fitnessAge` (not `biometricAge`, not `chronologicalAge`)
- **Intensity minutes** — stored as daily contributions; server sums to weekly (now correctly from Monday)
- **HR zones** — aggregated from per-activity `secsInZone` data; correctly handles multi-sport via child IDs
- **VO2max** — fetched from `get_user_summary`; sparse (10 days); server correctly uses `MAX(date)` for latest available
- **Sleep stages** — stored as individual seconds; percentages computed at render time (not stored)
- **Body battery wake/current** — correct level readings from `get_stats`; correctly used as range bounds (after fix)
- **Summary endpoint `MAX(date)` pattern** — all metrics query per-metric max date; correct for sparse/asynchronous arrival
- **Weight** — fixed in prior session to use `get_weigh_ins` (v0.3.5 API) with `dailyWeightSummaries[].latestWeight` navigation
- **Sleep field** — fixed in prior session to use `sleepTimeSeconds` (not `durationInSeconds`)
