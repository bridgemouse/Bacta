# Multi-Device Wearables: Plan 1 — Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Garmin-specific DB tables to provider-agnostic names, add a `source` column to all health data tables, relocate Garmin scripts into a unified provider directory, and create the shared metric registry and source resolution utilities that all future provider integrations depend on.

**Architecture:** SQLite migration renames `garmin_snapshots` → `health_snapshots` (adding `source TEXT DEFAULT 'garmin'` and updating the unique constraint to `UNIQUE(date, metric, source)`), and similarly for activities tables. All existing Garmin data is preserved — rows get `source = 'garmin'` automatically. Server SQL references and tests are updated to match. New shared files (`metricMap.ts`, `sourceResolver.ts`) establish the canonical metric name registry and the priority-based value resolver used by Plans 2 and 3.

**Tech Stack:** SQLite (better-sqlite3), TypeScript (Node/Express), Python 3, Vitest

## Global Constraints

- Inline styles only — no CSS files or Tailwind (client components)
- Dark UI always — no light mode
- No multi-line paste in terminal — use scripts or files
- Commits go directly to `feature/multi-device` branch
- `INSERT OR IGNORE` for idempotent DB writes
- Migration must be idempotent — safe to run on an already-migrated DB
- All 324 existing tests must pass at end of this plan
- Type check must pass: `npx tsc -p tsconfig.server.json --noEmit`

---

## File Map

**Modified:**
- `server/db/schema.sql` — rename tables, add source columns, update constraints
- `server/db/migrate.ts` — add idempotent rename migrations for all three tables
- `server/api/garmin.ts` — update all SQL table name references
- `server/lib/ai/tools.ts` — update queryDb schema description
- `tests/server/db.test.ts` — update table name assertions
- `tests/server/garmin.test.ts` — update INSERT statements to use new table names
- `tests/server/tools.test.ts` — update table name references
- `tests/server/mx4chat.test.ts` — update table name references
- `scripts/install-garmin-poller.sh` — update script path reference
- `docs/DATA.md` — update schema documentation
- `CLAUDE.md` — update table name references

**Created:**
- `server/lib/integrations/shared/metricMap.ts` — canonical metric registry, PROVIDER_LABELS, METRIC_SOURCES
- `server/lib/integrations/shared/sourceResolver.ts` — resolveSource() utility
- `tests/server/sourceResolver.test.ts` — tests for resolveSource
- `scripts/providers/garmin/poller.py` — moved from `scripts/garmin_poller.py`
- `scripts/providers/garmin/ingest.py` — moved from `scripts/garmin_ingest.py`
- `scripts/health_poller.py` — dispatcher (calls active providers; garmin only for now)
- `scripts/install-health-poller.sh` — updated installer for new paths

---

## Task 1: Create the feature branch

**Files:** none (git only)

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feature/multi-device
```

Expected: `Switched to a new branch 'feature/multi-device'`

---

## Task 2: Migrate health_snapshots schema

Rename `garmin_snapshots` → `health_snapshots`, add `source` column, update the unique constraint to allow multiple providers per metric per day.

**Files:**
- Modify: `server/db/schema.sql`
- Modify: `server/db/migrate.ts`
- Modify: `tests/server/db.test.ts`

**Interfaces:**
- Produces: `health_snapshots(date, metric, source, value, unit, source_json)` with `UNIQUE(date, metric, source)`

- [ ] **Step 1: Update schema.sql — replace garmin_snapshots with health_snapshots**

Replace the entire `garmin_snapshots` block in `server/db/schema.sql` (lines 1–10):

```sql
CREATE TABLE IF NOT EXISTS health_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source      TEXT NOT NULL DEFAULT 'garmin',
  source_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric, source)
);
```

- [ ] **Step 2: Add migration to migrate.ts**

Add the following block inside `migrate()` in `server/db/migrate.ts`, after the existing `db.exec(schema)` call and before `initSettings()`:

```typescript
  // Rename garmin_snapshots → health_snapshots (idempotent)
  const hasOldSnapshots = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='garmin_snapshots'"
  ).get()
  if (hasOldSnapshots) {
    db.exec(`
      INSERT OR IGNORE INTO health_snapshots
        (id, date, metric, value, unit, source_json, created_at)
      SELECT id, date, metric, value, unit, source_json, created_at
      FROM garmin_snapshots
    `)
    db.exec('DROP TABLE garmin_snapshots')
    console.log('[db] migrated garmin_snapshots → health_snapshots')
  }
```

- [ ] **Step 3: Write failing tests in tests/server/db.test.ts**

Replace the entire content of `tests/server/db.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'

process.env.DB_PATH = ':memory:'

describe('schema', () => {
  let db: Database.Database

  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    const client = await import('../../server/db/client')
    db = client.default
    migrate()
  })

  it('creates health_snapshots table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='health_snapshots'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates manual_inputs table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='manual_inputs'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates macrofactor_snapshots table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='macrofactor_snapshots'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates blood_work table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='blood_work'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('enforces readiness range on manual_inputs', () => {
    expect(() => {
      db.prepare(
        'INSERT INTO manual_inputs (date, readiness) VALUES (?, ?)'
      ).run('2026-04-25', 6)
    }).toThrow()
  })

  it('allows same metric from two sources on health_snapshots', () => {
    db.prepare(
      'INSERT INTO health_snapshots (date, metric, value, source) VALUES (?, ?, ?, ?)'
    ).run('2026-04-25', 'hrv', 45, 'garmin')
    expect(() => {
      db.prepare(
        'INSERT INTO health_snapshots (date, metric, value, source) VALUES (?, ?, ?, ?)'
      ).run('2026-04-25', 'hrv', 48, 'oura')
    }).not.toThrow()
  })

  it('rejects duplicate date+metric+source on health_snapshots', () => {
    db.prepare(
      'INSERT INTO health_snapshots (date, metric, value, source) VALUES (?, ?, ?, ?)'
    ).run('2026-04-26', 'steps', 9000, 'garmin')
    expect(() => {
      db.prepare(
        'INSERT INTO health_snapshots (date, metric, value, source) VALUES (?, ?, ?, ?)'
      ).run('2026-04-26', 'steps', 9001, 'garmin')
    }).toThrow()
  })
})
```

- [ ] **Step 4: Run tests to verify they fail (table name not yet found)**

```bash
npm run test:server -- --reporter=verbose tests/server/db.test.ts
```

Expected: FAIL — `health_snapshots` not found (old schema still used)

- [ ] **Step 5: Run tests to verify they pass after schema changes**

```bash
npm run test:server -- --reporter=verbose tests/server/db.test.ts
```

Expected: all 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/db/schema.sql server/db/migrate.ts tests/server/db.test.ts
git commit -m "feat(db): rename garmin_snapshots → health_snapshots, add source column"
```

---

## Task 3: Migrate health_activities and health_activity_legs

Rename `garmin_activities` → `health_activities` (composite PK of `activity_id TEXT + source TEXT`), and `garmin_activity_legs` → `health_activity_legs` (add `source` column).

**Files:**
- Modify: `server/db/schema.sql`
- Modify: `server/db/migrate.ts`

**Interfaces:**
- Produces: `health_activities(activity_id TEXT, source TEXT, date, ...)` with `PRIMARY KEY (activity_id, source)`
- Produces: `health_activity_legs(leg_id, activity_id TEXT, source TEXT, ...)` with `UNIQUE(activity_id, source, leg_index)`

- [ ] **Step 1: Update schema.sql — replace garmin_activities with health_activities**

Replace the `garmin_activities` block and its index in `server/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS health_activities (
  activity_id      TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'garmin',
  date             TEXT NOT NULL,
  start_time       TEXT NOT NULL,
  name             TEXT NOT NULL,
  type_key         TEXT NOT NULL,
  distance_m       REAL,
  duration_s       REAL,
  calories         INTEGER,
  avg_hr           INTEGER,
  elevation_m      REAL,
  aerobic_te       REAL,
  anaerobic_te     REAL,
  recovery_time_h  REAL,
  zone1_s          INTEGER,
  zone2_s          INTEGER,
  zone3_s          INTEGER,
  zone4_s          INTEGER,
  zone5_s          INTEGER,
  run_cadence      INTEGER,
  run_stride_cm    REAL,
  run_vert_osc_cm  REAL,
  run_gct_ms       INTEGER,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (activity_id, source)
);
CREATE INDEX IF NOT EXISTS idx_health_activities_date ON health_activities(date);
```

- [ ] **Step 2: Replace garmin_activity_legs with health_activity_legs in schema.sql**

```sql
CREATE TABLE IF NOT EXISTS health_activity_legs (
  leg_id            INTEGER PRIMARY KEY,
  activity_id       TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'garmin',
  leg_index         INTEGER NOT NULL,
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
  UNIQUE(activity_id, source, leg_index)
);
CREATE INDEX IF NOT EXISTS idx_health_activity_legs_activity ON health_activity_legs(activity_id);
```

- [ ] **Step 3: Add activities migration to migrate.ts**

Add after the health_snapshots migration block (before `initSettings()`):

```typescript
  // Rename garmin_activities → health_activities (idempotent)
  const hasOldActivities = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='garmin_activities'"
  ).get()
  if (hasOldActivities) {
    db.exec(`
      INSERT OR IGNORE INTO health_activities
        (activity_id, date, start_time, name, type_key, distance_m, duration_s,
         calories, avg_hr, elevation_m, aerobic_te, anaerobic_te, recovery_time_h,
         zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
         run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, created_at)
      SELECT
        CAST(activity_id AS TEXT), date, start_time, name, type_key, distance_m, duration_s,
        calories, avg_hr, elevation_m, aerobic_te, anaerobic_te, recovery_time_h,
        zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
        run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, created_at
      FROM garmin_activities
    `)
    db.exec('DROP TABLE garmin_activities')
    console.log('[db] migrated garmin_activities → health_activities')
  }

  // Rename garmin_activity_legs → health_activity_legs (idempotent)
  const hasOldLegs = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='garmin_activity_legs'"
  ).get()
  if (hasOldLegs) {
    db.exec(`
      INSERT OR IGNORE INTO health_activity_legs
        (leg_id, activity_id, leg_index, type_key, start_time, duration_s, distance_m,
         calories, avg_hr, max_hr, aerobic_te, anaerobic_te, training_load,
         body_battery_diff, zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
         run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, run_power_w,
         row_stroke_rate, row_power_w, row_strokes, created_at)
      SELECT
        leg_id, CAST(activity_id AS TEXT), leg_index, type_key, start_time, duration_s,
        distance_m, calories, avg_hr, max_hr, aerobic_te, anaerobic_te, training_load,
        body_battery_diff, zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
        run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, run_power_w,
        row_stroke_rate, row_power_w, row_strokes, created_at
      FROM garmin_activity_legs
    `)
    db.exec('DROP TABLE garmin_activity_legs')
    console.log('[db] migrated garmin_activity_legs → health_activity_legs')
  }

  // Remove old activity columns migration — columns now part of fresh schema
  // (NEW_ACTIVITY_COLS loop above is safe to keep — will error harmlessly on
  //  health_activities which no longer has those missing columns)
```

- [ ] **Step 4: Remove stale NEW_ACTIVITY_COLS loop from migrate.ts**

The `NEW_ACTIVITY_COLS` loop in `migrate.ts` attempts to ALTER TABLE `garmin_activities` — that table no longer exists after migration. Replace the loop with a no-op comment:

```typescript
  // NEW_ACTIVITY_COLS: columns are now part of health_activities schema from the start
  // (legacy ALTER TABLE loop removed — garmin_activities no longer exists post-migration)
```

- [ ] **Step 5: Run type check only — test failures expected here**

```bash
npx tsc -p tsconfig.server.json --noEmit
```

Expected: no type errors. Do NOT run `npm run test:server` yet — `garmin.test.ts` seed INSERTs still reference `garmin_activities` (now renamed). Those failures are expected and are fixed in Task 5.

- [ ] **Step 6: Commit**

```bash
git add server/db/schema.sql server/db/migrate.ts
git commit -m "feat(db): rename garmin_activities → health_activities, add composite PK with source"
```

---

## Task 4: Update server SQL references

All SQL in `server/api/garmin.ts` and the `queryDb` tool description in `server/lib/ai/tools.ts` reference the old table names. Update them to match the new names.

**Files:**
- Modify: `server/api/garmin.ts`
- Modify: `server/lib/ai/tools.ts`

- [ ] **Step 1: Update server/api/garmin.ts — replace all table name references**

Find and replace all occurrences (use replace_all):

| Old | New |
|-----|-----|
| `garmin_snapshots` | `health_snapshots` |
| `garmin_activities` | `health_activities` |
| `garmin_activity_legs` | `health_activity_legs` |

Also update the `INSERT OR REPLACE INTO garmin_activities` in the sync endpoint and any `activity_id` integer casts — since `activity_id` is now TEXT, remove any `INTEGER` casts:

In the activities query (around line 67), `activity_id` is used as a path param — it's already a string in Express, so no change needed there.

For the legs query (around line 189):
```typescript
// was: WHERE activity_id = ?
// stays the same — SQLite will cast the TEXT param correctly
```

- [ ] **Step 2: Update server/lib/ai/tools.ts — rename tables in queryDb description**

In `server/lib/ai/tools.ts`, replace all three table name occurrences in the `queryDb` description string:

```typescript
// Line 14: change
garmin_snapshots(date TEXT, metric TEXT, value REAL, unit TEXT, source_json TEXT)
// to:
health_snapshots(date TEXT, metric TEXT, source TEXT, value REAL, unit TEXT, source_json TEXT)

// Line 15: change
garmin_activities(date TEXT, activity_id TEXT, type_key TEXT, ...)
// to:
health_activities(date TEXT, activity_id TEXT, source TEXT, type_key TEXT, ...)

// Lines 21-27: change all garmin_snapshots references to health_snapshots
// Example line 22:
SELECT date, value FROM health_snapshots WHERE metric = 'hrv' ORDER BY date DESC LIMIT 30
// Example line 27:
SELECT DISTINCT metric FROM health_snapshots ORDER BY metric
```

- [ ] **Step 3: Run type check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors

- [ ] **Step 4: Run server tests**

```bash
npm run test:server
```

Expected: no type errors. Note: `garmin.test.ts` failures are still expected at this point — test fixtures are updated in Task 5.

- [ ] **Step 5: Commit**

```bash
git add server/api/garmin.ts server/lib/ai/tools.ts
git commit -m "feat(db): update all server SQL references to health_snapshots/health_activities"
```

---

## Task 5: Update test files

Four test files seed data using the old table names. Update them all.

**Files:**
- Modify: `tests/server/garmin.test.ts`
- Modify: `tests/server/tools.test.ts`
- Modify: `tests/server/mx4chat.test.ts`

- [ ] **Step 1: Update tests/server/garmin.test.ts**

Replace all occurrences of `garmin_snapshots` with `health_snapshots` and `garmin_activities` with `health_activities` (use replace_all on each). The test logic is unchanged — only table names differ.

Key lines to update:
- Line 14: `INSERT INTO garmin_snapshots` → `INSERT INTO health_snapshots`
- Line 77: `INSERT OR REPLACE INTO garmin_activities` → `INSERT OR REPLACE INTO health_activities`
- Line 142, 159: `INSERT OR REPLACE INTO garmin_snapshots` → `INSERT OR REPLACE INTO health_snapshots`
- Line 175: `INSERT OR IGNORE INTO garmin_activities` → `INSERT OR IGNORE INTO health_activities`

For the activities INSERT, `activity_id` is now TEXT in the schema. The test seeds integer values like `12345678` — these work fine as TEXT in SQLite, but the INSERT statement column list needs to include `source`:

```typescript
// was:
`INSERT OR REPLACE INTO garmin_activities
 (activity_id, date, start_time, name, type_key, duration_s, avg_hr)
 VALUES (?, ?, ?, ?, ?, ?, ?)`

// becomes:
`INSERT OR REPLACE INTO health_activities
 (activity_id, source, date, start_time, name, type_key, duration_s, avg_hr)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
// and add 'garmin' as the second bind parameter
```

- [ ] **Step 2: Update tests/server/tools.test.ts**

Replace all `garmin_snapshots` occurrences with `health_snapshots`:
- Line 18: seed INSERT
- Lines 31, 38, 72–75, 81, 87, 90, 96, 102: SQL strings in queryDb test cases

The DROP TABLE test (line 38) checks that `queryDb` rejects DDL:
```typescript
// was: sql: 'DROP TABLE garmin_snapshots'
// becomes:
sql: 'DROP TABLE health_snapshots'
```

The multi-statement injection test (line 87):
```typescript
// was: sql: 'SELECT 1; DROP TABLE garmin_snapshots'
// becomes:
sql: 'SELECT 1; DROP TABLE health_snapshots'
```

The table existence check after the injection test (line 90):
```typescript
// was:
const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='garmin_snapshots'").get()
// becomes:
const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='health_snapshots'").get()
```

- [ ] **Step 3: Update tests/server/mx4chat.test.ts**

Two test cases reference table names in expected toolLabel output (lines 286, 291):

```typescript
// Line 286 — was:
expect(toolLabel('queryDb', { sql: "SELECT date, value FROM garmin_snapshots WHERE metric = 'hrv' ORDER BY date DESC LIMIT 30" }))
// becomes:
expect(toolLabel('queryDb', { sql: "SELECT date, value FROM health_snapshots WHERE metric = 'hrv' ORDER BY date DESC LIMIT 30" }))

// Line 291 — was:
expect(toolLabel('queryDb', { sql: 'SELECT * FROM garmin_activities' }))
// becomes:
expect(toolLabel('queryDb', { sql: 'SELECT * FROM health_activities' }))
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all 324 tests pass

- [ ] **Step 5: Commit**

```bash
git add tests/server/garmin.test.ts tests/server/tools.test.ts tests/server/mx4chat.test.ts
git commit -m "test: update all test fixtures to use health_snapshots/health_activities table names"
```

---

## Task 6: Create shared integration infrastructure

Create the canonical metric name registry and source resolution utility that Plans 2 and 3 will consume.

**Files:**
- Create: `server/lib/integrations/shared/metricMap.ts`
- Create: `server/lib/integrations/shared/sourceResolver.ts`
- Create: `tests/server/sourceResolver.test.ts`

**Interfaces:**
- Produces: `METRICS`, `METRIC_SOURCES`, `PROVIDER_LABELS` from `metricMap.ts`
- Produces: `resolveSource(rows, priority)` from `sourceResolver.ts`

- [ ] **Step 1: Write failing test for resolveSource**

Create `tests/server/sourceResolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveSource } from '../../server/lib/integrations/shared/sourceResolver'

describe('resolveSource', () => {
  const rows = [
    { source: 'garmin', value: 45 },
    { source: 'oura',   value: 48 },
    { source: 'polar',  value: 44 },
  ]

  it('returns the highest-priority source that has a row', () => {
    expect(resolveSource(rows, ['oura', 'garmin', 'polar'])).toEqual({ source: 'oura', value: 48 })
  })

  it('falls through to next priority if first is not present', () => {
    expect(resolveSource(rows, ['whoop', 'polar', 'garmin'])).toEqual({ source: 'polar', value: 44 })
  })

  it('falls back to first row if no priority matches', () => {
    expect(resolveSource(rows, ['withings', 'strava'])).toEqual({ source: 'garmin', value: 45 })
  })

  it('returns the only row when given a single-element array', () => {
    expect(resolveSource([{ source: 'garmin', value: 55 }], ['garmin'])).toEqual({ source: 'garmin', value: 55 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:server -- --reporter=verbose tests/server/sourceResolver.test.ts
```

Expected: FAIL — `resolveSource` not found

- [ ] **Step 3: Create server/lib/integrations/shared/sourceResolver.ts**

```typescript
interface SourceRow {
  source: string
  value: number
}

export function resolveSource(rows: SourceRow[], priority: string[]): SourceRow {
  for (const src of priority) {
    const match = rows.find(r => r.source === src)
    if (match) return match
  }
  return rows[0]
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:server -- --reporter=verbose tests/server/sourceResolver.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Create server/lib/integrations/shared/metricMap.ts**

```typescript
export const METRICS: Record<string, { unit: string; description: string }> = {
  hrv:                  { unit: 'ms',         description: 'HRV (RMSSD)' },
  resting_hr:           { unit: 'bpm',        description: 'Resting heart rate' },
  sleep_score:          { unit: 'score',      description: 'Sleep quality score (0–100)' },
  sleep_duration_s:     { unit: 's',          description: 'Total sleep duration' },
  deep_sleep_s:         { unit: 's',          description: 'Deep sleep duration' },
  rem_sleep_s:          { unit: 's',          description: 'REM sleep duration' },
  light_sleep_s:        { unit: 's',          description: 'Light sleep duration' },
  spo2:                 { unit: '%',          description: 'Blood oxygen saturation' },
  respiration:          { unit: 'brpm',       description: 'Breathing rate' },
  stress:               { unit: 'score',      description: 'Stress score' },
  steps:                { unit: 'count',      description: 'Daily steps' },
  vo2max:               { unit: 'ml/kg/min',  description: 'VO2 max estimate' },
  body_battery_charged: { unit: 'points',     description: 'Body battery charged' },
  readiness_score:      { unit: 'score',      description: 'Readiness score' },
  strain_score:         { unit: 'score',      description: 'Strain score' },
  weight_kg:            { unit: 'kg',         description: 'Body weight' },
  distance_m:           { unit: 'm',          description: 'Activity distance' },
}

export const METRIC_SOURCES: Record<string, Record<string, string>> = {
  garmin: {
    hrv:          'overnight RMSSD',
    resting_hr:   'sleep detection',
    sleep_score:  'accelerometer + HRV',
    spo2:         'optical sensor',
    stress:       'HRV-derived',
    respiration:  'optical sensor',
    steps:        'accelerometer',
    vo2max:       'VO2 Max algorithm',
  },
  oura: {
    hrv:            'infrared PPG',
    resting_hr:     'sleep detection',
    sleep_score:    'sleep algorithm',
    spo2:           'infrared + red LED',
    readiness_score:'readiness algorithm',
    respiration:    'optical sensor',
  },
  polar: {
    hrv:          'overnight RMSSD',
    resting_hr:   'sleep detection',
    sleep_score:  'sleep algorithm',
    vo2max:       'fitness test estimate',
  },
  whoop: {
    hrv:          'overnight RMSSD',
    resting_hr:   'sleep detection',
    strain_score: 'HR + exertion model',
    spo2:         'optical sensor',
  },
  withings: {
    resting_hr: 'optical HR',
    spo2:       'optical sensor',
    weight_kg:  'scale measurement',
  },
  strava: {
    distance_m: 'GPS',
    steps:      'GPS + accelerometer',
  },
  hevy: {},
}

export const PROVIDER_LABELS: Record<string, string> = {
  garmin:   'Garmin',
  oura:     'Oura Ring',
  polar:    'Polar',
  whoop:    'Whoop',
  withings: 'Withings',
  strava:   'Strava',
  hevy:     'Hevy',
}
```

- [ ] **Step 6: Run type check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add server/lib/integrations/shared/metricMap.ts \
        server/lib/integrations/shared/sourceResolver.ts \
        tests/server/sourceResolver.test.ts
git commit -m "feat(integrations): add metricMap and sourceResolver shared infrastructure"
```

---

## Task 7: Relocate Garmin scripts + create health_poller dispatcher

Move `scripts/garmin_poller.py` and `scripts/garmin_ingest.py` into `scripts/providers/garmin/` so all providers live under a consistent directory structure. Create a minimal dispatcher `scripts/health_poller.py` that will grow to call all active providers in Plans 2+.

**Files:**
- Create: `scripts/providers/garmin/poller.py` (moved from `scripts/garmin_poller.py`)
- Create: `scripts/providers/garmin/ingest.py` (moved from `scripts/garmin_ingest.py`)
- Create: `scripts/health_poller.py`
- Create: `scripts/install-health-poller.sh`
- Modify: `scripts/install-garmin-poller.sh` (update path reference in comments)

- [ ] **Step 1: Create the providers/garmin directory and copy files**

```bash
mkdir -p /opt/bacta/scripts/providers/garmin
cp /opt/bacta/scripts/garmin_poller.py /opt/bacta/scripts/providers/garmin/poller.py
cp /opt/bacta/scripts/garmin_ingest.py /opt/bacta/scripts/providers/garmin/ingest.py
```

- [ ] **Step 2: Verify the copies work**

```bash
python3 -c "import py_compile; py_compile.compile('/opt/bacta/scripts/providers/garmin/poller.py', doraise=True)" && echo "OK"
python3 -c "import py_compile; py_compile.compile('/opt/bacta/scripts/providers/garmin/ingest.py', doraise=True)" && echo "OK"
```

Expected: `OK` for each

- [ ] **Step 3: Create scripts/health_poller.py**

```python
#!/usr/bin/env python3
"""
health_poller.py — dispatcher for all active wearable providers.

Reads active providers from Bacta's app_settings table and calls
each provider's poller script. Garmin is always included if the
credentials file exists. OAuth-based providers (Polar, Oura, etc.)
are called when their {provider}_enabled setting is 'true'.

Usage: python3 scripts/health_poller.py
"""
import os
import subprocess
import sqlite3
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

DB_PATH = os.environ.get('BACTA_DB', '/opt/bacta/data/bacta.db')
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROVIDERS_DIR = os.path.join(SCRIPT_DIR, 'providers')


def get_setting(db: sqlite3.Connection, key: str) -> str | None:
    row = db.execute('SELECT value FROM app_settings WHERE key = ?', (key,)).fetchone()
    return row[0] if row else None


def run_provider(name: str, script: str) -> None:
    log.info(f'Running provider: {name}')
    result = subprocess.run(
        ['python3', script],
        env={**os.environ, 'BACTA_DB': DB_PATH},
        capture_output=False,
    )
    if result.returncode != 0:
        log.error(f'Provider {name} exited with code {result.returncode}')
    else:
        log.info(f'Provider {name} completed successfully')


def main() -> None:
    db = sqlite3.connect(DB_PATH)

    # Garmin: always run if credentials file exists (unchanged auth method)
    garmin_creds = os.path.expanduser('~/.garminconnect')
    if os.path.exists(garmin_creds):
        run_provider('garmin', os.path.join(PROVIDERS_DIR, 'garmin', 'poller.py'))
    else:
        log.warning('Garmin credentials not found — skipping garmin provider')

    # OAuth-based providers: run if {provider}_enabled == 'true' in app_settings
    oauth_providers = ['polar', 'oura', 'whoop', 'withings', 'strava', 'hevy']
    for provider in oauth_providers:
        enabled = get_setting(db, f'{provider}_enabled')
        if enabled == 'true':
            script = os.path.join(PROVIDERS_DIR, provider, 'poller.py')
            if os.path.exists(script):
                run_provider(provider, script)
            else:
                log.warning(f'Provider {provider} enabled but poller not found at {script}')

    db.close()
    log.info('health_poller complete')


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Verify dispatcher syntax**

```bash
python3 -c "import py_compile; py_compile.compile('/opt/bacta/scripts/health_poller.py', doraise=True)" && echo "OK"
```

Expected: `OK`

- [ ] **Step 5: Create scripts/install-health-poller.sh**

```bash
#!/usr/bin/env bash
# Install the unified health poller as a systemd service + timer.
# Replaces install-garmin-poller.sh. Run as: bash /opt/bacta/scripts/install-health-poller.sh
set -e

UNIT_DIR=/etc/systemd/system
SCRIPT=/opt/bacta/scripts/health_poller.py
DB_DIR=/opt/bacta/data
USER=wheat

mkdir -p "$DB_DIR"

printf '[Unit]\nDescription=Bacta nightly health data poller\nAfter=network.target\n\n[Service]\nType=oneshot\nUser=%s\nEnvironment=BACTA_DB=%s/bacta.db\nExecStart=/usr/bin/python3 %s\nStandardOutput=journal\nStandardError=journal\n' \
  "$USER" "$DB_DIR" "$SCRIPT" \
  | sudo tee "$UNIT_DIR/bacta-health.service" > /dev/null

printf '[Unit]\nDescription=Bacta nightly health data poller timer\n\n[Timer]\nOnCalendar=*-*-* 03:00:00\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n' \
  | sudo tee "$UNIT_DIR/bacta-health.timer" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now bacta-health.timer

echo "Installed bacta-health.timer. Status:"
sudo systemctl status bacta-health.timer --no-pager
```

- [ ] **Step 6: Update install-garmin-poller.sh with deprecation notice**

Add to the top of `scripts/install-garmin-poller.sh` (after the shebang):

```bash
# DEPRECATED: Garmin is now managed by install-health-poller.sh
# This script is kept for reference only. Use install-health-poller.sh instead.
echo "WARNING: This script is deprecated. Run install-health-poller.sh instead."
exit 1
```

- [ ] **Step 7: Stage, add new files, commit**

```bash
git add scripts/providers/garmin/poller.py \
        scripts/providers/garmin/ingest.py \
        scripts/health_poller.py \
        scripts/install-health-poller.sh \
        scripts/install-garmin-poller.sh
git commit -m "feat(scripts): relocate garmin scripts to providers/garmin/, add health_poller dispatcher"
```

---

## Task 8: Update documentation and run final verification

**Files:**
- Modify: `docs/DATA.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update docs/DATA.md**

In the schema section, update the table name, add the source column, and update the unique constraint description. Find the `garmin_snapshots` schema block and replace with:

```markdown
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

Update the `garmin_activities` and `garmin_activity_legs` references similarly. Update the "Garmin API & Data Conventions" section note to say queries should use `health_snapshots`.

- [ ] **Step 2: Update CLAUDE.md**

In the Data section, update:
```
- **~30 Garmin metrics:** stored in `health_snapshots` (was `garmin_snapshots`)
```

In the "Server & DB Gotchas" section, update the queryDb example:
```
- `SELECT DISTINCT metric FROM health_snapshots ORDER BY metric` for metric discovery
```

- [ ] **Step 3: Run the complete test suite**

```bash
npm test
```

Expected: all 324+ tests pass (new sourceResolver tests add to the count)

- [ ] **Step 4: Run both type checks**

```bash
npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors from either

- [ ] **Step 5: Final commit**

```bash
git add docs/DATA.md CLAUDE.md
git commit -m "docs: update DATA.md and CLAUDE.md for health_snapshots rename and multi-device architecture"
```

- [ ] **Step 6: Push feature branch**

```bash
git push -u origin feature/multi-device
```

Expected: branch pushed, CI triggers

---

## Operator Step (after CI passes): Update systemd timer

This requires SSH access to LXC 109 and cannot be done from the repo. Run after CI is green:

```bash
# On LXC 109:
bash /opt/bacta/scripts/install-health-poller.sh

# Disable and remove old garmin timer if present:
sudo systemctl disable --now bacta-garmin.timer 2>/dev/null || true
sudo rm -f /etc/systemd/system/bacta-garmin.service \
           /etc/systemd/system/bacta-garmin.timer
sudo systemctl daemon-reload
```

The old `scripts/garmin_poller.py` and `scripts/garmin_ingest.py` can be removed from `scripts/` once the new paths are confirmed working in production. They are preserved in `scripts/providers/garmin/` with identical content.
