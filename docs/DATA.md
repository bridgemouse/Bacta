# Bacta — Data Layer Reference

## Database

**Path:** `/opt/bacta/data/bacta.db`  
**Engine:** SQLite via better-sqlite3  
**Query:** Use the `bacta-sqlite` MCP — ask Claude to run any SQL against the DB directly. The `sqlite3` CLI is not installed on LXC 109; the MCP replaces all Python wrapper one-liners.

---

## Schema

### `health_snapshots`

EAV (Entity-Attribute-Value) table for daily health metrics from all providers.

```sql
CREATE TABLE health_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,          -- ISO date: '2026-06-11'
  metric      TEXT NOT NULL,          -- e.g. 'hrv', 'sleep_score'
  value       REAL,                   -- numeric value
  unit        TEXT,                   -- e.g. 'ms', 'bpm', null
  source      TEXT NOT NULL DEFAULT 'garmin',  -- provider: 'garmin', 'oura', 'polar', etc.
  source_json TEXT,                   -- raw provider API response blob
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric, source)        -- allows multiple providers per metric per day
);
```

### `health_activities`

One row per activity. Not EAV — activities are multi-field entities that can't be represented in the EAV pattern.

```sql
CREATE TABLE health_activities (
  activity_id      TEXT NOT NULL,         -- provider's activity ID
  source           TEXT NOT NULL DEFAULT 'garmin',
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
  recovery_time_h  REAL,                  -- recovery time in MINUTES (legacy column name; ÷60 for hours)
  zone1_s          INTEGER,               -- seconds in HR zone 1
  zone2_s          INTEGER,
  zone3_s          INTEGER,
  zone4_s          INTEGER,
  zone5_s          INTEGER,
  run_cadence      INTEGER,               -- steps per minute (running only)
  run_stride_cm    REAL,
  run_vert_osc_cm  REAL,
  run_gct_ms       INTEGER,              -- ground contact time in ms
  max_hr                 INTEGER,        -- from get_activity() summaryDTO.maxHR
  min_hr                 INTEGER,        -- summaryDTO.minHR
  training_load          REAL,           -- summaryDTO.activityTrainingLoad
  body_battery_diff      INTEGER,        -- summaryDTO.differenceBodyBattery
  moving_duration_s      REAL,           -- summaryDTO.movingDuration (excludes stopped time)
  elapsed_duration_s     REAL,           -- summaryDTO.elapsedDuration (wall-clock, includes stops)
  avg_speed_mps          REAL,           -- summaryDTO.averageSpeed, meters/second
  max_speed_mps          REAL,           -- summaryDTO.maxSpeed, meters/second
  training_effect_label  TEXT,           -- summaryDTO.trainingEffectLabel, e.g. 'TEMPO_TRAINING', 'RECOVERY'
  steps                  INTEGER,        -- summaryDTO.steps
  bmr_calories           INTEGER,        -- summaryDTO.bmrCalories (calories from basal metabolism during the activity)
  moderate_intensity_min REAL,           -- summaryDTO.moderateIntensityMinutes
  vigorous_intensity_min REAL,           -- summaryDTO.vigorousIntensityMinutes
  avg_power_w            INTEGER,        -- summaryDTO.averagePower — power-meter activities only, NULL otherwise
  normalized_power_w     INTEGER,        -- summaryDTO.normalizedPower — power-meter activities only
  active_sets            INTEGER,        -- summaryDTO.activeSets — strength_training only, NULL otherwise
  total_exercise_reps    INTEGER,        -- summaryDTO.totalExerciseReps — strength_training only
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (activity_id, source)
);
CREATE INDEX idx_health_activities_date ON health_activities(date);
```

**#41 per-activity field expansion (2026-07-02).** All fields above from `max_hr` through `total_exercise_reps` come from a single `get_activity(activity_id)` call's `summaryDTO`, extracted by `extract_activity_summary_fields(dto, type_key)` in `scripts/garmin_poller.py` (imported by `garmin_ingest.py` — the two scripts otherwise duplicate logic per their differing conventions, but this helper is shared since it's pure and type-agnostic). Inventory was done against live `running` and `strength_training` activities; fields present in both dicts are populated for every `type_key`, fields absent from a given type's `summaryDTO` resolve to `NULL` via `.get()` (e.g. `active_sets`/`total_exercise_reps` are `NULL` for non-strength activities; `avg_power_w`/`normalized_power_w` are `NULL` for activities without a power meter).

Explicitly deferred, not included in this migration:
- GPS start/end coordinates (`startLatitude`/`startLongitude`/`endLatitude`/`endLongitude`) — low narrative value without a map view; no map view exists yet.
- `minElevation`/`maxElevation`/`avgElevation` — redundant with the existing `elevation_m` (elevationGain) column for MX-4's purposes.
- Weather fields (`averageTemperature`, etc.) — requires a separate `get_activity_weather()` call per activity; deferred to keep this migration to a single additional API call per activity.
- `recoveryHeartRate`, `waterEstimated`, `minActivityLapDuration` — low value / not meaningfully actionable.
- Structured per-set exercise detail (`get_activity_exercise_sets()` — individual set/rep/weight/exercise-name rows) and splits/laps (`get_activity_splits()`/`get_activity_split_summaries()`) — repeating data that would need a new child table (`health_activity_legs`-style), out of scope for this pass; noted as a natural follow-up.
- GPS track points / second-by-second streams — explicitly out of scope per the schema (would need a dedicated time-series design).
- Mirroring these same fields onto `health_activity_legs` (multi-sport children) — `max_hr`/`training_load`/`body_battery_diff` already existed there from an earlier pass; the other 14 new fields are not yet mirrored onto legs, deferred as a follow-up.
- Only `running` and `strength_training` were inventoried directly against the live API; `cycling`/`hiking`/`multi_sport` were not separately verified — the extraction function is type-agnostic so it should behave the same, but hasn't been spot-checked against those types' real payloads.

### `health_activity_legs`

One row per leg (segment) of a multi-sport activity. Multi-sport containers return empty zone data from `get_activity_hr_in_timezones(parent_id)` — zones must be fetched from each child leg individually.

```sql
CREATE TABLE health_activity_legs (
  leg_id            INTEGER PRIMARY KEY,
  activity_id       TEXT NOT NULL,         -- references health_activities.activity_id
  source            TEXT NOT NULL DEFAULT 'garmin',
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
CREATE INDEX idx_health_activity_legs_activity ON health_activity_legs(activity_id);
```

### `foods`, `food_variants`, `food_log_entries`, `nutrition_targets`

Nutrition is a custom-built tracker, not a third-party integration — the abandoned `macrofactor_snapshots` EAV placeholder was dropped (confirmed empty, zero references anywhere in the codebase) since its shape can't represent multiple foods logged per meal per day. See `docs/NUTRITION_PLAN.md` §3 for the full schema, design notes, and rationale. These are normal (non-EAV) tables — query columns directly rather than filtering by a `metric` column.

**`foods` is identity-only** — name, brand, source (`usda` | `openfoodfacts` | `custom`). All servable-unit data (quantity, unit, macros) lives on `food_variants`: one row per servable unit of a food (e.g. "100 g", "1 tbsp", "1 cup"), each with its own precomputed macro columns (`calories`, `protein_g`, `carbs_g`, `fat_g`, plus a fuller micronutrient set). Every food has at least one variant with `is_default=1`, enforced at the application layer since SQLite can't express "at least one child row" as a constraint. `food_log_entries.variant_id` and `recipe_ingredients.variant_id` reference `food_variants(id)` (nullable, for fully ad-hoc entries); `food_log_entries`' own nutrient columns are a denormalized snapshot at log time so editing a `foods`/`food_variants` row later never silently changes what a past day's log says was eaten. Live in production since PR #169 (2026-07-28): 8,157 foods / 22,972 variants as of the last audit (2026-07-29), 94.5% of foods have 1–4 variants.

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

`health_snapshots` uses Entity-Attribute-Value rather than a wide table. Each row is one metric for one date. This allows new metrics to be added without schema migrations and stores the raw `source_json` from the provider API for every reading.

**Querying correctly:** Always use per-metric `MAX(date)` to find the latest value for each metric. Do not hardcode today's date — metrics arrive at different times and some metrics only update weekly.

```python
-- Correct: latest value per metric
SELECT metric, value FROM health_snapshots hs
WHERE date = (SELECT MAX(date) FROM health_snapshots WHERE metric = hs.metric)

-- Wrong: hardcoding today
SELECT metric, value FROM health_snapshots WHERE date = date('now')
-- (breaks when a metric hasn't arrived yet today)
```

The tradeoff: EAV cannot represent entities with multiple rows per day (activities), which is why `health_activities` uses a conventional table.

---

## Metric Inventory

As of 2026-08-12 (live recon from database). All metrics are in `health_snapshots`.

| Metric | Count | Date Range | Unit | Notes |
|---|---|---|---|---|
| `steps` | 439 | 2025-05-31 → 2026-08-12 | steps | Full history |
| `steps_goal` | 439 | 2025-05-31 → 2026-08-12 | steps | Daily goal |
| `floors_up` | 439 | 2025-05-31 → 2026-08-12 | floors | |
| `distance_m` | 439 | 2025-05-31 → 2026-08-12 | m | Total daily distance |
| `calories_total` | 439 | 2025-05-31 → 2026-08-12 | kcal | |
| `calories_active` | 439 | 2025-05-31 → 2026-08-12 | kcal | |
| `fitness_age` | 439 | 2025-05-31 → 2026-08-12 | years | Garmin-computed fitness age |
| `fitness_age_achievable` | 63 | 2026-06-11 → 2026-08-12 | years | Best attainable fitness age; added Jun 11, 2026 — no longer sparse |
| `act_duration_s` | 205 | 2025-10-30 → 2026-06-01 | s | Legacy EAV activity duration |
| `act_distance_m` | 205 | 2025-10-30 → 2026-06-01 | m | Legacy EAV |
| `act_calories` | 205 | 2025-10-30 → 2026-06-01 | kcal | Legacy EAV |
| `act_avg_hr` | 199 | 2025-10-30 → 2026-06-01 | bpm | Legacy EAV |
| `resting_hr` | 127 | 2024-01-11 → 2026-08-12 | bpm | |
| `resp_avg` | 126 | 2024-01-11 → 2026-08-12 | br/min | |
| `stress_max` | 125 | 2026-04-10 → 2026-08-12 | 0–100 | |
| `stress_avg` | 125 | 2026-04-10 → 2026-08-12 | 0–100 | |
| `resp_max` | 125 | 2026-04-10 → 2026-08-12 | br/min | |
| `floors_goal` | 125 | 2026-04-10 → 2026-08-12 | floors | |
| `floors_down` | 125 | 2026-04-10 → 2026-08-12 | floors | |
| `body_battery_drained` | 125 | 2026-04-10 → 2026-08-12 | units | How much drained in the day |
| `body_battery_charged` | 125 | 2026-04-10 → 2026-08-12 | units | How much charged in the day |
| `sleep_score` | 122 | 2024-01-11 → 2026-08-12 | 0–100 | |
| `sleep_rem_s` | 122 | 2024-01-11 → 2026-08-12 | s | |
| `sleep_light_s` | 122 | 2024-01-11 → 2026-08-12 | s | |
| `sleep_deep_s` | 122 | 2024-01-11 → 2026-08-12 | s | |
| `hrv` | 121 | 2024-01-12 → 2026-08-12 | ms | Last night's HRV |
| `sleep_awake_s` | 121 | 2026-04-12 → 2026-08-12 | s | |
| `sleep_resp` | 121 | 2026-04-12 → 2026-08-12 | br/min | |
| `hrv_week_avg` | 120 | 2026-04-14 → 2026-08-12 | ms | Rolling weekly HRV average |
| `body_battery_current` | 103 | 2026-05-02 → 2026-08-12 | 0–100 | Current battery level |
| `intensity_mod_min` | 103 | 2026-05-02 → 2026-08-12 | min | Moderate intensity minutes |
| `intensity_vig_min` | 103 | 2026-05-02 → 2026-08-12 | min | Vigorous intensity minutes |
| `recovery_score` | 103 | 2026-05-02 → 2026-08-12 | 0–100 | Garmin Training Readiness |
| `training_load` | 103 | 2026-05-02 → 2026-08-12 | — | Acute training load |
| `training_load_max` | 103 | 2026-05-02 → 2026-08-12 | — | Upper bound of optimal load range |
| `training_load_min` | 103 | 2026-05-02 → 2026-08-12 | — | Lower bound of optimal load range |
| `training_status_n` | 103 | 2026-05-02 → 2026-08-12 | int | Garmin status encoded as number |
| `hrv_baseline_high` | 102 | 2026-05-02 → 2026-08-12 | ms | Personal HRV baseline upper bound |
| `hrv_baseline_low` | 102 | 2026-05-02 → 2026-08-12 | ms | Personal HRV baseline lower bound |
| `body_battery_wake` | 101 | 2026-05-02 → 2026-08-12 | 0–100 | Battery level on waking |
| `sleep_hr` | 101 | 2026-05-02 → 2026-08-12 | bpm | Average overnight heart rate |
| `sleep_stress` | 101 | 2026-05-02 → 2026-08-12 | 0–100 | Overnight stress level |
| `hrzone_1_min` … `hrzone_5_min` | 92 | 2026-05-04 → 2026-08-12 | min | |
| `spo2_avg` | 74 | 2024-01-12 → 2026-08-12 | % | No longer sparse — was 11 rows as of Jun 2026 |
| `sleep_spo2` | 70 | 2026-06-02 → 2026-08-12 | % | No longer sparse — was 10 rows as of Jun 2026 |
| `recovery_time_h` | 63 | 2026-06-11 → 2026-08-12 | **min** | Recovery time — **stored in MINUTES despite the name/legacy unit**; divide by 60 for hours. Populated reliably since Jun 11 — the "needs post-poller verification" caveat from that date is resolved. See `docs/MX4_REFERENCE.md`. |
| `sleep_s` | 62 | 2024-01-11 → 2026-08-12 | s | Not directly displayed — UI computes duration from stage sums |
| `vo2max` | 22 | 2026-04-10 → 2026-08-10 | mL/kg/min | **Sparse** — see below |
| `weight_kg` | 2 | 2024-01-10, 2026-08-07 | kg | Sparse — infrequent weigh-ins |
| `endurance_score` | 0 | — | — | Never collected — Garmin API field exists but this device/plan level may not provide it |

**Sparse metrics:**
- `vo2max` (22 rows): Garmin only updates VO2max when a GPS running activity with sufficient exertion is recorded. Not a daily metric.
- `weight_kg` (2 rows): Depends on manual weigh-ins.
- `endurance_score` (0 rows): The Garmin API field exists but this device/plan level may not provide it.

**Legacy EAV activity metrics** (`act_duration_s`, `act_distance_m`, `act_calories`, `act_avg_hr`): Collected before the `health_activities` table existed. Now superseded. The poller no longer writes to these; they remain in the DB for historical continuity only.

**Orphaned single-row metrics found during the 2026-08-12 refresh:** `deep_sleep_s`, `light_sleep_s`, `rem_sleep_s`, `respiration`, `sleep_duration_s`, `spo2` each have exactly 1 row, all dated 2024-01-11/12. These look like stray writes under pre-#104 metric naming (before the multi-device metric-vocabulary fix standardized all providers onto the Garmin-derived names) rather than a currently-active write path — not yet root-caused; flagging here rather than in the main table so a future pass can confirm and clean them up.

---

## Garmin API Gotchas

Every entry here represents a real bug that was introduced and fixed. Read these before touching the poller.

**Sleep date convention.** `get_sleep_data(d)` returns sleep that *ended* on the morning of `d`. Store the result under date `d`, not `d-1`. Getting this wrong shifts all sleep data back one day.

**Fitness age field name.** The Garmin API returns `fitnessAge`, not `biometricAge`. Never fall back to `chronologicalAge` — it's a completely different field (the user's chronological age) and will always exist even when `fitnessAge` is absent. Writing `chronologicalAge` as the fitness age is a silent data corruption.

**HR zone data source.** `get_heart_rates(d)` returns minute-by-minute HR values, not zone minutes. To get zone minutes, use `get_activity_hr_in_timezones(activityId)` — the field is `secsInZone` per zone. Divide by 60 to get minutes. Aggregate across all activities for the day to get daily totals.

**Multi-sport containers.** Multi-sport activities are parent containers — calling `get_activity_hr_in_timezones(parent_id)` returns empty. Use `_child_activity_ids(conn, activity_id)` defined in `garmin_poller.py`, which reads `metadataDTO.childIds` from the activity summary. Query zones on each child activity individually.

**Summary queries use per-metric MAX(date).** See the EAV section above. Hardcoding `today` breaks when metrics arrive at different times during the day.

**Write patterns.** Use `INSERT OR REPLACE` for both `health_snapshots` and `health_activities` rows, so a same-day metric or activity can be corrected on re-sync (e.g. if the source revises a computed value) rather than silently keeping the first value ever written.

**Body battery fields.** Garmin returns two types of body battery data:
- Delta amounts: `body_battery_charged` and `body_battery_drained` (how much charged/drained in the day)
- Level readings: `body_battery_wake` and `body_battery_current` (the actual 0–100 battery level)
These were renamed from `max`/`min` in a database migration (Jun 11, 2026). Any code still referencing `body_battery_max` or `body_battery_min` is using the old names.

**Common `type_key` values** for activities: `running`, `trail_running`, `walking`, `hiking`, `cycling`, `strength_training`, `multi_sport`.

---

## Stub vs. Live Boundary (as of 2026-08-12)

| Data type | Source |
|---|---|
| All Garmin metrics | Live — `health_snapshots` via `/api/garmin/*` |
| Activities | Live — `health_activities` via `/api/garmin/activities` |
| Activity legs | Live — `health_activity_legs` via `/api/garmin/activities/:id/legs` |
| MX-4 briefing text | **Live** — `mx4_briefings` table via `/api/insights/:section` → `useBriefing`. `stubData.ts` `BRIEFS` is a fallback only (used until a section has generated). |
| MX-4 tone/headline/summary/body | **Live** — `mx4_briefings.content_json` |
| Nutrition data | **Live** — backend (`foods`/`food_variants`/`food_log_entries`/`nutrition_targets`) and full frontend (Overview, Library, Log/Edit Entry sheets) both shipped; see PRs #136, #138, #169 |
| Blood work | Empty — `blood_work` has no rows (section in STANDBY) |
| Manual inputs | Empty — `manual_inputs` has no rows (Daily Log in STANDBY) |

MX-4 briefings are **live**: the TypeScript orchestrator (`server/lib/ai/orchestrator.ts`) writes `{tone, headline, summary, body, recommendation, flags}` to the `mx4_briefings` table, which the section pages render. The legacy `insights/*.html` path is dead. Only the two data-blocked sections (Blood Work, Daily Log) remain placeholders.

---

## Obsidian Vault

**Server:** `llm-wiki-mcp` — a standalone MCP server (Python, separate repo) running on LXC 106 at `192.168.1.202:8765`, serving the user's Obsidian vault over HTTP/SSE  
**Client:** `server/lib/ai/vaultClient.ts` — `@modelcontextprotocol/sdk` client singleton, connects via `vault_url` setting (e.g. `http://192.168.1.202:8765`) when `vault_enabled=true`  
**Tools:** `search_wiki`, `read_wiki_page`, `list_wiki_pages`, `get_wiki_index` — exposed as Vercel AI SDK tools, merged into the orchestrator/chat tool set conditionally  
**Purpose:** MX-4 reads the user's vault for personal context during briefing generation: training goals, running plans, timeline, race goals, health history notes  

**Not an NFS mount.** This replaced an earlier NFS-mount design (`/mnt/vault`, a local `readVault` filesystem tool) — see `docs/VAULT_INTEGRATION.md` for the current, authoritative implementation and `docs/VAULT_SETUP.md` for the superseded NFS approach (kept for reference only). The vault is read-only from Bacta's side; the MCP server does not accept writes.

---

## Future Data Sources

Nutrition shipped as a custom-built tracker (not MacroFactor or any third-party integration) — see `docs/NUTRITION_PLAN.md`. It is no longer a "future" source.

| Source | Section | Blocker |
|---|---|---|
| Lab results | Blood Work | Waiting on actual lab results; `blood_work` table is ready |
| Daily Log | Daily Log | No data source defined — manual input UI (`/api/manual`) exists but the form has not been built |
