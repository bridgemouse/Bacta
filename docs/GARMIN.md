# Garmin API Reference — Bacta

> Audited 2026-06-11 against garminconnect v0.3.5 and Ethan's live Garmin account (Venu 4).
> Re-run `/tmp/garmin_audit.py` after library upgrades or firmware changes to refresh status.

---

## Library

- **Package:** `garminconnect` v0.3.5 (`pip install garminconnect==0.3.5 --break-system-packages`)
- **Repo:** https://github.com/cyberjunky/python-garminconnect
- **Auth:** Token-file login: `c = Garmin(); c.login(os.path.expanduser('~/.garminconnect'))`
- **Rate limiting:** Sleep 0.4–0.5s between calls; Garmin will throttle aggressive clients

```python
from garminconnect import Garmin
c = Garmin()
c.login(os.path.expanduser('~/.garminconnect'))
```

---

## v0.3.5 Breaking Changes

### `get_daily_weigh_ins` signature changed
```python
# v0.3.3 (old)
c.get_daily_weigh_ins(start, end)   # ← worked

# v0.3.5 (new)
c.get_daily_weigh_ins(cdate)        # ← single date only; (start, end) raises TypeError
```

**Fix:** Use `get_weigh_ins(start, end)` for range fetches. Response structure differs:
```python
# get_weigh_ins response
{
  'dailyWeightSummaries': [{
    'summaryDate': '2026-06-01',
    'latestWeight': {'weight': ..., 'bmi': ..., 'bodyFatPercent': ..., 'muscleMass': ...},
    'allWeightMetrics': [...],   # fallback if latestWeight absent
  }]
}

# get_daily_weigh_ins response (single date only in v0.3.5)
{ 'dateWeightList': [...], 'totalAverage': {...} }
```

**Status:** Fixed in commit b356428 — both scripts updated to use `get_weigh_ins`.

---

## Endpoint Catalog

Legend: ✅ Returns data | ⬜ Empty/null on Venu 4 | ❌ Not supported/no data | 🔴 Bug

### Daily Health

| Method | Args | Returns | Status | Notes |
|--------|------|---------|--------|-------|
| `get_stats(cdate)` | date | dict | ✅ | Steps, calories, distance, floors, RHR, stress, intensity mins, body battery |
| `get_user_summary(cdate)` | date | dict | ✅ | Same as stats — alias; prefer `get_stats` |
| `get_rhr_day(cdate)` | date | dict | ✅ | More precise RHR than `get_stats`; use this |
| `get_stress_data(cdate)` | date | dict | ✅ | `avgStressLevel`, `maxStressLevel` |
| `get_all_day_stress(cdate)` | date | dict | ✅ | Same shape as `get_stress_data` |
| `get_heart_rates(cdate)` | date | dict | ✅ | `maxHeartRate`, `restingHeartRate`, `lastSevenDaysAvgRestingHeartRate`, per-minute array |
| `get_respiration_data(cdate)` | date | dict | ✅ | `avgWakingRespirationValue`, `highestRespirationValue` |
| `get_spo2_data(cdate)` | date | dict | ✅ | `averageSpO2`, `minimumSpO2` |
| `get_body_battery(start, end)` | date, date | list | ✅ | Fields: `charged`, `drained` (NOT max/min levels) — see body battery notes |
| `get_body_battery_events(cdate)` | date | list | ⬜ | Empty on Venu 4 |
| `get_floors(cdate)` | date | dict | ✅ | Per-hour floor data; summary in `get_stats` is sufficient |
| `get_steps_data(cdate)` | date | list | ⬜ | Minute-by-minute; empty at time of audit |
| `get_hydration_data(cdate)` | date | dict | ✅ | Goal exists; no logged intake (not tracked) |
| `get_lifestyle_logging_data(cdate)` | date | dict | ✅ | Template data (Alcohol, Caffeine categories) — no logged entries |
| `get_all_day_events(cdate)` | date | list | ⬜ | Empty |
| `get_intensity_minutes_data(cdate)` | date | dict | ✅ | `weeklyModerate`, `weeklyVigorous` (rolling week) |

### Sleep

| Method | Args | Returns | Status | Notes |
|--------|------|---------|--------|-------|
| `get_sleep_data(cdate)` | date | dict | ✅ | Returns night ending on morning of `cdate`; root is `dailySleepDTO` |

**Key `dailySleepDTO` fields:**
```python
sleepTimeSeconds          # CORRECT total duration — NOT durationInSeconds (that field is absent)
napTimeSeconds
deepSleepSeconds
lightSleepSeconds
remSleepSeconds
awakeSleepSeconds
awakeCount                # Number of wake events — fragmentation indicator
averageSpO2Value          # Sleep SpO2
lowestSpO2Value
averageRespirationValue
lowestRespirationValue
highestRespirationValue
avgHeartRate              # Sleep HR
avgSleepStress            # HRV-derived stress during sleep
breathingDisruptionSeverity  # 0–5 sleep apnea indicator; 0 = none, 3+ = significant
sleepNeed                 # Garmin's recommended sleep amount for tonight (seconds)
nextSleepNeed             # Recommended sleep for the following night
sleepScores               # Dict with per-component scores:
  .overall.value          # 0–100 overall sleep score
  .deepPercentage.value   # % deep sleep
  .remPercentage.value    # % REM
  .restlessness.qualifierKey  # EXCELLENT/FAIR/POOR
  .stress.qualifierKey
  .awakeCount.qualifierKey
sleepAlignment            # Sleep timing vs circadian rhythm (if available)
```

**Fixed (commit b356428):** Both scripts previously called `safe(dto, 'durationInSeconds')` for `sleep_s`, but the correct field is `sleepTimeSeconds`. The field was never stored. Fixed with a fallback: `sleepTimeSeconds or durationInSeconds`. The UI works around the gap by summing deep+light+REM seconds.

### HRV

| Method | Args | Returns | Status | Notes |
|--------|------|---------|--------|-------|
| `get_hrv_data(cdate)` | date | dict or None | ⬜ today | Returns data for yesterday/prior nights; empty for current day until computed |

**Key fields (navigate via `hrvSummary` or `hrv_summary` — try both):**
```python
lastNightAvg        # Primary HRV value
weeklyAvg           # 7-day rolling average
baseline.balancedLow    # Lower bound of personal baseline
baseline.balancedUpper  # Upper bound of personal baseline
```

### Body Composition

| Method | Args | Returns | Status | Notes |
|--------|------|---------|--------|-------|
| `get_weigh_ins(startdate, enddate)` | date, date | dict | ✅ | Range; `dailyWeightSummaries[].latestWeight` for actual values |
| `get_daily_weigh_ins(cdate)` | date | dict | ✅ | Single day only in v0.3.5; `dateWeightList` |
| `get_blood_pressure(startdate, enddate)` | date, date | dict | ✅ | `measurementSummaries[].systolic/.diastolic` |
| `get_body_composition(startdate, enddate)` | date, date | dict | ✅ | Same structure as `get_weigh_ins` |
| `get_daily_steps(start, end)` | date, date | list | ✅ | Per-day: `calendarDate`, `totalSteps`, `stepGoal` |
| `get_weekly_steps(end, weeks)` | date, int | list | ✅ | 52-week history; `calendarDate`, `values` |
| `get_weekly_stress(end, weeks)` | date, int | list | ✅ | 9 weeks returned; per-week avg stress |
| `get_weekly_intensity_minutes(start, end)` | date, date | list | ✅ | `weeklyGoal`, `moderateValue`, `vigorousValue` |

**Body battery fields — important semantics:**
```python
# get_body_battery() returns:
charged    # How much battery was charged during sleep (NOT the wake-up level)
drained    # How much battery was consumed during the day (NOT the overnight low)

# get_stats() returns the actual level readings:
bodyBatteryAtWakeTime       # Level when alarm/wake triggered → store as body_battery_wake
bodyBatteryMostRecentValue  # Current level → store as body_battery_current
```
**Renamed Jun 11, 2026:** `body_battery_max`/`body_battery_min` were renamed to `body_battery_charged`/`body_battery_drained` in the database to reflect their actual semantics (delta amounts, not level readings).

### Training & Fitness

| Method | Args | Returns | Status | Notes |
|--------|------|---------|--------|-------|
| `get_training_readiness(cdate)` | date | list | ⬜ today | Computed overnight; use yesterday or YESTERDAY |
| `get_morning_training_readiness(cdate)` | date | dict | ⬜ today | Filters for `AFTER_WAKEUP_RESET` context; null if not available |
| `get_training_status(cdate)` | date | dict | ✅ | Navigate: `mostRecentTrainingStatus.latestTrainingStatusData.<device_id>` |
| `get_max_metrics(cdate)` | date | list | ⬜ today | VO2max; sparse (only updates ~weekly); use recent date |
| `get_fitnessage_data(cdate)` | date | dict | ✅ | See fields below |
| `get_endurance_score(startdate, enddate?)` | date, date? | dict | ⬜ | Not supported on Venu 4 |
| `get_running_tolerance(startdate, enddate, agg?)` | date, date, str | list | ⬜ | Not supported on Venu 4 |
| `get_race_predictions()` | — | dict | ✅ | Latest 5K/10K/HM/Marathon predictions in seconds |
| `get_race_predictions(start, end, type)` | date, date, 'daily'/'monthly' | list | ✅ | 31 entries for daily range |
| `get_personal_record()` | — | list | ✅ | 9 PRs; see type ID table below |
| `get_hill_score(startdate, enddate)` | date, date | dict | ⬜ | No hill activities in data |
| `get_lactate_threshold()` | — | dict | ✅ | LT heart rate + running FTP power |
| `get_cycling_ftp()` | — | dict | ⬜ | Not set for cycling |
| `get_intensity_minutes_data(cdate)` | date | dict | ✅ | Weekly rolling totals |

**`get_fitnessage_data` fields:**
```python
chronologicalAge        # Biological age (26)
fitnessAge              # Current fitness age (19.1) — lower = better
achievableFitnessAge    # Best attainable fitness age with improvement (18.0)
previousFitnessAge      # Prior reading for delta
components:
  vigorousDaysAvg.value     # Avg vigorous workout days/week (used in calculation)
  rhr.value                 # RHR component
  vigorousMinutesAvg.value  # Avg vigorous minutes/week
  bmi.value                 # BMI component
  bmi.improvementValue      # BMI units to improve to reach achievableFitnessAge
  bmi.potentialAge          # Fitness age if BMI were optimal
```

**`get_race_predictions` fields (in seconds):**
```python
time5K          # 5K prediction in seconds (1400 = 23:20)
time10K         # 10K prediction in seconds (3118 = ~52:00)
timeHalfMarathon  # HM prediction in seconds (7338 = ~2:02)
timeMarathon      # Marathon prediction in seconds (16626 = ~4:37)
calendarDate    # Date of prediction
```

**`get_lactate_threshold` fields:**
```python
speed_and_heart_rate:
  heartRate     # Lactate threshold HR in bpm (184 bpm on 2026-04-27)
  speed         # LT speed in m/s — live value 0.364 m/s = 45:48/km (implausible;
                # likely a failed auto-detection; valid LT ~5:15/km = 3.17 m/s)
                # Requires an official LT test on the device to get real data
  calendarDate  # When this was calculated

power:
  functionalThresholdPower  # Running FTP in watts (396W)
  powerToWeight             # W/kg (4.9 W/kg)
  weight                    # Weight used in calculation (80.78 kg)
  calendarDate              # Date of power reading
```

**Personal record type IDs** (inferred from live data — not officially documented by Garmin):
```
typeId 1  = fastest short segment (~400m) — value observed: 324.4
typeId 2  = fastest mid segment (~800m)   — value observed: 522.8
typeId 3  = fastest 1km segment           — value observed: 1896.3
typeId 7  = longest run distance          — value observed: 8033.5m (confirmed = 5.0mi)
typeId 12 = (unknown distance PR)
```
**Value field semantics are unclear.** typeId=7 is confirmed meters (8033.5m = 5.0mi longest run).
For typeId=1–3, the values (324, 522, 1896) don't cleanly parse as seconds (too slow) or
meters (too short for named distances). May be distance in meters of the best segment found
during the qualifying activity, or time in a non-obvious unit. Do not rely on these values
without cross-referencing against the linked `activityId` to verify.

### Per-Activity

| Method | Args | Returns | Status | Notes |
|--------|------|---------|--------|-------|
| `get_activities_by_date(start, end)` | date, date | list | ✅ | Main activity list; includes TE, recovery time |
| `get_activity(activity_id)` | id | dict | ✅ | Full summary incl. `summaryDTO` with run dynamics + power |
| `get_activity_hr_in_timezones(activity_id)` | id | list | ✅ | `[{zoneNumber, secsInZone, zoneLowBoundary}]` |
| `get_activity_power_in_timezones(activity_id)` | id | list | ⬜ | Empty for most activities; no power zones on Venu 4 for runs |
| `get_activity_splits(activity_id)` | id | dict | ✅ | `lapDTOs[]` per lap with distance/duration/HR/cadence/power |
| `get_activity_typed_splits(activity_id)` | id | dict | ✅ | Alternative split format with `splits[]` array |
| `get_activity_split_summaries(activity_id)` | id | dict | ✅ | Aggregated split summary stats |
| `get_activity_weather(activity_id)` | id | dict | ✅ | `temp`, `relativeHumidity`, `windSpeed`, `windDirection` |
| `get_activity_exercise_sets(activity_id)` | id | dict | ✅ | Strength training sets (empty for cardio/run) |
| `get_activity_details(activity_id)` | id | dict | ✅ | Full chart data; large response, avoid unless needed |

**`get_activity` → `summaryDTO` key fields:**
```python
# All activity types
duration, distance, calories, averageHR, maxHR, minHR
aerobicTrainingEffect      # 0–5 TE score
anaerobicTrainingEffect    # 0–5 anaerobic TE
activityTrainingLoad       # Load contribution of this activity
differenceBodyBattery      # Body battery delta (negative = drained)

# Running only
averageRunCadence          # steps per minute total (both feet combined)
strideLength               # cm
verticalOscillation        # cm
groundContactTime          # ms
averagePower               # watts (Venu 4 estimates running power; 215W typical)
maxPower
minPower
normalizedPower

# Lap splits (lapDTOs[])
startTimeGMT, distance, duration
averageHR, maxHR
averageRunCadence, averagePower
calories
```

**`get_activity_splits` → `lapDTOs[]` per lap:**
```python
startTimeGMT
distance           # meters
duration           # seconds
averageSpeed       # m/s
averageHR, maxHR
averageRunCadence  # steps per minute (both feet)
averagePower       # watts (may be null for walking)
calories
```

**Multi-sport activities:**
- `get_activity_hr_in_timezones(parent_id)` returns empty — always query child IDs
- `_child_activity_ids(c, parent_id)` reads `metadataDTO.childIds` → list of int IDs
- Query each child separately for zones, summaryDTO, and training effect
- Child `activityTypeDTO.typeKey` values seen: `indoor_cardio`, `treadmill_running`, `indoor_rowing`

### Device

| Method | Args | Returns | Status | Notes |
|--------|------|---------|--------|-------|
| `get_devices()` | — | list | ✅ | All paired devices |
| `get_device_last_used()` | — | dict | ✅ | Most recently active device |
| `get_primary_training_device()` | — | dict | ✅ | Primary training device info |

---

## Current DB Metrics (`garmin_snapshots`)

### Collected and working
```
steps, steps_goal, floors_up, floors_down, floors_goal
resting_hr
stress_avg, stress_max
calories_total, calories_active
distance_m
intensity_mod_min, intensity_vig_min
body_battery_current, body_battery_wake
body_battery_charged (how much battery charged during sleep — NOT the wake level)
body_battery_drained (how much battery consumed during the day — NOT the overnight low)
spo2_avg, spo2_min
resp_avg, resp_max
sleep_deep_s, sleep_light_s, sleep_rem_s, sleep_awake_s
sleep_score, sleep_spo2, sleep_resp, sleep_hr, sleep_stress
hrv, hrv_week_avg, hrv_baseline_low, hrv_baseline_high
recovery_score
training_status_n
training_load, training_load_min, training_load_max
vo2max
fitness_age
fitness_age_achievable (sparse — newly added; populates from next poller run)
recovery_time_h (sparse — newly added; populates from next poller run)
hrzone_1_min … hrzone_5_min
weight_kg, bmi, body_fat_pct, muscle_mass_kg (sparse — no recent weigh-ins)
bp_systolic, bp_diastolic (sparse — no recent readings)
endurance_score (0 rows — not supported on Venu 4)
hill_score (0 rows — no hill data)
```

### ✅ Fixed in commit b356428
```
sleep_s           # Was reading 'durationInSeconds' (absent); fixed to 'sleepTimeSeconds'
weight_kg, bmi,   # Were calling get_daily_weigh_ins(start, end) → TypeError in v0.3.5
body_fat_pct,     # Fixed to use get_weigh_ins(start, end) + navigate dailyWeightSummaries
muscle_mass_kg    # Note: no weigh-in data currently in DB; will populate once logged
```

---

## New Data Opportunities (not yet collected)

### High value — add to poller

**Race Predictions** (updates daily based on VO2max + training):
```python
r = c.get_race_predictions()
store(db, today, 'race_5k_s',       r['time5K'],            's')
store(db, today, 'race_10k_s',      r['time10K'],           's')
store(db, today, 'race_hm_s',       r['timeHalfMarathon'],  's')
store(db, today, 'race_marathon_s', r['timeMarathon'],       's')
```

**Achievable Fitness Age** ✅ implemented Jun 11, 2026:
```python
r = c.get_fitnessage_data(today)
store(db, today, 'fitness_age_achievable', safe(r, 'achievableFitnessAge'), 'years')
```

**Lactate Threshold** (stable metric — only fetch weekly):
```python
r = c.get_lactate_threshold()
store(db, today, 'lactate_hr',     safe(r, 'speed_and_heart_rate', 'heartRate'), 'bpm')
store(db, today, 'run_ftp_w',      safe(r, 'power', 'functionalThresholdPower'), 'W')
store(db, today, 'run_pw_ratio',   safe(r, 'power', 'powerToWeight'),            'W/kg')
```

**Sleep quality extras** (from dailySleepDTO, add to existing sleep fetch):
```python
store(db, d, 'sleep_s',                  safe(dto, 'sleepTimeSeconds'),           's')   # FIX
store(db, d, 'sleep_awake_count',         safe(dto, 'awakeCount'),                '')
store(db, d, 'sleep_breathing_disruption',safe(dto, 'breathingDisruptionSeverity'),'')
store(db, d, 'sleep_need_s',              safe(dto, 'sleepNeed'),                  's')
```

**Daily max HR** (from get_heart_rates — already fetched for other purposes):
```python
r = c.get_heart_rates(today)
store(db, d, 'hr_max_day', safe(r, 'maxHeartRate'), 'bpm')
```

### Medium value — add on demand

**Personal records** — needs a dedicated table (not EAV-friendly):
```sql
CREATE TABLE garmin_personal_records (
  type_id INTEGER NOT NULL,
  value   REAL,           -- meters for distance PRs
  activity_id INTEGER,
  activity_name TEXT,
  activity_type TEXT,
  achieved_at TEXT,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (type_id)
);
```

**Per-lap splits** — needs a dedicated table per activity (similar to `garmin_activity_legs`)

### Low value / not applicable on Venu 4
- `endurance_score` — not supported
- `running_tolerance` — not supported  
- `cycling_ftp` — not set
- `body_battery_events` — empty
- `get_activity_power_in_timezones` — empty for Venu 4 activities

---

## Data Collection Notes

### Ingest vs Poller divergence
`garmin_ingest.py` (historical) and `garmin_poller.py` (nightly) differ in scope:
- ✅ Fixed (b356428): Ingest now handles multi_sport child zone resolution, matching poller
- Remaining gap: Poller stores per-activity run dynamics (cadence/stride/vert_osc/GCT) and
  aerobic_te/anaerobic_te/recovery_time_h; ingest stores only basic activity fields
- OTF class days in historical data still have empty HR zones — would need a targeted
  re-ingest of those specific dates to backfill (run `garmin_ingest.py --days N --replace`)

### Training readiness timing
`get_training_readiness(today)` returns empty — Garmin computes this overnight.
Always fetch with `yesterday` or query with `today` but fall back to first available.
In the poller: the `s[0]` pattern is correct since it takes the most recent computed entry.

### VO2max sparsity
Only 10 rows in 365 days — Venu 4 updates VO2max only after qualifying outdoor runs.
Use per-metric `MAX(date)` in DB queries; never filter to exact today.

### Garmin Connect timezone handling
All timestamps come in both GMT and Local flavors.
Store the Local version for `start_time` fields; use the first 10 chars to extract date.
`get_sleep_data(d)` returns sleep that *ended* on the morning of `d` — store under `d`, not `d-1`.

---

## Data Usage Audit — Where Each Metric Is Consumed

| Metric | Fetched in | Used in | Display |
|--------|-----------|---------|---------|
| `hrv` | `useRecoveryData` | RecoveryPage Overview + Trends | HRV card (32px number + sparkline) |
| `hrv_week_avg` | `useRecoveryData` | RecoveryPage | Avg line on HRV sparkline |
| `hrv_baseline_low/high` | `useRecoveryData` | RecoveryPage | IN RANGE badge |
| `recovery_score` | `useRecoveryData` | RecoveryPage Overview + Trends | Gauge hero |
| `resting_hr` | `useRecoveryData` | RecoveryPage + Trends | HeadlineCard |
| `stress_avg` | `useRecoveryData` | RecoveryPage + Trends | HeadlineCard + HealthStatusTile |
| `stress_max` | `useRecoveryData` | RecoveryPage | HealthStatusTile |
| `body_battery_wake` | `useRecoveryData` | RecoveryPage | BodyBattery max=wake |
| `body_battery_current` | `useRecoveryData` | RecoveryPage | BodyBattery now + min |
| `body_battery_max` | (stored) | NOT USED in UI | Stored as `charged` amount |
| `body_battery_min` | (stored) | NOT USED in UI | Stored as `drained` amount |
| `resp_avg` | `useRecoveryData` | RecoveryPage | HealthStatusTile |
| `spo2_avg` | `useRecoveryData` | RecoveryPage | HealthStatusTile |
| `sleep_score` | `useSleepData` | SleepPage | Score tile |
| `sleep_deep_s` | `useSleepData` | SleepPage | Stage distribution + duration |
| `sleep_light_s` | `useSleepData` | SleepPage | Stage distribution + duration |
| `sleep_rem_s` | `useSleepData` | SleepPage | Stage distribution + duration |
| `sleep_awake_s` | `useSleepData` | SleepPage | In-bed time |
| `sleep_spo2` | `useSleepData` | SleepPage | HealthStatusTile |
| `sleep_resp` | `useSleepData` | SleepPage | HealthStatusTile |
| `sleep_hr` | `useSleepData` | SleepPage | HealthStatusTile |
| `sleep_stress` | `useSleepData` | SleepPage | HealthStatusTile |
| `sleep_s` | `useSleepData` (unused) | NOT displayed | Was broken; fixed b356428. UI still computes duration from stages |
| `vo2max` | `useTrainingData` | TrainingPage | VO2max bespoke card |
| `fitness_age` | `useTrainingData` | TrainingPage | VO2max card subtext |
| `training_load` | `useTrainingData` | TrainingPage | LoadBand + Trends |
| `training_load_min/max` | `useTrainingData` | TrainingPage | LoadBand range |
| `training_status_n` | `useTrainingData` | TrainingPage | StatusBanner |
| `intensity_mod_min` | `useTrainingData` (weekly) | TrainingPage | IntensityBar |
| `intensity_vig_min` | `useTrainingData` (weekly) | TrainingPage | IntensityBar |
| `steps` | `useTrainingData` | TrainingPage | Activity tile ring |
| `steps_goal` | `useTrainingData` | TrainingPage | Steps ring max |
| `floors_up` | `useTrainingData` | TrainingPage | Floors tile |
| `floors_goal` | `useTrainingData` | TrainingPage | Floors ring max |
| `calories_total` | `useTrainingData` | TrainingPage | Calories tile |
| `calories_active` | `useTrainingData` | TrainingPage | Calories subtext |
| `distance_m` | `useTrainingData` | TrainingPage | Distance tile |
| `hrzone_1–5_min` | `useTrainingData` | TrainingPage | ZoneDistribution |
| `hrv` (trend) | `useHomeData` | HomePage cross-section | TrendRow |
| `sleep_score` (trend) | `useHomeData` | HomePage cross-section | TrendRow |
| `recovery_score` (trend) | `useHomeData` | HomePage cross-section | TrendRow |
| `training_load` (trend) | `useHomeData` | HomePage cross-section | TrendRow |
