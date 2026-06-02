# Garmin Sections Polish — Research Brief

**Context:** Recovery, Sleep, and Training sections have real Garmin data wired. Functionality is solid but sections are light — many captured metrics are unused. Goal is to surface ALL meaningful data, match what mainstream health apps show, and add computed metrics where useful. This doc is the research output from a full audit session. Use it as the starting point for brainstorming before touching any code.

---

## 1. Full DB Metric Inventory

All metrics currently in `garmin_snapshots`, with latest values as of 2026-06-01:

### Recovery / Vitals
| Metric | Latest Value | Notes |
|---|---|---|
| `recovery_score` | 79 | Training readiness score 0–100 |
| `hrv` | 61 ms | Last night's HRV average |
| `hrv_week_avg` | 62 ms | 7-day HRV average |
| `hrv_baseline_low` | 56 ms | Garmin's balanced-low baseline |
| `hrv_baseline_high` | 71 ms | Garmin's balanced-upper baseline |
| `resting_hr` | 44 bpm | |
| `stress_avg` | 24 | Avg stress level (0–100) |
| `stress_max` | 87 | **UNUSED** — peak stress of day |
| `resp_avg` | 12 br/min | Waking respiration average |
| `resp_max` | 20 br/min | **UNUSED** — peak respiration |
| `body_battery_wake` | 94 % | Battery level at wake-up time |
| `body_battery_current` | 39 % | Most recent battery reading |
| `body_battery_max` | 55 % | From body_battery endpoint (charged amt — confusing, avoid) |
| `body_battery_min` | 56 % | From body_battery endpoint (drained amt — confusing, avoid) |
| `spo2_avg` | null | Watch was misconfigured — will populate when fixed |
| `spo2_min` | null | Same |

### Sleep
| Metric | Latest Value | Notes |
|---|---|---|
| `sleep_score` | 82 | 0–100 |
| `sleep_deep_s` | 3480 s | 58 min |
| `sleep_light_s` | 18180 s | 303 min |
| `sleep_rem_s` | 5700 s | 95 min |
| `sleep_awake_s` | 1500 s | 25 min |
| `sleep_hr` | 49 bpm | Average overnight HR |
| `sleep_resp` | 14 br/min | Average overnight respiration |
| `sleep_stress` | 18 | Average overnight stress |
| `sleep_spo2` | null | Watch misconfigured — will populate |
| `sleep_s` | null | Total sleep duration — field exists in poller but not stored (Garmin may not return `durationInSeconds`) |

### Training
| Metric | Latest Value | Notes |
|---|---|---|
| `training_status_n` | 7 | Maps to "Productive" |
| `training_load` | 481 | Acute training load |
| `training_load_min` | 412 | Bottom of optimal chronic range |
| `training_load_max` | 772.5 | Top of optimal chronic range |
| `intensity_mod_min` | 29 min | Weekly moderate intensity minutes |
| `intensity_vig_min` | 31 min | Weekly vigorous intensity minutes |
| `vo2max` | 50.2 mL/kg/min | Only 10 data points — updates infrequently |
| `fitness_age` | 19.26 yrs | Garmin computed fitness age |

### Daily Activity — UNUSED in UI
| Metric | Latest Value | Notes |
|---|---|---|
| `steps` | 9,186 | |
| `distance_m` | 7,315 m | 7.3 km |
| `calories_total` | 2,113 kcal | |
| `calories_active` | 510 kcal | |
| `floors_up` | 12.6 | |
| `floors_down` | 14 | |

### Not Yet Captured (poller update needed)
| Metric | Source | Notes |
|---|---|---|
| `hrzone_1_min` – `hrzone_5_min` | `get_heart_rates(d)` | HR zone minutes per day. Field names to try: `minutesInHeartRateZone`, `timeInZone`, `minutes`. Store as `hrzone_1_min` through `hrzone_5_min`. |

---

## 2. What's Currently Displayed vs Unused

### Recovery — currently displayed
- Recovery score gauge + state label
- HRV last night (value + sparkline + baseline range)
- Body Battery at wake / NOW (via BodyBattery bar)
- Resting HR (VitalTile + sparkline + delta vs stub avg)
- Stress avg (VitalTile + sparkline + delta vs stub avg)
- SpO₂ — **STUB, no real data**
- Respiration avg (VitalTile + sparkline + delta vs stub avg)

### Recovery — unused but available
- `stress_max` (peak stress — MX-4 would absolutely call this out)
- `resp_max` (peak respiration)
- Body battery consumed = `body_battery_wake - body_battery_current`
- Real 7-day averages for RHR/stress/resp deltas (currently using hardcoded stub values)
- Stress category label: LOW (0–25) / MODERATE (26–50) / HIGH (51–75) / VERY HIGH (76–100)

### Sleep — currently displayed
- Duration (computed from deep+light+rem) + efficiency %
- Sleep score + state label
- Overnight depth chart (STUB hypnogram — not capturable from Garmin API)
- Stage breakdown: deep/light/REM/awake mins + proportional bar
- SpO₂ avg/low — **STUB, no real data**
- Respiration avg
- Sleep HR (conditional)
- Sleep Stress (conditional)

### Sleep — unused but available
- Sleep debt = max(0, 480 - totalMins) — deficit vs 8h target
- Deep sleep ratio = deepMins / totalMins × 100
- REM ratio = remMins / totalMins × 100
- Real trend data for resp, HR, stress (sleep_resp, sleep_hr, sleep_stress all have 31+ rows)

### Training — currently displayed
- Training status banner (Productive)
- VO2 Max gauge + fitness age
- Acute load + load band (optimal range)
- Intensity bar (mod/vig vs 150min goal)
- Activity log (real Garmin data, last 8 days)

### Training — unused but available
- `steps`, `distance_m`, `calories_total`, `calories_active`, `floors_up` (all have 367 rows)
- HR zones (not yet captured — needs poller update)
- `vo2max` trend (10 data points — sparse but valid)
- `steps` and `calories_total` trend (367 rows — rich data)

---

## 3. Computed Metrics to Derive Client-Side

| Metric | Formula | Where |
|---|---|---|
| Body battery consumed | `body_battery_wake - body_battery_current` | Recovery overview |
| Stress category | `avg < 26` → LOW, `< 51` → MODERATE, `< 76` → HIGH, else VERY HIGH | Recovery overview |
| Real 7-day avg for deltas | `arrAvg(trendArray)` — replace stub hardcoded values | Recovery hook |
| Sleep debt | `Math.max(0, 480 - totalMins)` | Sleep overview |
| Deep sleep ratio | `Math.round(deepMins / totalMins * 100)` | Sleep stage breakdown |
| REM ratio | `Math.round(remMins / totalMins * 100)` | Sleep stage breakdown |
| Weekly intensity points | `moderate + vigorous * 2` | Training (already in Trends) |
| HR zone percentages | `mins / totalZoneMins * 100` | Training (after poller update) |

---

## 4. What Mainstream Apps Show (gaps we have)

### Recovery (Garmin Connect, Whoop, Oura)
- ✅ Training readiness score
- ✅ HRV overnight avg + baseline
- ✅ Body battery wake + current
- ✅ Resting HR
- ✅ Stress avg
- ✅ Respiration avg
- ❌ **Peak stress** — we have `stress_max`, just not showing it
- ❌ **Stress category label** — LOW/MODERATE/HIGH context
- ❌ **Battery consumed** — how much drained since wake
- ❌ SpO₂ (device misconfigured — will come)
- ❌ Real 7-day avg deltas (currently stub)

### Sleep (Garmin, Oura, Whoop, Apple Health)
- ✅ Duration, score, stages, efficiency
- ✅ Sleep HR, respiration, stress
- ❌ **Sleep debt** vs target
- ❌ **Deep/REM ratios** (% context on top of raw minutes)
- ❌ SpO₂ (device misconfigured — will come)
- ❌ **7-day trend sparklines** for HR/resp/stress (data exists, not fetched)

### Training (Garmin Connect, Strava, TrainingPeaks)
- ✅ Training status, VO2 max, acute load, intensity minutes, activity log
- ❌ **Steps, distance, calories, floors** (daily activity panel)
- ❌ **HR zone breakdown** (Z1–Z5 minutes + bar chart)
- ❌ **7-day trends** for steps, calories (data exists, not fetched)

---

## 5. Proposed Change Categories (approved scope, needs design)

### Category 1 — Quick wins (data in DB, just not rendered)
- Recovery: show `stress_max`, `resp_max`, body battery consumed, stress category label
- Recovery: fix deltas to use real 7-day averages (not stub values)
- Training: add Daily Activity panel with steps/distance/calories/floors

### Category 2 — Computed metrics
- Sleep: sleep debt vs 8h target
- Sleep: deep ratio + REM ratio in stage breakdown header
- Recovery: stress category label (LOW/MODERATE/HIGH/VERY HIGH)
- Recovery: body battery consumed (wake − current)

### Category 3 — New trend fetches (data exists in DB)
- Sleep Trends: add rows for sleep_resp, sleep_hr, sleep_stress (all have 31+ data points)
- Training Trends: add rows for steps (367 pts), calories_total (367 pts), vo2max (10 pts)

### Category 4 — New poller capture
- HR zones: add `get_heart_rates(d)` call to poller and ingest
- Store as `hrzone_1_min` through `hrzone_5_min`
- Add to `VALID_METRICS` in server/api/garmin.ts
- Training page: show HR zone bar + legend when data available

### Category 5 — Conditional SpO₂
- All SpO₂ tiles should be hidden when no real data (not stub values)
- Show automatically when `spo2_avg` / `sleep_spo2` appear in DB after watch is fixed
- Do NOT remove from hooks/pages — keep conditional render logic

---

## 6. Key Constraints / Rules for Implementation

### Trends tab rule (CRITICAL)
> **Trends tab must ONLY show rows that have real 7-day sparkline or bar chart data. Never show static single values on Trends — those belong on Overview.**

- A TrendRow with `data={[]}` is NOT a trend — it's a static label. Remove it.
- Gate every Trends row: `{trendArray.length > 0 && <TrendRow ... data={trendArray} />}`

### SpO₂ rule
- `spo2_avg`, `spo2_min`, `sleep_spo2` are null — watch was misconfigured
- Keep conditional rendering in place; tiles appear automatically when data arrives
- Never show stub SpO₂ values

### Body battery endpoint confusion
- `body_battery_max` and `body_battery_min` from `get_body_battery()` appear to store `charged`/`drained` amounts, not absolute levels — their values are confusing (min > current)
- Prefer `body_battery_wake` (from stats, bodyBatteryAtWakeTime) and `body_battery_current` (bodyBatteryMostRecentValue) — these are reliable
- Body battery consumed = `wake - current` (computed client-side)

### Delta precision
- `Delta` component renders `Math.abs(value)` without rounding
- Float subtraction (e.g. `12 - 12.7 = -0.6999...`) produces garbage display
- Fix: `parseFloat(Math.abs(value).toFixed(1))` in Delta component

### Real 7-day averages
- Current hooks use hardcoded stub values for RHR/stress/resp delta calculations
- Fix: compute avg from the trend array already being fetched: `arrAvg(trendArray)`
- Only use stub fallback when trend array is empty

---

## 7. Data Architecture Notes

### Trend fetch pattern
```ts
fetchTrend('metric_name', 7)  // returns number[] oldest→newest, empty if no data
```
Sleep metrics with confirmed trend data (31+ rows): `sleep_resp`, `sleep_hr`, `sleep_stress`, `sleep_deep_s`, `sleep_score`

Daily metrics with rich trend data (367 rows): `steps`, `calories_total`, `calories_active`, `distance_m`

Sparse but valid: `vo2max` (10 rows)

### HR zones poller code (to add to sync_day in both poller and ingest)
```python
try:
    s = c.get_heart_rates(d)
    if s:
        zones = (safe(s, 'heartRateZones') or safe(s, 'zones') or [])
        for i, zone in enumerate(zones[:5]):
            mins = (safe(zone, 'minutesInHeartRateZone') or
                    safe(zone, 'timeInZone') or
                    safe(zone, 'minutes'))
            if mins is not None:
                store(db, d, f'hrzone_{i+1}_min', mins, 'min')
    ok.append('hr_zones')
except Exception as e:
    err.append(f'hr_zones({e})')
time.sleep(SLEEP_BETWEEN)
```

### Zone display colors (Training accent = `#f5853a` ember)
- Z1 Warm Up: `#56657a` (muted)
- Z2 Easy: `#4ade80` (green)
- Z3 Aerobic: `#fbbf24` (amber)
- Z4 Threshold: `#f87171` (red-light)
- Z5 Maximum: `#ef4444` (red)

---

## 8. Files That Will Change

| File | Change |
|---|---|
| `client/src/components/viz/Delta.tsx` | Fix float precision: `parseFloat(Math.abs(value).toFixed(1))` |
| `client/src/components/viz/VitalTile.tsx` | Add optional `sub?: string` prop for secondary label |
| `client/src/lib/garminApi.ts` | Expand GarminSummary interface with 13+ new fields |
| `client/src/hooks/useRecoveryData.ts` | Real 7d avgs, stress_max/resp_max/consumed/label |
| `client/src/hooks/useSleepData.ts` | Sleep debt, deep/REM ratios, real trend fetches |
| `client/src/hooks/useTrainingData.ts` | Daily activity object, HR zones, vo2max/steps/cal trends |
| `client/src/pages/RecoveryPage.tsx` | New vitals layout, battery consumed, stress label |
| `client/src/pages/SleepPage.tsx` | Sleep debt in duration card, ratios in stage header, real Trends |
| `client/src/pages/TrainingPage.tsx` | Daily Activity panel, HR zone section, real Trends |
| `scripts/garmin_poller.py` | Add HR zones capture |
| `scripts/garmin_ingest.py` | Add HR zones capture |
| `server/api/garmin.ts` | Add hrzone_1_min–hrzone_5_min to VALID_METRICS |
