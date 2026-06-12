# Bacta — Data Layer Reference

## Database

**Path:** `/opt/bacta/data/bacta.db`  
**Engine:** SQLite via better-sqlite3  
**Query from shell:** `python3 -c "import sqlite3,json; db=sqlite3.connect('/opt/bacta/data/bacta.db'); [print(json.dumps(dict(r))) for r in db.execute('SELECT ...').fetchall()"`  
(The `sqlite3` CLI is not installed on LXC 109. The `node -e` / better-sqlite3 approach can fail if native bindings aren't compiled in the current shell. Use Python.)

---

## Schema

### `garmin_snapshots`

EAV (Entity-Attribute-Value) table for daily Garmin metrics.

```sql
CREATE TABLE garmin_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,          -- ISO date: '2026-06-11'
  metric      TEXT NOT NULL,          -- e.g. 'hrv', 'sleep_score'
  value       REAL,                   -- numeric value
  unit        TEXT,                   -- e.g. 'ms', 'bpm', null
  source_json TEXT,                   -- raw Garmin API response blob
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric)
);
```

### `garmin_activities`

One row per Garmin activity. Not EAV — activities are multi-field entities that can't be represented in the EAV pattern.

```sql
CREATE TABLE garmin_activities (
  activity_id      INTEGER PRIMARY KEY,   -- Garmin's activity ID
  date             TEXT NOT NULL,
  start_time       TEXT NOT NULL,
  name             TEXT NOT NULL,
  type_key         TEXT NOT NULL,         -- 'running', 'strength_training', 'multi_sport', etc.
  distance_m       REAL,
  duration_s       REAL,
  calories         INTEGER,
  avg_hr           INTEGER,
  elevation_m      REAL,
  aerobic_te       REAL,                  -- aerobic training effect (0–5)
  anaerobic_te     REAL,                  -- anaerobic training effect (0–5)
  recovery_time_h  REAL,                  -- Garmin's estimated recovery time in hours
  zone1_s          INTEGER,               -- seconds in HR zone 1
  zone2_s          INTEGER,
  zone3_s          INTEGER,
  zone4_s          INTEGER,
  zone5_s          INTEGER,
  run_cadence      INTEGER,               -- steps per minute (running only)
  run_stride_cm    REAL,
  run_vert_osc_cm  REAL,
  run_gct_ms       INTEGER,              -- ground contact time in ms
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_garmin_activities_date ON garmin_activities(date);
```

### `garmin_activity_legs`

One row per leg (segment) of a multi-sport activity. Multi-sport containers return empty zone data from `get_activity_hr_in_timezones(parent_id)` — zones must be fetched from each child leg individually.

```sql
CREATE TABLE garmin_activity_legs (
  leg_id            INTEGER PRIMARY KEY,
  activity_id       INTEGER NOT NULL,      -- references garmin_activities.activity_id
  leg_index         INTEGER NOT NULL,      -- 0-based position within the parent activity
  type_key          TEXT NOT NULL,
  start_time        TEXT NOT NULL,
  duration_s        REAL,
  distance_m        REAL,
  calories          INTEGER,
  avg_hr            INTEGER,
  max_hr            INTEGER,
  aerobic_te        REAL,
  anaerobic_te      REAL,
  training_load     REAL,
  body_battery_diff INTEGER,
  zone1_s           INTEGER,
  zone2_s           INTEGER,
  zone3_s           INTEGER,
  zone4_s           INTEGER,
  zone5_s           INTEGER,
  run_cadence       INTEGER,
  run_stride_cm     REAL,
  run_vert_osc_cm   REAL,
  run_gct_ms        INTEGER,
  run_power_w       INTEGER,
  row_stroke_rate   INTEGER,
  row_power_w       INTEGER,
  row_strokes       INTEGER,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(activity_id, leg_index)
);
CREATE INDEX idx_garmin_activity_legs_activity ON garmin_activity_legs(activity_id);
```

### `macrofactor_snapshots`

Same EAV schema as `garmin_snapshots`. Currently empty — MacroFactor integration is blocked on account setup.

```sql
CREATE TABLE macrofactor_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric)
);
```

### `manual_inputs`

One row per day of user-entered daily state.

```sql
CREATE TABLE manual_inputs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL UNIQUE,
  readiness    INTEGER CHECK(readiness BETWEEN 1 AND 5),
  caffeine_mg  INTEGER,
  supplements  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `blood_work`

One row per (date, marker) pair. Currently empty — waiting on lab results.

```sql
CREATE TABLE blood_work (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,
  marker          TEXT NOT NULL,
  value           REAL,
  unit            TEXT,
  reference_range TEXT,
  source_file     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, marker)
);
```

---

## EAV Pattern

`garmin_snapshots` and `macrofactor_snapshots` use Entity-Attribute-Value rather than wide tables. Each row is one metric for one date. This allows new metrics to be added without schema migrations and stores the raw `source_json` from the Garmin API for every reading.

**Querying correctly:** Always use per-metric `MAX(date)` to find the latest value for each metric. Do not hardcode today's date — metrics arrive at different times and some metrics only update weekly.

```python
-- Correct: latest value per metric
SELECT metric, value FROM garmin_snapshots gs
WHERE date = (SELECT MAX(date) FROM garmin_snapshots WHERE metric = gs.metric)

-- Wrong: hardcoding today
SELECT metric, value FROM garmin_snapshots WHERE date = date('now')
-- (breaks when a metric hasn't arrived yet today)
```

The tradeoff: EAV cannot represent entities with multiple rows per day (activities), which is why `garmin_activities` uses a conventional table.

---

## Metric Inventory

As of 2026-06-11 (live recon from database). All metrics are in `garmin_snapshots`.

| Metric | Count | Date Range | Unit | Notes |
|---|---|---|---|---|
| `steps` | 377 | 2025-05-31 → 2026-06-11 | steps | Full history |
| `steps_goal` | 377 | 2025-05-31 → 2026-06-11 | steps | Daily goal |
| `floors_up` | 377 | 2025-05-31 → 2026-06-11 | floors | |
| `distance_m` | 377 | 2025-05-31 → 2026-06-11 | m | Total daily distance |
| `calories_total` | 377 | 2025-05-31 → 2026-06-11 | kcal | |
| `calories_active` | 377 | 2025-05-31 → 2026-06-11 | kcal | |
| `fitness_age` | 377 | 2025-05-31 → 2026-06-11 | years | Garmin-computed fitness age |
| `fitness_age_achievable` | 0 | — | years | Best attainable fitness age; newly added Jun 11, 2026 |
| `act_duration_s` | 205 | 2025-10-30 → 2026-06-01 | s | Legacy EAV activity duration |
| `act_distance_m` | 205 | 2025-10-30 → 2026-06-01 | m | Legacy EAV |
| `act_calories` | 205 | 2025-10-30 → 2026-06-01 | kcal | Legacy EAV |
| `act_avg_hr` | 199 | 2025-10-30 → 2026-06-01 | bpm | Legacy EAV |
| `stress_max` | 63 | 2026-04-10 → 2026-06-11 | 0–100 | |
| `stress_avg` | 63 | 2026-04-10 → 2026-06-11 | 0–100 | |
| `resting_hr` | 63 | 2026-04-10 → 2026-06-11 | bpm | |
| `resp_max` | 63 | 2026-04-10 → 2026-06-11 | br/min | |
| `resp_avg` | 63 | 2026-04-10 → 2026-06-11 | br/min | |
| `floors_goal` | 63 | 2026-04-10 → 2026-06-11 | floors | |
| `floors_down` | 63 | 2026-04-10 → 2026-06-11 | floors | |
| `body_battery_drained` | 63 | 2026-04-10 → 2026-06-11 | units | How much drained in the day |
| `body_battery_charged` | 63 | 2026-04-10 → 2026-06-11 | units | How much charged in the day |
| `sleep_score` | 61 | 2026-04-12 → 2026-06-11 | 0–100 | |
| `sleep_resp` | 61 | 2026-04-12 → 2026-06-11 | br/min | |
| `sleep_rem_s` | 61 | 2026-04-12 → 2026-06-11 | s | |
| `sleep_light_s` | 61 | 2026-04-12 → 2026-06-11 | s | |
| `sleep_deep_s` | 61 | 2026-04-12 → 2026-06-11 | s | |
| `sleep_awake_s` | 61 | 2026-04-12 → 2026-06-11 | s | |
| `hrv_week_avg` | 59 | 2026-04-14 → 2026-06-11 | ms | Rolling weekly HRV average |
| `hrv` | 59 | 2026-04-14 → 2026-06-11 | ms | Last night's HRV |
| `training_status_n` | 41 | 2026-05-02 → 2026-06-11 | int | Garmin status encoded as number |
| `training_load_min` | 41 | 2026-05-02 → 2026-06-11 | — | Lower bound of optimal load range |
| `training_load_max` | 41 | 2026-05-02 → 2026-06-11 | — | Upper bound of optimal load range |
| `training_load` | 41 | 2026-05-02 → 2026-06-11 | — | Acute training load |
| `sleep_stress` | 41 | 2026-05-02 → 2026-06-11 | 0–100 | Overnight stress level |
| `sleep_hr` | 41 | 2026-05-02 → 2026-06-11 | bpm | Average overnight heart rate |
| `recovery_score` | 41 | 2026-05-02 → 2026-06-11 | 0–100 | Garmin Training Readiness |
| `recovery_time_h` | 0 | — | h | Hours until full recovery; newly added Jun 11, 2026 |
| `intensity_vig_min` | 41 | 2026-05-02 → 2026-06-11 | min | Vigorous intensity minutes |
| `intensity_mod_min` | 41 | 2026-05-02 → 2026-06-11 | min | Moderate intensity minutes |
| `hrv_baseline_low` | 41 | 2026-05-02 → 2026-06-11 | ms | Personal HRV baseline lower bound |
| `hrv_baseline_high` | 41 | 2026-05-02 → 2026-06-11 | ms | Personal HRV baseline upper bound |
| `body_battery_wake` | 41 | 2026-05-02 → 2026-06-11 | 0–100 | Battery level on waking |
| `body_battery_current` | 41 | 2026-05-02 → 2026-06-11 | 0–100 | Current battery level |
| `hrzone_5_min` | 32 | 2026-05-04 → 2026-06-11 | min | |
| `hrzone_4_min` | 32 | 2026-05-04 → 2026-06-11 | min | |
| `hrzone_3_min` | 32 | 2026-05-04 → 2026-06-11 | min | |
| `hrzone_2_min` | 32 | 2026-05-04 → 2026-06-11 | min | |
| `hrzone_1_min` | 32 | 2026-05-04 → 2026-06-11 | min | |
| `vo2max` | 11 | 2026-04-10 → 2026-06-06 | mL/kg/min | **Sparse** — see below |
| `spo2_avg` | 11 | 2026-06-01 → 2026-06-11 | % | **Sparse** — see below |
| `sleep_spo2` | 10 | 2026-06-02 → 2026-06-11 | % | **Sparse** — see below |

**Sparse metrics:**
- `vo2max` (11 rows): Garmin only updates VO2max when a GPS running activity with sufficient exertion is recorded. Not a daily metric.
- `spo2_avg` (11 rows): Requires the device to have pulse oximetry enabled all-day. Data availability depends on device settings and battery tolerance.
- `sleep_spo2` (10 rows): Sleep-specific SpO2 readings. Same device requirement as `spo2_avg`.
- `endurance_score`: Zero rows — never collected. The Garmin API field exists but this device/plan level may not provide it.

**Legacy EAV activity metrics** (`act_duration_s`, `act_distance_m`, `act_calories`, `act_avg_hr`): Collected before the `garmin_activities` table existed. Now superseded. The poller no longer writes to these; they remain in the DB for historical continuity only.

---

## Garmin API Gotchas

Every entry here represents a real bug that was introduced and fixed. Read these before touching the poller.

**Sleep date convention.** `get_sleep_data(d)` returns sleep that *ended* on the morning of `d`. Store the result under date `d`, not `d-1`. Getting this wrong shifts all sleep data back one day.

**Fitness age field name.** The Garmin API returns `fitnessAge`, not `biometricAge`. Never fall back to `chronologicalAge` — it's a completely different field (Ethan's actual age) and will always exist even when `fitnessAge` is absent. Writing `chronologicalAge` as the fitness age is a silent data corruption.

**HR zone data source.** `get_heart_rates(d)` returns minute-by-minute HR values, not zone minutes. To get zone minutes, use `get_activity_hr_in_timezones(activityId)` — the field is `secsInZone` per zone. Divide by 60 to get minutes. Aggregate across all activities for the day to get daily totals.

**Multi-sport containers.** Multi-sport activities are parent containers — calling `get_activity_hr_in_timezones(parent_id)` returns empty. Use `_child_activity_ids(conn, activity_id)` defined in `garmin_poller.py`, which reads `metadataDTO.childIds` from the activity summary. Query zones on each child activity individually.

**Summary queries use per-metric MAX(date).** See the EAV section above. Hardcoding `today` breaks when metrics arrive at different times during the day.

**Write patterns.** Use `INSERT OR IGNORE` for `garmin_snapshots` rows (metrics are immutable once stored). Use `INSERT OR REPLACE` for `garmin_activities` rows so re-syncs overwrite stale activity data.

**Body battery fields.** Garmin returns two types of body battery data:
- Delta amounts: `body_battery_charged` and `body_battery_drained` (how much charged/drained in the day)
- Level readings: `body_battery_wake` and `body_battery_current` (the actual 0–100 battery level)
These were renamed from `max`/`min` in a database migration (Jun 11, 2026). Any code still referencing `body_battery_max` or `body_battery_min` is using the old names.

**Common `type_key` values** for activities: `running`, `trail_running`, `walking`, `hiking`, `cycling`, `strength_training`, `multi_sport`.

---

## Stub vs. Live Boundary (as of Jun 2026)

| Data type | Source |
|---|---|
| All Garmin metrics | Live — `garmin_snapshots` via `/api/garmin/*` |
| Activities | Live — `garmin_activities` via `/api/garmin/activities` |
| Activity legs | Live — `garmin_activity_legs` via `/api/garmin/activities/:id/legs` |
| MX-4 briefing text | **Stub** — `client/src/lib/stubData.ts` `BRIEFS` |
| MX-4 tone/mood/chips | **Stub** — `stubData.ts` `BRIEFS` |
| Nutrition data | Empty — `macrofactor_snapshots` has no rows |
| Blood work | Empty — `blood_work` has no rows |
| Manual inputs | Empty — `manual_inputs` has no rows |
| Insights HTML | Empty — `insights/` directory has no `.html` files |

The MX-4 briefing system is the primary stub. All section pages render static `BRIEFS` text until the orchestrator is run for the first time.

---

## Obsidian Vault

**Mount:** NFS read-only from LXC 106 (192.168.1.202) → `/mnt/vault` on LXC 109  
**MX-4 path:** `VAULT_WIKI_ROOT=/mnt/vault/wiki`  
**Access:** `mx4/vault_query_server.py` — local MCP server exposing `search_wiki`, `read_wiki_page`, `get_wiki_index` tools  
**Purpose:** MX-4 reads Ethan's vault for personal context during briefing generation: training goals, running plans, timeline (including pre-wedding timeline), race goals, health history notes  

The vault is read-only. The MCP server does not write to it.

---

## Future Data Sources

| Source | Section | Blocker |
|---|---|---|
| MacroFactor | Nutrition | No account — must create MacroFactor account and implement API/export integration |
| Lab results | Blood Work | Waiting on actual lab results; `blood_work` table is ready |
| Daily Log | Daily Log | No data source defined — manual input UI (`/api/manual`) exists but the form has not been built |
