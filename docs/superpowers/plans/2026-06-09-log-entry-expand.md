# Activity Log Expand Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement expandable dropdown cards for each activity log entry in the Training page, showing Training Effect (aerobic/anaerobic bars), per-activity HR zones, and run dynamics — matching the design exactly from `design_bacta-handoff-package/bacta-v3-viz.jsx` `LogEntryV3`.

**Architecture:** Add 12 columns to `garmin_activities` via schema + ALTER TABLE migration; update `sync_range` in `garmin_poller.py` to fetch training effect + recovery time from the existing activity list response, per-activity HR zones via `get_activity_hr_in_timezones()`, and run dynamics via `get_activity_details()` for runs only; update the `/api/garmin/activities` endpoint SELECT; add three sub-components inside `LogEntry.tsx` that render when data is present.

**Tech Stack:** SQLite (better-sqlite3), Express/TypeScript, React 19 + TypeScript, Vitest + Testing Library, garminconnect Python library

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/db/schema.sql` | Modify | Add 12 new columns to `CREATE TABLE garmin_activities` (for fresh DBs) |
| `server/db/migrate.ts` | Modify | Add `ALTER TABLE ADD COLUMN` calls (wrapped in try/catch) for existing prod DB |
| `scripts/garmin_poller.py` | Modify | Extend `sync_range` activities block to fetch + store new fields |
| `server/api/garmin.ts` | Modify | Update SELECT in `/activities` to return all new columns |
| `client/src/lib/garminApi.ts` | Modify | Add 12 new optional fields to `GarminActivity` interface |
| `client/src/components/viz/LogEntry.tsx` | Modify | Add `TrainingEffectBars`, `ActivityZoneBar`, `RunDynamicsGrid` sub-components; wire expand panel; update `hasContent` |
| `tests/server/garmin.test.ts` | Modify | Add test: activities endpoint returns new fields when seeded |
| `tests/client/components/viz/LogEntry.test.tsx` | Modify | Add tests: expand panel shows correct sections with data; hides sections without data |

---

## Task 1: DB Schema — Add New Columns

**Files:**
- Modify: `server/db/schema.sql`
- Modify: `server/db/migrate.ts`

- [ ] **Step 1: Update `schema.sql` `CREATE TABLE garmin_activities`**

Replace the existing `garmin_activities` CREATE TABLE block with one that includes the new columns (this only affects fresh DB creation — the ALTER TABLE in migrate.ts handles existing prod DB):

```sql
CREATE TABLE IF NOT EXISTS garmin_activities (
  activity_id      INTEGER PRIMARY KEY,
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
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_garmin_activities_date ON garmin_activities(date);
```

- [ ] **Step 2: Update `migrate.ts` to ALTER TABLE for existing prod DB**

Replace the contents of `server/db/migrate.ts` with:

```typescript
import db from './client'
import fs from 'fs'
import path from 'path'

const NEW_ACTIVITY_COLS = [
  'aerobic_te REAL',
  'anaerobic_te REAL',
  'recovery_time_h REAL',
  'zone1_s INTEGER',
  'zone2_s INTEGER',
  'zone3_s INTEGER',
  'zone4_s INTEGER',
  'zone5_s INTEGER',
  'run_cadence INTEGER',
  'run_stride_cm REAL',
  'run_vert_osc_cm REAL',
  'run_gct_ms INTEGER',
]

export function migrate() {
  const schema = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf-8'
  )
  db.exec(schema)

  // Add new columns to existing prod DB — SQLite doesn't support ADD COLUMN IF NOT EXISTS
  for (const col of NEW_ACTIVITY_COLS) {
    try {
      db.exec(`ALTER TABLE garmin_activities ADD COLUMN ${col}`)
    } catch {
      // Column already exists — safe to ignore
    }
  }

  console.log('[db] migrations complete')
}
```

- [ ] **Step 3: Run migration against prod DB to verify it applies without error**

```bash
node -e "require('./server/db/migrate').migrate()" 2>&1 || \
python3 -c "
import sqlite3
db = sqlite3.connect('/opt/bacta/data/bacta.db')
rows = db.execute('PRAGMA table_info(garmin_activities)').fetchall()
for r in rows: print(r)
"
```

Expected: All 23 columns present (activity_id through created_at) with no errors.

- [ ] **Step 4: Run all tests to confirm nothing is broken**

```bash
cd /opt/bacta && npm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta
git add server/db/schema.sql server/db/migrate.ts
git commit -m "feat: add training effect, HR zones, run dynamics columns to garmin_activities"
```

---

## Task 2: Server — Update Activities Endpoint

**Files:**
- Modify: `server/api/garmin.ts`

- [ ] **Step 1: Write a failing test for the new fields**

In `tests/server/garmin.test.ts`, add a new `describe` block after the existing `Phase B endpoints` block:

```typescript
describe('Activities endpoint — expand fields', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { default: db } = await import('../../server/db/client')
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT OR REPLACE INTO garmin_activities
       (activity_id, date, start_time, name, type_key, duration_s, avg_hr,
        aerobic_te, anaerobic_te, recovery_time_h,
        zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
        run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      9999, today, `${today} 07:00:00`, 'Test Run', 'running',
      3600, 148,
      3.8, 1.2, 24,
      120, 900, 600, 120, 60,
      172, 115.5, 8.4, 245
    )
  })

  it('GET /api/garmin/activities returns new expand fields', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/activities').query({ days: 7 })
    expect(res.status).toBe(200)
    const acts = res.body.activities as any[]
    const testAct = acts.find((a: any) => a.activity_id === 9999)
    expect(testAct).toBeDefined()
    expect(testAct.aerobic_te).toBe(3.8)
    expect(testAct.anaerobic_te).toBe(1.2)
    expect(testAct.recovery_time_h).toBe(24)
    expect(testAct.zone1_s).toBe(120)
    expect(testAct.zone2_s).toBe(900)
    expect(testAct.run_cadence).toBe(172)
    expect(testAct.run_stride_cm).toBe(115.5)
    expect(testAct.run_vert_osc_cm).toBe(8.4)
    expect(testAct.run_gct_ms).toBe(245)
  })
})
```

- [ ] **Step 2: Run the new test to confirm it fails**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose 2>&1 | grep -A5 "expand fields"
```

Expected: FAIL — the endpoint doesn't return new fields yet.

- [ ] **Step 3: Update the SELECT in `/api/garmin/activities`**

In `server/api/garmin.ts`, replace the activities SELECT:

```typescript
garminRouter.get('/activities', (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 30)
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const rows = db.prepare(
    `SELECT activity_id, date, start_time, name, type_key,
            distance_m, duration_s, calories, avg_hr, elevation_m,
            aerobic_te, anaerobic_te, recovery_time_h,
            zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
            run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms
     FROM garmin_activities WHERE date >= ? ORDER BY start_time DESC`
  ).all(since)
  res.json({ activities: rows })
})
```

- [ ] **Step 4: Run all server tests to confirm the new test passes**

```bash
cd /opt/bacta && npm run test:server
```

Expected: All pass including `Activities endpoint — expand fields`.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta
git add server/api/garmin.ts tests/server/garmin.test.ts
git commit -m "feat: activities endpoint returns training effect, zones, run dynamics fields"
```

---

## Task 3: Garmin Poller — Fetch New Fields

**Files:**
- Modify: `scripts/garmin_poller.py`

- [ ] **Step 1: Update the activities insert in `sync_range` to fetch and store new fields**

In `garmin_poller.py`, find the `# Activities` block inside `sync_range` (around line 312) and replace the entire `try` block with:

```python
    # Activities — includes training effect, HR zones, run dynamics
    try:
        acts = c.get_activities_by_date(start, end)
        for act in (acts or []):
            d = (safe(act, 'startTimeLocal') or '')[:10]
            if not d:
                continue
            act_id = safe(act, 'activityId')
            type_key = safe(act, 'activityType', 'typeKey') or 'other'
            is_run = type_key in ('running', 'trail_running', 'treadmill_running')

            # Training effect + recovery time — available in activity list response
            aerobic_te    = safe(act, 'aerobicTrainingEffect')
            anaerobic_te  = safe(act, 'anaerobicTrainingEffect')
            recovery_time_h = safe(act, 'recoveryTime')  # Garmin returns hours

            # Per-activity HR zones (skip multi_sport containers — they return empty)
            zone1_s = zone2_s = zone3_s = zone4_s = zone5_s = None
            if type_key != 'multi_sport' and act_id:
                try:
                    for z in (c.get_activity_hr_in_timezones(act_id) or []):
                        n = z.get('zoneNumber')
                        secs = int(z.get('secsInZone') or 0)
                        if   n == 1: zone1_s = secs
                        elif n == 2: zone2_s = secs
                        elif n == 3: zone3_s = secs
                        elif n == 4: zone4_s = secs
                        elif n == 5: zone5_s = secs
                    time.sleep(SLEEP_BETWEEN)
                except Exception:
                    pass

            # Run dynamics — requires get_activity_details(), run-type only
            run_cadence = run_stride_cm = run_vert_osc_cm = run_gct_ms = None
            if is_run and act_id:
                try:
                    details = c.get_activity_details(act_id) or {}
                    dto = details.get('summaryDTO') or {}
                    cadence = dto.get('averageRunningCadenceInStepsPerMinute')
                    stride_m = dto.get('avgStrideLength')
                    vert_mm  = dto.get('avgVerticalOscillation')
                    gct_ms   = dto.get('avgGroundContactTime')
                    run_cadence      = round(cadence) if cadence is not None else None
                    run_stride_cm    = round(stride_m * 100, 1) if stride_m is not None else None
                    run_vert_osc_cm  = round(vert_mm / 10, 1) if vert_mm is not None else None
                    run_gct_ms       = round(gct_ms) if gct_ms is not None else None
                    time.sleep(SLEEP_BETWEEN)
                except Exception:
                    pass

            db.execute(
                'INSERT OR REPLACE INTO garmin_activities '
                '(activity_id, date, start_time, name, type_key, distance_m, duration_s, '
                'calories, avg_hr, elevation_m, aerobic_te, anaerobic_te, recovery_time_h, '
                'zone1_s, zone2_s, zone3_s, zone4_s, zone5_s, '
                'run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms) '
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (act_id, d,
                 safe(act, 'startTimeLocal'), safe(act, 'activityName'),
                 type_key,
                 safe(act, 'distance'), safe(act, 'duration'),
                 safe(act, 'calories'), safe(act, 'averageHR'), safe(act, 'elevationGain'),
                 aerobic_te, anaerobic_te, recovery_time_h,
                 zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
                 run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms)
            )
        db.commit()
        print(f'  activities: {len(acts or [])} rows')
    except Exception as e:
        print(f'  activities error: {e}')
```

- [ ] **Step 2: Validate Python syntax**

```bash
python3 -c "import py_compile; py_compile.compile('scripts/garmin_poller.py', doraise=True)" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /opt/bacta
git add scripts/garmin_poller.py
git commit -m "feat: poller fetches training effect, per-activity HR zones, run dynamics"
```

---

## Task 4: Frontend — GarminActivity Interface

**Files:**
- Modify: `client/src/lib/garminApi.ts`

- [ ] **Step 1: Add new fields to `GarminActivity` interface**

In `client/src/lib/garminApi.ts`, replace the existing `GarminActivity` interface:

```typescript
export interface GarminActivity {
  activity_id: number
  date: string
  start_time: string
  name: string
  type_key: string
  distance_m: number | null
  duration_s: number | null
  calories: number | null
  avg_hr: number | null
  elevation_m: number | null
  // Expand panel data — null means not yet fetched / not applicable
  aerobic_te: number | null
  anaerobic_te: number | null
  recovery_time_h: number | null
  zone1_s: number | null
  zone2_s: number | null
  zone3_s: number | null
  zone4_s: number | null
  zone5_s: number | null
  run_cadence: number | null
  run_stride_cm: number | null
  run_vert_osc_cm: number | null
  run_gct_ms: number | null
}
```

- [ ] **Step 2: Run TypeScript check to confirm no type errors**

```bash
cd /opt/bacta && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
cd /opt/bacta && npm test
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
cd /opt/bacta
git add client/src/lib/garminApi.ts
git commit -m "feat: extend GarminActivity interface with expand panel fields"
```

---

## Task 5: Frontend — LogEntry Expand Panel

**Files:**
- Modify: `client/src/components/viz/LogEntry.tsx`
- Modify: `tests/client/components/viz/LogEntry.test.tsx`

This task uses TDD. Write all failing tests first, then implement.

- [ ] **Step 1: Write failing tests for the expand panel**

Replace `tests/client/components/viz/LogEntry.test.tsx` entirely with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogEntry } from '../../../../client/src/components/viz/LogEntry'
import type { GarminActivity } from '../../../../client/src/lib/garminApi'

const BASE_ACTIVITY: GarminActivity = {
  activity_id: 1,
  date: '2026-06-05',
  start_time: '2026-06-05 07:30:00',
  name: 'Morning Run',
  type_key: 'running',
  distance_m: 7900,
  duration_s: 3540,
  calories: 627,
  avg_hr: 148,
  elevation_m: null,
  aerobic_te: null,
  anaerobic_te: null,
  recovery_time_h: null,
  zone1_s: null,
  zone2_s: null,
  zone3_s: null,
  zone4_s: null,
  zone5_s: null,
  run_cadence: null,
  run_stride_cm: null,
  run_vert_osc_cm: null,
  run_gct_ms: null,
}

const WITH_TRAINING_EFFECT: GarminActivity = {
  ...BASE_ACTIVITY,
  aerobic_te: 3.8,
  anaerobic_te: 1.2,
  recovery_time_h: 24,
}

const WITH_ZONES: GarminActivity = {
  ...BASE_ACTIVITY,
  zone1_s: 120,
  zone2_s: 900,
  zone3_s: 600,
  zone4_s: 120,
  zone5_s: 60,
}

const WITH_RUN_DYNAMICS: GarminActivity = {
  ...BASE_ACTIVITY,
  run_cadence: 172,
  run_stride_cm: 115.5,
  run_vert_osc_cm: 8.4,
  run_gct_ms: 245,
}

const FULL_RUN: GarminActivity = {
  ...BASE_ACTIVITY,
  ...WITH_TRAINING_EFFECT,
  ...WITH_ZONES,
  ...WITH_RUN_DYNAMICS,
}

describe('LogEntry — header', () => {
  it('renders activity label and stats', () => {
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.getByText(/7\.9 km/)).toBeInTheDocument()
  })

  it('renders the chevron character', () => {
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('›')).toBeInTheDocument()
  })

  it('chevron has no rotation by default', () => {
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('›')).toHaveStyle({ transform: 'none' })
  })

  it('chevron rotates 90deg when clicked', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('›')).toHaveStyle({ transform: 'rotate(90deg)' })
  })

  it('chevron returns to none on second click', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('›')).toHaveStyle({ transform: 'none' })
  })

  it('shows benefit tag when aerobic_te >= 3', () => {
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    expect(screen.getByText('IMPROVING')).toBeInTheDocument()
  })

  it('shows HIGHLY IMPROVING when aerobic_te >= 4', () => {
    const a = { ...WITH_TRAINING_EFFECT, aerobic_te: 4.2 }
    render(<LogEntry activity={a} accent="#fb923c" />)
    expect(screen.getByText('HIGHLY IMPROVING')).toBeInTheDocument()
  })

  it('does not show benefit tag when aerobic_te is null', () => {
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    expect(screen.queryByText('IMPROVING')).not.toBeInTheDocument()
    expect(screen.queryByText('HIGHLY IMPROVING')).not.toBeInTheDocument()
  })
})

describe('LogEntry — no expand panel without data', () => {
  it('does not show expand panel when all fields are null', async () => {
    const user = userEvent.setup()
    const { container } = render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    const panels = container.querySelectorAll('[style*="border-top"]')
    expect(panels).toHaveLength(0)
  })
})

describe('LogEntry — Training Effect section', () => {
  it('shows TRAINING EFFECT header after expand', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('TRAINING EFFECT')).toBeInTheDocument()
  })

  it('shows aerobic and anaerobic labels', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('AEROBIC')).toBeInTheDocument()
    expect(screen.getByText('ANAEROBIC')).toBeInTheDocument()
  })

  it('shows aerobic_te value as X.X/5', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('3.8')).toBeInTheDocument()
  })

  it('shows REC TIME badge when recovery_time_h is present', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('REC TIME 24H')).toBeInTheDocument()
  })

  it('does not show training effect section when aerobic_te is null', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_ZONES} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByText('TRAINING EFFECT')).not.toBeInTheDocument()
  })
})

describe('LogEntry — HR Zones section', () => {
  it('shows HR ZONES header after expand with zone data', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_ZONES} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('HR ZONES')).toBeInTheDocument()
  })

  it('shows zone labels in legend', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_ZONES} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText(/Z2/)).toBeInTheDocument()
  })

  it('does not show HR ZONES section when all zones are null', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByText('HR ZONES')).not.toBeInTheDocument()
  })
})

describe('LogEntry — Run Dynamics section', () => {
  it('shows RUNNING DYNAMICS header for run with dynamics data', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_RUN_DYNAMICS} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('RUNNING DYNAMICS')).toBeInTheDocument()
  })

  it('shows all 4 dynamic stat labels', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_RUN_DYNAMICS} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('CADENCE')).toBeInTheDocument()
    expect(screen.getByText('STRIDE')).toBeInTheDocument()
    expect(screen.getByText('VERT OSC')).toBeInTheDocument()
    expect(screen.getByText('GCT')).toBeInTheDocument()
  })

  it('shows cadence value', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_RUN_DYNAMICS} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('172')).toBeInTheDocument()
  })

  it('does not show RUNNING DYNAMICS for non-run activity', async () => {
    const user = userEvent.setup()
    const walkAct = { ...WITH_RUN_DYNAMICS, type_key: 'walking' }
    render(<LogEntry activity={walkAct} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByText('RUNNING DYNAMICS')).not.toBeInTheDocument()
  })

  it('does not show RUNNING DYNAMICS for run with null dynamics', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByText('RUNNING DYNAMICS')).not.toBeInTheDocument()
  })
})

describe('LogEntry — full expand with all sections', () => {
  it('shows all three section headers for a full run', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={FULL_RUN} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('TRAINING EFFECT')).toBeInTheDocument()
    expect(screen.getByText('HR ZONES')).toBeInTheDocument()
    expect(screen.getByText('RUNNING DYNAMICS')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|✓|×" | head -40
```

Expected: Many FAIL — component doesn't have the expand content yet.

- [ ] **Step 3: Implement the expand panel in `LogEntry.tsx`**

Replace `client/src/components/viz/LogEntry.tsx` entirely with:

```tsx
import { useState } from 'react'
import { COLORS, FONT_MONO, FONT_UI } from '../../theme'
import { hexA } from '../../lib/hexA'
import type { GarminActivity } from '../../lib/garminApi'

type Sigil = 'run' | 'strength' | 'walk' | 'cycle'

const TYPE_SIGIL: Record<string, Sigil> = {
  running: 'run', trail_running: 'run', treadmill_running: 'run',
  walking: 'walk', hiking: 'walk', indoor_walking: 'walk',
  cycling: 'cycle', road_biking: 'cycle', mountain_biking: 'cycle', indoor_cycling: 'cycle',
  strength_training: 'strength', indoor_weightlifting: 'strength', gym_and_fitness_equipment: 'strength',
}

const TYPE_LABEL: Record<string, string> = {
  running: 'Run', trail_running: 'Trail Run', treadmill_running: 'Treadmill',
  walking: 'Walk', hiking: 'Hike', indoor_walking: 'Walk',
  cycling: 'Ride', road_biking: 'Ride', mountain_biking: 'MTB', indoor_cycling: 'Cycling',
  strength_training: 'Strength', indoor_weightlifting: 'Weights', gym_and_fitness_equipment: 'Gym',
}

const SIGIL_COLOR: Record<Sigil, string | null> = {
  run: null,      // uses accent
  strength: '#fb923c',
  walk: '#4ade80',
  cycle: '#fbbf24',
}

const RUN_TYPES = new Set(['running', 'trail_running', 'treadmill_running'])

function fmtDist(m: number | null): string | null {
  if (!m || m < 100) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function fmtDur(s: number | null): string | null {
  if (!s) return null
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

function fmtWhen(startTime: string): string {
  const [datePart, timePart] = startTime.split(' ')
  const [year, month, dom] = datePart.split('-').map(Number)
  const [hour, minute] = (timePart ?? '00:00:00').split(':').map(Number)
  const d = new Date(year, month - 1, dom, hour, minute)
  const today = new Date()
  const toKey  = (y: number, m: number, day: number) => y * 10000 + m * 100 + day
  const actKey  = toKey(year, month, dom)
  const todKey  = toKey(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const yest    = new Date(today); yest.setDate(today.getDate() - 1)
  const yestKey = toKey(yest.getFullYear(), yest.getMonth() + 1, yest.getDate())
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (actKey === todKey)  return `TODAY · ${time}`
  if (actKey === yestKey) return `YESTERDAY · ${time}`
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  return `${dayName} · ${time}`
}

function aerobicBenefit(te: number | null): string | null {
  if (te == null) return null
  if (te >= 4)   return 'HIGHLY IMPROVING'
  if (te >= 3)   return 'IMPROVING'
  if (te >= 2)   return 'MAINTAINING'
  return null
}

function ActivityGlyph({ sigil, color, size = 16 }: { sigil: Sigil; color: string; size?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {sigil === 'run' && (
        <g {...p}>
          <circle cx="15.5" cy="5" r="1.8" />
          <path d="M14 9.5 L10 12 L12.5 14.5 L11 20" />
          <path d="M14 9.5 L17.5 11.5 L20 10" />
          <path d="M12.5 14.5 L16 16 L18 21" />
          <path d="M10 12 L6 11.5" />
        </g>
      )}
      {sigil === 'walk' && (
        <g {...p}>
          <circle cx="12" cy="5" r="1.8" />
          <path d="M12 7.5 L10 13 L7 16" />
          <path d="M12 7.5 L14 11 L17 10" />
          <path d="M10 13 L9 19" />
          <path d="M10 13 L13 16 L14 20" />
        </g>
      )}
      {sigil === 'cycle' && (
        <g {...p}>
          <circle cx="6" cy="16" r="3.5" />
          <circle cx="18" cy="16" r="3.5" />
          <path d="M6 16 L12 7 L18 16" />
          <path d="M12 7 L14 4" />
          <circle cx="14" cy="3.5" r="1" fill={color} stroke="none" />
        </g>
      )}
      {sigil === 'strength' && (
        <g {...p}>
          <line x1="4" y1="9" x2="4" y2="15" />
          <line x1="20" y1="9" x2="20" y2="15" />
          <line x1="7" y1="7" x2="7" y2="17" />
          <line x1="17" y1="7" x2="17" y2="17" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </g>
      )}
    </svg>
  )
}

// ── Training Effect Bars ──────────────────────────────────────────────────────
function TrainingEffectBars({ aerobic, anaerobic, accent }: { aerobic: number; anaerobic: number; accent: string }) {
  const teLabel = (v: number) =>
    v >= 4 ? 'Highly Improving'
    : v >= 3 ? 'Improving'
    : v >= 2 ? 'Maintaining'
    : 'Minor Effect'

  const Bar = ({ val, label, color, sublabel }: { val: number; label: string; color: string; sublabel: string }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: '0.08em', color: COLORS.textMuted }}>{label}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 700, color }}>
          {val.toFixed(1)}<span style={{ color: COLORS.textMuted, fontWeight: 400 }}>/5</span>
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: hexA(COLORS.textMuted, 0.1), overflow: 'hidden' }}>
        <div style={{ width: `${(val / 5) * 100}%`, height: '100%', borderRadius: 4,
          background: `linear-gradient(90deg, ${hexA(color, 0.45)}, ${color})` }} />
      </div>
      <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: hexA(color, 0.75), display: 'block', marginTop: 2 }}>
        {sublabel}
      </span>
    </div>
  )

  return (
    <div>
      <Bar val={aerobic}   label="AEROBIC"   color={accent}       sublabel={teLabel(aerobic)} />
      <Bar val={anaerobic} label="ANAEROBIC" color={COLORS.mx4Red} sublabel={teLabel(anaerobic)} />
    </div>
  )
}

// ── Activity Zone Bar ─────────────────────────────────────────────────────────
const ZONE_COLORS = ['#56657a', '#4ade80', '#fbbf24', '#f87171', '#ef4444']

function ActivityZoneBar({ zoneSecs }: { zoneSecs: [number, number, number, number, number] }) {
  const total = zoneSecs.reduce((s, v) => s + v, 0)
  if (total === 0) return null
  const zones = zoneSecs.map((s, i) => ({
    zone: i + 1,
    pct: Math.round((s / total) * 100),
    color: ZONE_COLORS[i],
  })).filter(z => z.pct > 0)

  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', gap: 1.5, marginBottom: 5 }}>
        {zones.map(z => (
          <div key={z.zone} style={{ width: `${z.pct}%`, background: z.color,
            borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {z.pct >= 18 && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 6.5, fontWeight: 700, color: '#0b0d12' }}>
                {z.pct}%
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
        {zones.map(z => (
          <span key={z.zone} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: 1, background: z.color, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textSecondary }}>
              Z{z.zone} {z.pct}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Run Dynamics Grid ─────────────────────────────────────────────────────────
interface RunDynamics { cadence: number; strideCm: number; vertOscCm: number; gctMs: number }

function RunDynamicsGrid({ dyn, accent }: { dyn: RunDynamics; accent: string }) {
  const stats = [
    { label: 'CADENCE',  val: dyn.cadence,  unit: 'spm', ideal: '170–185' },
    { label: 'STRIDE',   val: dyn.strideCm, unit: 'cm',  ideal: '100–130' },
    { label: 'VERT OSC', val: dyn.vertOscCm, unit: 'cm', ideal: '6–10' },
    { label: 'GCT',      val: dyn.gctMs,    unit: 'ms',  ideal: '<250' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: hexA(accent, 0.05),
          border: `1px solid ${hexA(accent, 0.18)}`, borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: '0.1em',
            color: COLORS.textMuted, marginBottom: 2 }}>{s.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700,
              color: accent, lineHeight: 1 }}>{s.val}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{s.unit}</span>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7, color: hexA(COLORS.textMuted, 0.7),
            marginTop: 1 }}>ideal {s.ideal}</div>
        </div>
      ))}
    </div>
  )
}

// ── LogEntry ──────────────────────────────────────────────────────────────────
interface LogEntryProps {
  activity: GarminActivity
  accent: string
}

export function LogEntry({ activity: a, accent }: LogEntryProps) {
  const [open, setOpen] = useState(false)
  const sigil = TYPE_SIGIL[a.type_key] ?? 'run'
  const label = TYPE_LABEL[a.type_key] ?? a.name
  const sigilColor = SIGIL_COLOR[sigil] ?? accent
  const isRun = RUN_TYPES.has(a.type_key)

  const stats = [
    fmtDist(a.distance_m),
    fmtDur(a.duration_s),
    a.calories != null ? `${a.calories} kcal` : null,
    a.avg_hr != null ? `${a.avg_hr} bpm` : null,
  ].filter(Boolean)

  const benefit = aerobicBenefit(a.aerobic_te)

  const hasZones = (a.zone1_s ?? 0) + (a.zone2_s ?? 0) + (a.zone3_s ?? 0) + (a.zone4_s ?? 0) + (a.zone5_s ?? 0) > 0
  const hasTrainingEffect = a.aerobic_te != null
  const hasRunDynamics = isRun && a.run_cadence != null
  const hasContent = hasTrainingEffect || hasZones || hasRunDynamics

  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${open ? hexA(accent, 0.4) : COLORS.line}`,
      borderRadius: 8, overflow: 'hidden',
      transition: 'border-color 0.18s ease',
    }}>
      <button
        onClick={() => hasContent && setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 11,
          padding: '10px 12px', background: 'transparent', border: 'none',
          cursor: hasContent ? 'pointer' : 'default',
          textAlign: 'left', font: 'inherit', color: 'inherit',
        }}
      >
        <span style={{
          fontFamily: FONT_MONO, fontSize: 13, color: hasContent ? accent : COLORS.textMuted,
          marginRight: -4, flexShrink: 0,
          display: 'block', lineHeight: 1,
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.18s ease',
        }}>›</span>
        <span style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hexA(sigilColor, 0.13), border: `1px solid ${hexA(sigilColor, 0.3)}`,
        }}>
          <ActivityGlyph sigil={sigil} color={sigilColor} size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 650, color: COLORS.text }}>
            {label}
          </span>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textSecondary,
            marginTop: 3, letterSpacing: '0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {stats.join('  ·  ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted,
            display: 'block', letterSpacing: '0.04em',
          }}>
            {fmtWhen(a.start_time)}
          </span>
          {benefit && (
            <span style={{
              fontFamily: FONT_MONO, fontSize: 7.5, fontWeight: 700,
              color: accent, display: 'block', marginTop: 2,
            }}>{benefit}</span>
          )}
        </div>
      </button>

      {open && hasContent && (
        <div style={{
          borderTop: `1px solid ${hexA(accent, 0.2)}`,
          padding: '12px 13px 13px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {hasTrainingEffect && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 8.5,
                  letterSpacing: '0.1em', color: COLORS.textSecondary, fontWeight: 600 }}>
                  TRAINING EFFECT
                </span>
                {a.recovery_time_h != null && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 4,
                    background: hexA(COLORS.mx4Amber, 0.1),
                    border: `1px solid ${hexA(COLORS.mx4Amber, 0.32)}` }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.mx4Amber }}>
                      REC TIME {a.recovery_time_h}H
                    </span>
                  </div>
                )}
              </div>
              <TrainingEffectBars
                aerobic={a.aerobic_te!}
                anaerobic={a.anaerobic_te ?? 0}
                accent={accent}
              />
            </div>
          )}

          {hasZones && (
            <div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em',
                color: COLORS.textSecondary, fontWeight: 600, display: 'block', marginBottom: 7 }}>
                HR ZONES
              </span>
              <ActivityZoneBar zoneSecs={[
                a.zone1_s ?? 0,
                a.zone2_s ?? 0,
                a.zone3_s ?? 0,
                a.zone4_s ?? 0,
                a.zone5_s ?? 0,
              ]} />
            </div>
          )}

          {hasRunDynamics && (
            <div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em',
                color: COLORS.textSecondary, fontWeight: 600, display: 'block', marginBottom: 7 }}>
                RUNNING DYNAMICS
              </span>
              <RunDynamicsGrid
                dyn={{
                  cadence:    a.run_cadence!,
                  strideCm:   a.run_stride_cm ?? 0,
                  vertOscCm:  a.run_vert_osc_cm ?? 0,
                  gctMs:      a.run_gct_ms ?? 0,
                }}
                accent={accent}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run client tests and confirm they pass**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|✓|×" | head -60
```

Expected: All LogEntry tests pass.

- [ ] **Step 5: Run TypeScript check**

```bash
cd /opt/bacta && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta
git add client/src/components/viz/LogEntry.tsx tests/client/components/viz/LogEntry.test.tsx
git commit -m "feat: LogEntry expand panel — training effect, HR zones, run dynamics"
```

---

## Task 6: Visual Verification with Playwright

**Files:** None (browser verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd /opt/bacta && npm run dev:client &
sleep 3
```

- [ ] **Step 2: Take a screenshot of the Training page (overview tab)**

Use the Playwright MCP browser tools to:
1. Navigate to `http://localhost:5173`
2. Click on Training in the nav
3. Take a screenshot of the activity log section
4. Scroll down to the activity log entries if needed

- [ ] **Step 3: Expand an activity entry and screenshot**

Click on the first activity log entry to expand it. Take a screenshot. Confirm:
- Expand panel is visible
- If the entry has training effect data: TRAINING EFFECT header, aerobic/anaerobic bars, REC TIME badge
- If the entry has zone data: HR ZONES header, stacked bar, legend
- If the entry is a run with dynamics: RUNNING DYNAMICS header, 2×2 grid

- [ ] **Step 4: Compare against design reference**

Reference: `design_bacta-handoff-package/bacta-v3-viz.jsx` `LogEntryV3` component (lines 438–525)
Reference: `design_bacta-handoff-package/bacta-v3-training.jsx` (lines 235–238 — "ACTIVITY LOG" rail and entries)

Note: Activities in the DB currently have NULL for all new fields (they will populate after the next poller run). If all fields are NULL, the chevron shows dim/grey and no panel opens. That is correct behavior.

- [ ] **Step 5: If expand content is empty (pre-poller), manually test with seeded data**

To force-test the expand UI before the poller runs, temporarily insert a test activity in the dev DB:

```bash
python3 -c "
import sqlite3
db = sqlite3.connect('/opt/bacta/data/bacta.db')
db.execute('''
  INSERT OR REPLACE INTO garmin_activities
  (activity_id, date, start_time, name, type_key, distance_m, duration_s, calories, avg_hr,
   aerobic_te, anaerobic_te, recovery_time_h, zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
   run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms)
  VALUES (99999, date('now'), datetime('now', '-2 hours'), 'Test Run', 'running',
          8200, 3720, 645, 151,
          3.8, 1.2, 24, 180, 960, 540, 120, 60,
          174, 116.2, 8.1, 242)
''')
db.commit()
print('Test activity inserted')
"
```

Refresh the Training page and expand the test activity entry.

- [ ] **Step 6: Kill dev server and clean up test activity**

```bash
kill %1 2>/dev/null || true
python3 -c "
import sqlite3
db = sqlite3.connect('/opt/bacta/data/bacta.db')
db.execute('DELETE FROM garmin_activities WHERE activity_id = 99999')
db.commit()
print('Test activity removed')
"
```

---

## Task 7: Full Test Suite + Final Commit

- [ ] **Step 1: Run all tests**

```bash
cd /opt/bacta && npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run TypeScript checks for both client and server**

```bash
cd /opt/bacta && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /opt/bacta
git add -A
git commit -m "chore: verify all tests pass for activity log expand panel"
```

---

## Notes

- **Data availability**: The new DB columns will be NULL for all historical activities. After the next nightly poller run (`bacta-garmin.timer`), the past 7 days of activities will have full data. To trigger a manual sync: `POST /api/garmin/sync` from the app's sync button, or `cd /opt/bacta && python3 scripts/garmin_poller.py`.
- **multi_sport activities**: HR zones are intentionally NULL for multi_sport container activities (they're placeholders for child activities). The UI handles this gracefully by not rendering the HR ZONES section.
- **Run dynamics field names**: If `get_activity_details()` doesn't return `summaryDTO.avgStrideLength` etc., check the raw response with `c.get_activity_details(act_id)` printed to stdout and adjust field names accordingly.
