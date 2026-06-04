# Bacta — Garmin Data Reference

**Purpose:** Complete reference for Claude Design showing what Garmin data is available, how it flows through the system, and where it currently appears in the UI. Use this when designing or redesigning any section.

**As of:** 2026-06-02

---

## System Architecture (Data Flow)

```
Garmin Connect API
    ↓ (nightly 3AM, or manual SYNC button)
garmin_poller.py / garmin_ingest.py
    ↓ INSERT OR REPLACE
SQLite: garmin_snapshots (EAV) + garmin_activities (dedicated table)
    ↓
Express /api/garmin/summary  →  fetchSummary() in garminApi.ts  →  hooks  →  pages
Express /api/garmin/:metric   →  fetchTrend(metric, days) in garminApi.ts  →  sparklines/bars
Express /api/garmin/activities →  fetchActivities(days) in garminApi.ts  →  activity log
```

**EAV schema:** `garmin_snapshots(date TEXT, metric TEXT, value REAL, unit TEXT, source_json TEXT)`

**Summary endpoint:** Returns latest value per metric using `MAX(date)` per metric — different metrics may have different latest dates.

---

## 1. Full Metric Inventory

All metrics currently in `garmin_snapshots`, with latest values as of 2026-06-02.

### Recovery / Vitals

| Metric | Latest Value | Rows | Unit | Notes |
|---|---|---|---|---|
| `recovery_score` | 77 | 32 | — | Training readiness 0–100 |
| `hrv` | 66 ms | 50 | ms | Last night's HRV avg |
| `hrv_week_avg` | 62 ms | 50 | ms | 7-day HRV avg |
| `hrv_baseline_low` | 56 ms | 32 | ms | Garmin balanced-low baseline |
| `hrv_baseline_high` | 71 ms | 32 | ms | Garmin balanced-upper baseline |
| `resting_hr` | 43 bpm | 54 | bpm | |
| `stress_avg` | 11 | 54 | — | Daily avg stress 0–100 |
| `stress_max` | 70 | 54 | — | Peak stress of day |
| `resp_avg` | 13 br/min | 54 | brpm | Waking respiration avg |
| `resp_max` | 20 br/min | 54 | brpm | Peak respiration |
| `body_battery_wake` | 100% | 32 | % | Battery at wake-up time (reliable) |
| `body_battery_current` | 78% | 32 | % | Most recent battery reading (reliable) |
| `body_battery_max` | 53% | 54 | % | From battery endpoint — confusing, avoid |
| `body_battery_min` | 39% | 54 | % | From battery endpoint — confusing, avoid |
| `spo2_avg` | 97% | 2 | % | Watch was misconfigured — now fixed, sparse data |

### Sleep

| Metric | Latest Value | Rows | Unit | Notes |
|---|---|---|---|---|
| `sleep_score` | 92 | 52 | — | 0–100 |
| `sleep_deep_s` | 4680 s (78 min) | 52 | s | |
| `sleep_light_s` | 16680 s (278 min) | 52 | s | |
| `sleep_rem_s` | 6300 s (105 min) | 52 | s | |
| `sleep_awake_s` | 720 s (12 min) | 52 | s | |
| `sleep_hr` | 48 bpm | 32 | bpm | Avg overnight heart rate |
| `sleep_resp` | 14 br/min | 52 | brpm | Avg overnight respiration |
| `sleep_stress` | 11 | 32 | — | Avg overnight stress |
| `sleep_spo2` | 98% | 1 | % | Watch now fixed — very sparse, 1 row |

### Training

| Metric | Latest Value | Rows | Unit | Notes |
|---|---|---|---|---|
| `training_status_n` | 7 | 32 | — | Maps to "Productive" (see status map below) |
| `training_load` | 505 | 32 | — | Acute training load |
| `training_load_min` | 410 | 32 | — | Bottom of optimal chronic range |
| `training_load_max` | 769.5 | 32 | — | Top of optimal chronic range — store as float, display rounded |
| `vo2max` | 50.2 mL/kg/min | 10 | mL/kg/min | Updates infrequently — 10 data points over months |
| `fitness_age` | 19.3 yrs | 368 | years | Garmin computed fitness age — updates daily |
| `intensity_mod_min` | 14 min | 32 | min | Weekly moderate intensity minutes |
| `intensity_vig_min` | 29 min | 32 | min | Weekly vigorous intensity minutes |

### HR Zones (per-day, from activity aggregation)

| Metric | Latest Value | Rows | Unit | Notes |
|---|---|---|---|---|
| `hrzone_1_min` | 4.1 min | 23 | min | Z1 Warm Up — aggregated across all day's activities |
| `hrzone_2_min` | 0.9 min | 23 | min | Z2 Easy |
| `hrzone_3_min` | 14.3 min | 23 | min | Z3 Aerobic |
| `hrzone_4_min` | 5.8 min | 23 | min | Z4 Threshold |
| `hrzone_5_min` | 0 min | 23 | min | Z5 Maximum |

**Data source:** `get_activity_hr_in_timezones(activityId)` → `secsInZone` field, divided by 60, summed across all activities per day. **Note:** `get_heart_rates(d)` returns minute-by-minute HR values, NOT zone minutes — do not use it for zone data.

### Daily Activity

| Metric | Latest Value | Rows | Unit | Notes |
|---|---|---|---|---|
| `steps` | 7,137 | 368 | steps | |
| `distance_m` | 5,701 m | 368 | m | Display as km: `Math.round(distance_m / 100) / 10` |
| `calories_total` | 1,294 kcal | 368 | kcal | |
| `calories_active` | 457 kcal | 368 | kcal | |
| `floors_up` | 1.09 | 368 | floors | Garmin returns decimal — round for display |
| `floors_down` | 0.94 | 54 | floors | Captured but not displayed |

### Body Composition (not displayed — no MacroFactor data yet)

| Metric | Latest Value | Rows | Notes |
|---|---|---|---|
| `weight_kg` | — | 0 | Scale not syncing |
| `bmi` | — | 0 | |
| `body_fat_pct` | — | 0 | |
| `muscle_mass_kg` | — | 0 | |

### Legacy / Unused EAV Activity Metrics

| Metric | Latest Value | Rows | Notes |
|---|---|---|---|
| `act_distance_m` | 765.5 m | 205 | Per-activity distance — superseded by `garmin_activities` table |
| `act_duration_s` | 737 s | 205 | Per-activity duration — superseded |
| `act_calories` | 56 kcal | 199 | Per-activity calories — superseded |
| `act_avg_hr` | 87 bpm | 199 | Per-activity avg HR — superseded |

---

## 2. Activities Table

**Schema:** `garmin_activities(activity_id, date, start_time, name, type_key, distance_m, duration_s, calories, avg_hr, elevation_m)`

**Counts:** 58 activities total. Updated via `get_activities_by_date()` in `sync_range()`.

**Common `type_key` values seen:** `treadmill_running`, `multi_sport`, `walking`, `trail_running`, `strength_training`, `yoga`, `mobility`

**Sample:**
```
{ activity_id: 23102806138, date: '2026-06-02', name: 'Easy Run',
  type_key: 'treadmill_running', distance_m: 3881, duration_s: 1810,
  calories: 323, avg_hr: 140 }
```

---

## 3. What's Currently Displayed vs. Available

### Recovery Page (`RecoveryPage.tsx`)

**Overview tab — what's shown:**
| Element | Data source | Component |
|---|---|---|
| Recovery score gauge | `recovery_score` | `Gauge` |
| Score state badge (Optimal/Ready/Low) | computed from score | inline |
| HRV last night + baseline range | `hrv`, `hrv_baseline_low/high`, `hrv_week_avg` | `HeadlineCard` + `Sparkline` |
| Body battery at wake + NOW + consumed | `body_battery_wake`, `body_battery_current` | `HeadlineCard` + `BodyBattery` |
| Battery consumed line | `body_battery_wake - body_battery_current` | computed inline |
| Resting HR VitalTile + sparkline + delta | `resting_hr` (7-day trend) | `VitalTile` |
| Stress avg VitalTile + category sub-label | `stress_avg` + computed label | `VitalTile` |
| Peak Stress VitalTile | `stress_max` | `VitalTile` (conditional) |
| Respiration avg VitalTile + sparkline | `resp_avg` (7-day trend) | `VitalTile` |
| Peak Respiration VitalTile | `resp_max` | `VitalTile` (conditional) |
| SpO₂ VitalTile | `spo2_avg` | `VitalTile` (conditional — hidden if null) |

**Trends tab — what's shown:** Score, HRV, Body Battery (bars), Resting HR, Stress, Respiration sparklines. SpO₂ trend (gated on data + trend length > 0).

**Computed in hook:** `stressLabel` (LOW/MODERATE/HIGH/VERY HIGH), `batteryConsumed`, real 7-day avgs for deltas.

**Available but unused in Recovery:**
- `hrv_week_avg` is used only for the baseline display — could be a standalone trend tile
- `body_battery_current` trend (only "at wake" trend is shown)

---

### Sleep Page (`SleepPage.tsx`)

**Overview tab — what's shown:**
| Element | Data source | Component |
|---|---|---|
| Duration gauge | `sleep_deep_s + sleep_light_s + sleep_rem_s` (computed) | `Gauge` |
| Efficiency % | `totalMins / inBedMins * 100` (computed) | inline foot |
| Sleep debt | `max(0, 480 - totalMins)` (computed, amber) | inline foot |
| Sleep score gauge + state | `sleep_score` | `Gauge` |
| Overnight depth chart | Stub hypnogram (not available from Garmin API) | `SleepDepth` |
| Stage breakdown header | includes `deepRatio%` + `remRatio%` computed | inline |
| Stage split bar + legend | deep/light/rem/awake computed from seconds | `StageSplit` + `StageLegend` |
| Respiration VitalTile | `sleep_resp` | `VitalTile` |
| Avg Heart Rate VitalTile + sparkline | `sleep_hr` (7-day trend) | `VitalTile` (conditional) |
| Sleep Stress VitalTile + sparkline | `sleep_stress` (7-day trend) | `VitalTile` (conditional) |
| SpO₂ avg/low tiles | `sleep_spo2` | `VitalTile` (conditional — hidden if null) |

**Trends tab — what's shown:** Duration (bars), Score, Respiration, Heart Rate, Stress sparklines (all gated on data).

**Computed in hook:** `sleepDebt`, `deepRatio`, `remRatio`, total/stage minutes from seconds.

**Note on depth chart:** The OVERNIGHT DEPTH topographic chart uses a stub hypnogram hardcoded in `stubData.ts`. Garmin does not expose per-epoch sleep staging via their public API — this is cosmetic only.

---

### Training Page (`TrainingPage.tsx`)

**Overview tab — what's shown:**
| Element | Data source | Component |
|---|---|---|
| Training status banner | `training_status_n` → status label | `StatusBanner` |
| VO2 Max gauge + fitness age | `vo2max`, `fitness_age` | `HeadlineCard` + `Gauge` |
| Acute load value + state | `training_load`, `training_load_min/max` | inline + `LoadBand` |
| Load band (optimal range) | `training_load_min/max` | `LoadBand` |
| Intensity bar (mod/vig vs goal) | `intensity_mod_min`, `intensity_vig_min` | `IntensityBar` |
| HR Zones bar + legend | `hrzone_1_min` – `hrzone_5_min` | inline divs (conditional) |
| Daily Activity tiles | `steps`, `distance_m`, `calories_total`, `floors_up` | `VitalTile` grid (conditional) |
| Activity log | `garmin_activities` table (last 8 days) | `LogEntry` |

**Trends tab — what's shown:** Load (bars), VO2 Max (sparse sparkline), Intensity (bars), Steps (bars), Calories (bars). All gated on `trend.length > 0`.

**Training status number → label map:**
```
0,1 → 'No Data'  |  2 → 'Detraining'  |  3 → 'Recovery'
4   → 'Maintaining'  |  5,6,7 → 'Productive'  |  8 → 'Peaking'
9   → 'Overreaching'  |  10 → 'Recovery'
```

---

## 4. Computed Metrics (client-side)

| Metric | Formula | Where |
|---|---|---|
| Battery consumed | `body_battery_wake − body_battery_current` | Recovery hook |
| Stress category label | `avg < 26 → LOW`, `< 51 → MODERATE`, `< 76 → HIGH`, else `VERY HIGH` | Recovery hook |
| Real 7-day delta avgs | `arrAvg(trendArray)` — replaces hardcoded stub values | Recovery hook |
| Sleep total mins | `round((deep_s + light_s + rem_s) / 60)` | Sleep hook |
| Sleep debt | `max(0, 480 − totalMins)` | Sleep hook |
| Deep ratio | `round(deepMins / totalMins * 100)` | Sleep hook |
| REM ratio | `round(remMins / totalMins * 100)` | Sleep hook |
| Stage % | `round(stageMins / totalForPct * 100)` | Sleep hook |
| Efficiency % | `round(totalMins / inBedMins * 100)` | Sleep page |
| Load state | `< min → Under`, `> max → High`, else `Optimal` | Training hook |
| Distance km | `round(distance_m / 100) / 10` | Training hook |
| HR zone % | `round(zoneMins / totalZoneMins * 100)` | Training hook |
| Total zone mins | `hrZones.reduce((s, z) => s + z.mins, 0)` | Training page |
| Intensity points | `moderate + vigorous * 2` | Training Trends |

---

## 5. Data Availability Summary

| Metric group | Rows (richness) | Used in UI | Notes |
|---|---|---|---|
| Daily stats (steps, distance, calories, floors) | 368 rows ✅ | Training daily panel | Rich trend data |
| Sleep stages | 52 rows ✅ | Sleep overview | |
| Sleep overnight vitals (HR, resp, stress) | 32–52 rows ✅ | Sleep vitals + Trends | |
| HRV | 50 rows ✅ | Recovery | |
| Resting HR, stress, resp | 54 rows ✅ | Recovery vitals | |
| Body battery | 32–54 rows ✅ | Recovery | |
| Training load/status | 32 rows ✅ | Training | |
| Intensity minutes | 32 rows ✅ | Training | |
| VO2 max | 10 rows ⚠️ | Training (sparse trend) | Updates very infrequently |
| Fitness age | 368 rows ✅ | Training (display only) | Shown as text, not trended |
| HR zones | 23 rows ✅ | Training zone bar | Activity-based, builds daily |
| SpO₂ | 1–2 rows ⚠️ | Recovery + Sleep (conditional) | Watch recently fixed, will grow |
| Body composition | 0 rows ❌ | Not shown | No MacroFactor sync |

---

## 6. API Endpoints

### `GET /api/garmin/summary`
Returns one value per metric — the latest available, using `MAX(date)` per metric. Returns a flat JSON object keyed by metric name.

### `GET /api/garmin/:metric?from=YYYY-MM-DD&to=YYYY-MM-DD`
Returns ordered array of `{ date, value }` rows for one metric. Only metrics in `VALID_METRICS` are allowed (returns 404 otherwise). Used by `fetchTrend(metric, days)` in the frontend.

### `GET /api/garmin/activities?days=N`
Returns last N days of activities from `garmin_activities` table. Returns `{ activities: GarminActivity[] }`.

### `POST /api/garmin/sync`
Triggers `garmin_poller.py` as a subprocess. Returns immediately; poll `/api/garmin/sync/status` for result.

### `GET /api/garmin/sync/status`
Returns `{ status: 'idle'|'running'|'done'|'error', startedAt: number|null }`.

---

## 7. Hook → Page Data Flow

### `useRecoveryData` → `RecoveryPage`
Fetches: `fetchSummary()` + `fetchTrend()` for hrv, resting_hr, body_battery_wake, stress_avg, resp_avg, recovery_score (all 7-day)

Exposes on `RecoveryData`:
```ts
score: { value, state, trend }
hrv: { value, unit, avg, trend }
battery: { now, max(=wake), min(=current), trend }
rhr: { value, unit, avg, trend, lowerBetter }
stress: { value, unit, avg, trend, lowerBetter }
spo2: { value: number|null, unit, avg: number|null, trend }
resp: { value, unit, avg, trend, lowerBetter }
hrvBaselineLow, hrvBaselineHigh   // from summary
stressLabel                        // 'LOW'|'MODERATE'|'HIGH'|'VERY HIGH'
stressMax                          // from summary.stress_max
respMax                            // from summary.resp_max
batteryConsumed                    // wake − current
```

---

### `useSleepData` → `SleepPage`
Fetches: `fetchSummary()` + `fetchTrend()` for sleep_score, sleep_deep_s, sleep_resp, sleep_hr, sleep_stress (all 7-day)

Exposes on `SleepData`:
```ts
duration: { h, m, mins, inBed, trend }
score: { value, state, trend }
stages: SleepStage[]   // deep/light/rem/awake with mins, pct, color
spo2: { avg: number|null, low: number|null, unit }
resp: { avg, unit }
hypno: number[]        // STUB — hardcoded, not real Garmin data
sleepHr, sleepStress   // from summary (number|null)
sleepDebt              // computed minutes
deepRatio, remRatio    // computed integer %
sleepRespTrend, sleepHrTrend, sleepStressTrend   // number[]
```

---

### `useTrainingData` → `TrainingPage`
Fetches: `fetchSummary()` + `fetchTrend()` for training_load, intensity_vig_min, vo2max(30d), steps(7d), calories_total(7d) + `fetchActivities(8)`

Exposes on `TrainingData`:
```ts
status: { value, sub, trend }
vo2max: { value, unit, delta, fitnessAge, trend }
load: { value, low, high, state, trend }
intensity: { moderate, vigorous, goal, trend }
activities: GarminActivity[]
dailyActivity: {
  steps, distanceKm, caloriesTotal, caloriesActive, floors   // number|null
  stepsTrend, calTrend                                        // number[]
}
hrZones: Array<{ zone, label, mins, pct, color }>   // empty [] if no data
```

---

## 8. Zone + Color Reference

### HR Zones
| Zone | Label | Color | Hex |
|---|---|---|---|
| Z1 | Warm Up | Muted gray | `#56657a` |
| Z2 | Easy | Green | `#4ade80` |
| Z3 | Aerobic | Amber | `#fbbf24` |
| Z4 | Threshold | Red-light | `#f87171` |
| Z5 | Maximum | Red | `#ef4444` |

### Section Accents
| Section | Color | Hex |
|---|---|---|
| Home | MX-4 cyan | `#2bc4e8` |
| Recovery | Periwinkle | `#7c9af8` |
| Training | Ember | `#f5853a` |
| Sleep | Lilac | `#b08cf0` |

### Sleep Stage Colors
| Stage | Color | Hex |
|---|---|---|
| Deep | Deep purple | `#7c5cff` |
| Light | Mid purple | `#a78bfa` |
| REM | Light purple | `#c4b5fd` |
| Awake | Muted | `#56657a` |

---

## 9. Known Gaps & Constraints

| Gap | Detail |
|---|---|
| Overnight depth chart | Garmin API does not expose per-epoch sleep staging — chart uses a hardcoded stub hypnogram |
| `sleep_spo2` | 1 data point — watch was misconfigured until recently; will grow naturally |
| `spo2_avg` | 2 data points — same watch issue |
| `vo2max` | Only 10 data points — Garmin updates this very infrequently (days/weeks) |
| `body_battery_max/min` | From `get_body_battery()` endpoint — field names mean `charged/drained amounts`, not absolute levels. These are unreliable; prefer `body_battery_wake` and `body_battery_current` from `get_stats()` |
| `floors_up/down` | Garmin returns fractional floor values (e.g. 1.09) — always round for display |
| Body composition | MacroFactor not set up — weight/BMI/body fat tables are empty |
| `sleep_s` | Not stored — Garmin's `durationInSeconds` field may not be returned; compute from stage seconds instead |
| HR zone backfill | Only 23 rows (30-day backfill) — days with no HR-tracked activities store all zones as 0 |
