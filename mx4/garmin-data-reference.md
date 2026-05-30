# Garmin Data Reference

Source: Garmin Connect API via `python-garminconnect` (cyberjunky).
Data is polled hourly by `poller/garmin_service.py` and stored in `garmin_snapshots`.

---

## Metrics Stored in `garmin_snapshots`

### Activity

| metric | unit | source field | notes |
|--------|------|--------------|-------|
| `steps` | steps | `totalSteps` | Daily step count. Updates throughout the day as the watch syncs. |
| `floors` | floors | `floorsAscended` | Rounded integer. Garmin calculates from elevation gain (~3m per floor). Raw API value is a decimal. |
| `intensity_minutes` | minutes | `moderateIntensityMinutes + vigorousIntensityMinutes × 2` | WHO-style intensity minutes. Vigorous counts double. |
| `hydration_ml` | ml | `waterIntakeInML` | Manual entries from Garmin Connect app only. Null if not logged. |

### Heart Rate

| metric | unit | source field | notes |
|--------|------|--------------|-------|
| `resting_hr` | bpm | `restingHeartRate` | Calculated by Garmin from overnight/at-rest readings. One of the most reliable daily health signals. |

### HRV

| metric | unit | source field | notes |
|--------|------|--------------|-------|
| `hrv` | ms | `hrvSummary.lastNightAvg` | Average HRV during last night's sleep window. Primary HRV metric. |
| `hrv_5min_high` | ms | `hrvSummary.lastNight5MinHigh` | Peak 5-minute HRV reading during sleep — reflects parasympathetic ceiling. |
| `hrv_status` | — | `hrvSummary.status` | Garmin's qualitative status. Values seen: `NONE` (onboarding, not enough baseline), `BALANCED`, `UNBALANCED`. |

### Sleep

Data is from the previous night. The `date` field represents the morning you woke up, not the night you went to sleep.

| metric | unit | source field | notes |
|--------|------|--------------|-------|
| `sleep_duration` | minutes | `sleepTimeSeconds ÷ 60` | Total sleep time (excludes awake periods). |
| `sleep_score` | score (0–100) | `sleepScores.overall.value` | Garmin's composite sleep score. |
| `sleep_deep_minutes` | minutes | `deepSleepSeconds ÷ 60` | Deep (slow-wave) sleep. Ideal: ~15–20% of total sleep. |
| `sleep_light_minutes` | minutes | `lightSleepSeconds ÷ 60` | Light sleep. Typically the largest stage. |
| `sleep_rem_minutes` | minutes | `remSleepSeconds ÷ 60` | REM sleep. Ideal: ~20–25% of total sleep. |
| `sleep_awake_minutes` | minutes | `awakeSleepSeconds ÷ 60` | Time spent awake during sleep window. |

### Body Battery

Garmin's proprietary energy reserve metric (0–100). Charged by sleep and rest, drained by activity and stress.

| metric | unit | source field | notes |
|--------|------|--------------|-------|
| `body_battery` | score (0–100) | `bodyBatteryMostRecentValue` | Current body battery level. This is the value to surface in the dashboard. |
| `body_battery_charged` | score | `bodyBatteryChargedValue` | How much battery was charged during last sleep. |
| `body_battery_drained` | score | `bodyBatteryDrainedValue` | How much battery was drained by activity today. |

### Stress

| metric | unit | source field | notes |
|--------|------|--------------|-------|
| `stress_score` | score (0–100) | `averageStressLevel` | Average stress throughout the day. 0–25 = resting/low, 26–50 = low, 51–75 = medium, 76–100 = high. Derived from HRV variability. |

### Recovery & Training Load

| metric | unit | source field | notes |
|--------|------|--------------|-------|
| `recovery_score` | score (0–100) | `score` from `get_training_readiness()` | Garmin's training readiness score. Composite of sleep, HRV, stress history, and training load. |
| `recovery_time_hours` | hours | `recoveryTime ÷ 60` | **API returns minutes despite the name.** Time until Garmin considers you recovered. Updated after each activity and at wakeup. The most recent reading (index 0) is used. |
| `training_load` | load | `acuteLoad` | Acute training load — recent training stress. Higher = more accumulated fatigue. |

### VO2 Max

| metric | unit | source field | notes |
|--------|------|--------------|-------|
| `vo2max` | ml/kg/min | `vo2Max` from `get_max_metrics()` | Only available when Garmin has enough run/activity data to calculate. May be absent if no recent outdoor activities with GPS. |

---

## API Quirks Worth Knowing

- **`recoveryTime` is in minutes**, not hours. The field name is misleading. Always divide by 60.
- **`floorsAscended` is a float** (e.g., `11.67`). We store it rounded to the nearest integer.
- **Training readiness returns a list**, sorted newest-first. Multiple entries exist because Garmin recalculates after each activity sync and at wakeup. We always use index 0.
- **Sync lag**: Data updates when the watch syncs to the phone. Steps, body battery, and stress may be 15–60 minutes behind real time depending on sync frequency.
- **Sleep date convention**: Sleep data is keyed to the morning of wake-up, not the night it began.
- **HRV status `NONE`**: Normal during first weeks of use. Garmin needs ~3 weeks of overnight data to establish a baseline before it will show `BALANCED` or `UNBALANCED`.

---

## Methods Reference

| method | returns |
|--------|---------|
| `client.get_user_summary(date)` | Steps, HR, stress, body battery, floors, intensity, hydration |
| `client.get_hrv_data(date)` | HRV summary and per-reading time series |
| `client.get_sleep_data(date)` | Sleep stages, scores, sleep need |
| `client.get_training_readiness(date)` | Recovery score, recovery time, training load |
| `client.get_max_metrics(date)` | VO2max, fitness age (when available) |
| `client.get_body_battery(start, end)` | Body battery time series (charged/drained + values array) |
| `client.get_stress_data(date)` | Stress timeline (not currently polled) |
| `client.get_training_status(date)` | Training load balance, training effect (not currently polled) |
