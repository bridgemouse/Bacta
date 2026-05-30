# Bacta — Plan 1: Data Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full Bacta project, set up SQLite with schema, stand up Express API, and ship a persistent Python/Playwright service that polls Garmin Connect hourly and writes real health data to the database.

**Architecture:** Express + TypeScript serves the API and (in production) the React static build. A separate Docker Compose service runs a persistent Python/Playwright process that authenticates to Garmin Connect once and polls all health metrics hourly, writing directly to a shared SQLite database. Force-poll is signalled via a file that the Python poller watches.

**Tech Stack:** Node 20+, TypeScript, Express, better-sqlite3, Vite, Python 3.11+, Playwright (Python), pytest, Vitest, Docker Compose

---

## File Map

```
bacta/
├── package.json                     # Node dependencies + scripts
├── tsconfig.json                    # Base TS config (client)
├── tsconfig.server.json             # Server TS config (CommonJS output)
├── vite.config.ts                   # Vite config + API proxy
├── .env.example                     # Documented env var template
├── .gitignore                       # node_modules, data/, .env, __pycache__
├── server/
│   ├── index.ts                     # Express entry — mounts routes, starts server
│   ├── db/
│   │   ├── client.ts                # SQLite singleton (better-sqlite3)
│   │   ├── schema.sql               # Raw SQL table definitions
│   │   └── migrate.ts               # Runs schema.sql on startup if needed
│   └── api/
│       ├── health.ts                # GET /api/health
│       ├── garmin.ts                # GET /api/garmin/summary, /api/garmin/:metric
│       ├── manual.ts                # GET /api/manual/today, POST /api/manual
│       ├── insights.ts              # GET /api/insights, /api/insights/:section
│       ├── bloodwork.ts             # GET /api/bloodwork (stub)
│       └── poll.ts                  # POST /api/poll/force
├── poller/
│   ├── requirements.txt             # playwright, pytest
│   ├── db.py                        # SQLite write helpers (upsert snapshots)
│   ├── garmin_auth.py               # Playwright auth — login + session management
│   ├── garmin_metrics.py            # Fetch each metric category from Garmin API
│   ├── garmin_service.py            # Main loop — auth once, poll hourly, watch signal
│   └── macrofactor.py               # Stub — no-op
├── tests/
│   ├── server/
│   │   ├── health.test.ts
│   │   ├── garmin.test.ts
│   │   ├── manual.test.ts
│   │   ├── insights.test.ts
│   │   └── poll.test.ts
│   └── poller/
│       ├── test_db.py
│       └── test_garmin_metrics.py   # Unit tests with mocked Playwright page
├── data/                            # gitignored — SQLite lives here
│   └── .gitkeep
├── insights/                        # gitignored — MX-4 writes here
│   └── .gitkeep
└── docker-compose.yml
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `vite.config.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `poller/requirements.txt`

- [ ] **Step 1: Initialise Node project and install dependencies**

```bash
cd /mnt/c/Users/ebrid/GitHub/Bacta
npm init -y
npm install express better-sqlite3 node-cron dotenv
npm install -D typescript ts-node @types/express @types/better-sqlite3 @types/node vite vitest @vitejs/plugin-react tsx
```

- [ ] **Step 2: Write `tsconfig.json`** (client — ESM, used by Vite)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["client"]
}
```

- [ ] **Step 3: Write `tsconfig.server.json`** (server — CommonJS, compiled by tsx)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "dist/server",
    "rootDir": "server",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["server"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: { outDir: '../dist/client' },
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['../tests/server/**/*.test.ts']
  }
})
```

- [ ] **Step 5: Update `package.json` scripts**

```json
{
  "scripts": {
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite",
    "build": "tsc -p tsconfig.server.json && vite build",
    "start": "node dist/server/index.js",
    "test": "vitest run"
  }
}
```

- [ ] **Step 6: Write `.env.example`**

```
GARMIN_EMAIL=your@email.com
GARMIN_PASSWORD=yourpassword
PORT=3001
DB_PATH=./data/bacta.db
POLL_SIGNAL_PATH=./data/poll_signal
```

- [ ] **Step 7: Write `.gitignore`** (append to existing)

```
node_modules/
dist/
data/*.db
data/poll_signal
insights/*.html
mx4/medical-log.md
mx4/patient-summary.md
__pycache__/
*.pyc
.venv/
```

- [ ] **Step 8: Write `poller/requirements.txt`**

```
playwright==1.51.0
pytest==8.3.0
pytest-asyncio==0.25.0
```

- [ ] **Step 9: Create placeholder directories**

```bash
mkdir -p data insights mx4 server/db server/api poller tests/server tests/poller client/src
touch data/.gitkeep insights/.gitkeep
```

- [ ] **Step 10: Commit scaffold**

```bash
git add package.json tsconfig.json tsconfig.server.json vite.config.ts .env.example .gitignore poller/requirements.txt data/.gitkeep insights/.gitkeep
git commit -m "chore: project scaffold — Node, TypeScript, Vite, Python poller dirs"
```

---

## Task 2: SQLite Schema and Client

**Files:**
- Create: `server/db/schema.sql`
- Create: `server/db/client.ts`
- Create: `server/db/migrate.ts`

- [ ] **Step 1: Write `server/db/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS garmin_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric)
);

CREATE TABLE IF NOT EXISTS macrofactor_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric)
);

CREATE TABLE IF NOT EXISTS manual_inputs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL UNIQUE,
  readiness    INTEGER CHECK(readiness BETWEEN 1 AND 5),
  caffeine_mg  INTEGER,
  supplements  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blood_work (
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

- [ ] **Step 2: Write `server/db/client.ts`**

```typescript
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbPath = process.env.DB_PATH ?? './data/bacta.db'

// Ensure data directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export default db
```

- [ ] **Step 3: Write `server/db/migrate.ts`**

```typescript
import db from './client'
import fs from 'fs'
import path from 'path'

export function migrate() {
  const schema = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf-8'
  )
  db.exec(schema)
  console.log('[db] migrations complete')
}
```

- [ ] **Step 4: Write failing test `tests/server/db.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'

// Use in-memory DB for tests
process.env.DB_PATH = ':memory:'

describe('schema', () => {
  let db: Database.Database

  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    const client = await import('../../server/db/client')
    db = client.default
    migrate()
  })

  it('creates garmin_snapshots table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='garmin_snapshots'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates manual_inputs table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='manual_inputs'"
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

  it('enforces unique date+metric on garmin_snapshots', () => {
    db.prepare(
      'INSERT INTO garmin_snapshots (date, metric, value) VALUES (?, ?, ?)'
    ).run('2026-04-25', 'steps', 9000)
    expect(() => {
      db.prepare(
        'INSERT INTO garmin_snapshots (date, metric, value) VALUES (?, ?, ?)'
      ).run('2026-04-25', 'steps', 9001)
    }).toThrow()
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npm test -- tests/server/db.test.ts
```

Expected: FAIL — module not found or migrate not a function

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test -- tests/server/db.test.ts
```

Expected: 4 passing

- [ ] **Step 7: Commit**

```bash
git add server/db/ tests/server/db.test.ts
git commit -m "feat: SQLite schema and client with WAL mode"
```

---

## Task 3: Express Server

**Files:**
- Create: `server/index.ts`

- [ ] **Step 1: Write failing test `tests/server/health.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import request from 'supertest'

// We'll import the app (not the server) to avoid port binding in tests
// This test will fail until server/index.ts exports `app`

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    process.env.DB_PATH = ':memory:'
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok' })
  })
})
```

- [ ] **Step 2: Install supertest**

```bash
npm install -D supertest @types/supertest
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- tests/server/health.test.ts
```

Expected: FAIL — cannot find module

- [ ] **Step 4: Write `server/index.ts`**

```typescript
import 'dotenv/config'
import express from 'express'
import { migrate } from './db/migrate'
import healthRouter from './api/health'
import garminRouter from './api/garmin'
import manualRouter from './api/manual'
import insightsRouter from './api/insights'
import bloodworkRouter from './api/bloodwork'
import pollRouter from './api/poll'

migrate()

export const app = express()
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/garmin', garminRouter)
app.use('/api/manual', manualRouter)
app.use('/api/insights', insightsRouter)
app.use('/api/bloodwork', bloodworkRouter)
app.use('/api/poll', pollRouter)

// Serve built React app in production
if (process.env.NODE_ENV === 'production') {
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  app.use(express.static(path.join(process.cwd(), 'dist/client')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist/client/index.html'))
  })
}

if (require.main === module) {
  const port = process.env.PORT ?? 3001
  app.listen(port, () => console.log(`[server] listening on :${port}`))
}
```

- [ ] **Step 5: Write `server/api/health.ts`**

```typescript
import { Router } from 'express'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

export default router
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test -- tests/server/health.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/index.ts server/api/health.ts tests/server/health.test.ts
git commit -m "feat: Express server with health endpoint"
```

---

## Task 4: Garmin API Routes

**Files:**
- Create: `server/api/garmin.ts`
- Create: `tests/server/garmin.test.ts`

- [ ] **Step 1: Write failing tests `tests/server/garmin.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import Database from 'better-sqlite3'

process.env.DB_PATH = ':memory:'

describe('Garmin API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { default: db } = await import('../../server/db/client')
    // Seed test data
    const insert = db.prepare(
      'INSERT INTO garmin_snapshots (date, metric, value, unit) VALUES (?, ?, ?, ?)'
    )
    insert.run('2026-04-25', 'steps', 9241, 'steps')
    insert.run('2026-04-25', 'hrv', 48, 'ms')
    insert.run('2026-04-25', 'body_battery', 74, 'score')
    insert.run('2026-04-25', 'resting_hr', 52, 'bpm')
    insert.run('2026-04-25', 'sleep_duration', 442, 'minutes')
    insert.run('2026-04-25', 'recovery_score', 82, 'score')
    insert.run('2026-04-25', 'stress_score', 28, 'score')
    insert.run('2026-04-25', 'vo2max', 51.2, 'ml/kg/min')
  })

  it('GET /api/garmin/summary returns today key metrics', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/summary')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      steps: 9241,
      hrv: 48,
      body_battery: 74,
      resting_hr: 52,
      sleep_duration: 442,
      recovery_score: 82,
      stress_score: 28,
      vo2max: 51.2
    })
  })

  it('GET /api/garmin/:metric returns value for metric', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/steps')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ metric: 'steps', value: 9241, unit: 'steps' })
  })

  it('GET /api/garmin/:metric with date range returns multiple rows', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare(
      'INSERT INTO garmin_snapshots (date, metric, value, unit) VALUES (?, ?, ?, ?)'
    ).run('2026-04-24', 'steps', 8100, 'steps')

    const { app } = await import('../../server/index')
    const res = await request(app)
      .get('/api/garmin/steps')
      .query({ from: '2026-04-24', to: '2026-04-25' })
    expect(res.status).toBe(200)
    expect(res.body.rows).toHaveLength(2)
  })

  it('GET /api/garmin/:metric returns 404 for unknown metric', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/unicorn')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/server/garmin.test.ts
```

Expected: FAIL — router not found

- [ ] **Step 3: Write `server/api/garmin.ts`**

```typescript
import { Router } from 'express'
import db from '../db/client'

const router = Router()

const SUMMARY_METRICS = [
  'steps', 'hrv', 'body_battery', 'resting_hr',
  'sleep_duration', 'recovery_score', 'stress_score', 'vo2max'
]

router.get('/summary', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const rows = db.prepare(
    'SELECT metric, value, unit FROM garmin_snapshots WHERE date = ? AND metric IN (' +
    SUMMARY_METRICS.map(() => '?').join(',') + ')'
  ).all(today, ...SUMMARY_METRICS) as { metric: string; value: number; unit: string }[]

  const summary: Record<string, number> = {}
  for (const row of rows) summary[row.metric] = row.value

  res.json(summary)
})

router.get('/:metric', (req, res) => {
  const { metric } = req.params
  const { from, to } = req.query as { from?: string; to?: string }
  const today = new Date().toISOString().slice(0, 10)

  if (from && to) {
    const rows = db.prepare(
      'SELECT date, metric, value, unit FROM garmin_snapshots WHERE metric = ? AND date BETWEEN ? AND ? ORDER BY date ASC'
    ).all(metric, from, to)
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'no data' })
    }
    return res.json({ metric, rows })
  }

  const row = db.prepare(
    'SELECT date, metric, value, unit FROM garmin_snapshots WHERE metric = ? AND date = ?'
  ).get(metric, today)

  if (!row) return res.status(404).json({ error: 'no data' })
  res.json(row)
})

export default router
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/server/garmin.test.ts
```

Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
git add server/api/garmin.ts tests/server/garmin.test.ts
git commit -m "feat: Garmin API routes with summary and metric endpoints"
```

---

## Task 5: Manual Input Routes

**Files:**
- Create: `server/api/manual.ts`
- Create: `tests/server/manual.test.ts`

- [ ] **Step 1: Write failing tests `tests/server/manual.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Manual Input API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('GET /api/manual/today returns null when no entry', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/manual/today')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ entry: null })
  })

  it('POST /api/manual creates a new entry', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/manual').send({
      date: '2026-04-25',
      readiness: 4,
      caffeine_mg: 200,
      supplements: ['creatine', 'vitamin_d']
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ readiness: 4, caffeine_mg: 200 })
  })

  it('POST /api/manual rejects readiness out of range', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/manual').send({
      date: '2026-04-26',
      readiness: 6
    })
    expect(res.status).toBe(400)
  })

  it('GET /api/manual/today returns created entry', async () => {
    const { app } = await import('../../server/index')
    // Seed today's date
    const { default: db } = await import('../../server/db/client')
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      'INSERT OR REPLACE INTO manual_inputs (date, readiness, caffeine_mg, supplements) VALUES (?, ?, ?, ?)'
    ).run(today, 3, 100, JSON.stringify(['magnesium']))

    const res = await request(app).get('/api/manual/today')
    expect(res.status).toBe(200)
    expect(res.body.entry.readiness).toBe(3)
    expect(JSON.parse(res.body.entry.supplements)).toContain('magnesium')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/server/manual.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `server/api/manual.ts`**

```typescript
import { Router } from 'express'
import db from '../db/client'

const router = Router()

router.get('/today', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const entry = db.prepare(
    'SELECT * FROM manual_inputs WHERE date = ?'
  ).get(today) ?? null
  res.json({ entry })
})

router.post('/', (req, res) => {
  const { date, readiness, caffeine_mg, supplements } = req.body

  if (readiness !== undefined && (readiness < 1 || readiness > 5)) {
    return res.status(400).json({ error: 'readiness must be 1–5' })
  }

  try {
    const row = db.prepare(`
      INSERT INTO manual_inputs (date, readiness, caffeine_mg, supplements)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        readiness = excluded.readiness,
        caffeine_mg = excluded.caffeine_mg,
        supplements = excluded.supplements
    `).run(
      date ?? new Date().toISOString().slice(0, 10),
      readiness ?? null,
      caffeine_mg ?? null,
      supplements ? JSON.stringify(supplements) : null
    )
    const entry = db.prepare('SELECT * FROM manual_inputs WHERE id = ?').get(row.lastInsertRowid)
    res.status(201).json(entry)
  } catch (err) {
    res.status(500).json({ error: 'db error' })
  }
})

export default router
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/server/manual.test.ts
```

Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
git add server/api/manual.ts tests/server/manual.test.ts
git commit -m "feat: manual input API — readiness, caffeine, supplements"
```

---

## Task 6: Insights, Bloodwork, and Poll Routes

**Files:**
- Create: `server/api/insights.ts`
- Create: `server/api/bloodwork.ts`
- Create: `server/api/poll.ts`
- Create: `tests/server/insights.test.ts`
- Create: `tests/server/poll.test.ts`

- [ ] **Step 1: Write failing tests `tests/server/insights.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import path from 'path'

process.env.DB_PATH = ':memory:'

const INSIGHTS_DIR = path.join(process.cwd(), 'insights')

describe('Insights API', () => {
  beforeAll(() => {
    fs.mkdirSync(INSIGHTS_DIR, { recursive: true })
    fs.writeFileSync(path.join(INSIGHTS_DIR, 'recovery.html'), '<div>MX-4 recovery card</div>')
  })

  afterAll(() => {
    fs.rmSync(path.join(INSIGHTS_DIR, 'recovery.html'))
  })

  it('GET /api/insights lists available sections', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights')
    expect(res.status).toBe(200)
    expect(res.body.sections).toContain('recovery')
  })

  it('GET /api/insights/recovery returns HTML content', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/recovery')
    expect(res.status).toBe(200)
    expect(res.text).toContain('MX-4 recovery card')
  })

  it('GET /api/insights/missing returns 404', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/missing')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Write failing test `tests/server/poll.test.ts`**

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import fs from 'fs'

process.env.DB_PATH = ':memory:'
process.env.POLL_SIGNAL_PATH = '/tmp/test_poll_signal'

describe('POST /api/poll/force', () => {
  afterEach(() => {
    if (fs.existsSync('/tmp/test_poll_signal')) {
      fs.rmSync('/tmp/test_poll_signal')
    }
  })

  it('creates the signal file and returns 202', async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/poll/force')
    expect(res.status).toBe(202)
    expect(fs.existsSync('/tmp/test_poll_signal')).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- tests/server/insights.test.ts tests/server/poll.test.ts
```

Expected: FAIL

- [ ] **Step 4: Write `server/api/insights.ts`**

```typescript
import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()
const INSIGHTS_DIR = path.join(process.cwd(), 'insights')

router.get('/', (_req, res) => {
  if (!fs.existsSync(INSIGHTS_DIR)) return res.json({ sections: [] })
  const sections = fs.readdirSync(INSIGHTS_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace('.html', ''))
  res.json({ sections })
})

router.get('/:section', (req, res) => {
  const filePath = path.join(INSIGHTS_DIR, `${req.params.section}.html`)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not found' })
  res.setHeader('Content-Type', 'text/html')
  res.send(fs.readFileSync(filePath, 'utf-8'))
})

export default router
```

- [ ] **Step 5: Write `server/api/bloodwork.ts`**

```typescript
import { Router } from 'express'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ markers: [], note: 'blood work integration pending Factor results' })
})

export default router
```

- [ ] **Step 6: Write `server/api/poll.ts`**

```typescript
import { Router } from 'express'
import fs from 'fs'

const router = Router()
const SIGNAL_PATH = process.env.POLL_SIGNAL_PATH ?? './data/poll_signal'

router.post('/force', (_req, res) => {
  fs.writeFileSync(SIGNAL_PATH, new Date().toISOString())
  res.status(202).json({ message: 'poll signal sent' })
})

export default router
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test -- tests/server/insights.test.ts tests/server/poll.test.ts
```

Expected: all passing

- [ ] **Step 8: Run full test suite**

```bash
npm test
```

Expected: all passing

- [ ] **Step 9: Commit**

```bash
git add server/api/insights.ts server/api/bloodwork.ts server/api/poll.ts tests/server/
git commit -m "feat: insights, bloodwork stub, and force-poll signal endpoint"
```

---

## Task 7: Python SQLite Write Helpers

**Files:**
- Create: `poller/db.py`
- Create: `tests/poller/test_db.py`

- [ ] **Step 1: Set up Python venv**

```bash
cd /mnt/c/Users/ebrid/GitHub/Bacta/poller
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 2: Write failing tests `tests/poller/test_db.py`**

```python
import pytest
import sqlite3
import tempfile
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../poller'))

@pytest.fixture
def db_path(tmp_path):
    path = str(tmp_path / 'test.db')
    # Create schema
    conn = sqlite3.connect(path)
    schema = open(os.path.join(os.path.dirname(__file__), '../../server/db/schema.sql')).read()
    conn.executescript(schema)
    conn.close()
    return path

def test_upsert_snapshot_inserts_new_row(db_path):
    from db import upsert_snapshot
    upsert_snapshot(db_path, 'garmin_snapshots', '2026-04-25', 'steps', 9241, 'steps', '{}')
    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT value FROM garmin_snapshots WHERE date='2026-04-25' AND metric='steps'").fetchone()
    conn.close()
    assert row[0] == 9241

def test_upsert_snapshot_updates_existing_row(db_path):
    from db import upsert_snapshot
    upsert_snapshot(db_path, 'garmin_snapshots', '2026-04-25', 'steps', 9000, 'steps', '{}')
    upsert_snapshot(db_path, 'garmin_snapshots', '2026-04-25', 'steps', 9999, 'steps', '{}')
    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT value FROM garmin_snapshots WHERE date='2026-04-25' AND metric='steps'").fetchone()
    conn.close()
    assert row[0] == 9999

def test_upsert_many_snapshots(db_path):
    from db import upsert_many_snapshots
    metrics = [
        ('steps', 9241, 'steps'),
        ('hrv', 48, 'ms'),
        ('resting_hr', 52, 'bpm'),
    ]
    upsert_many_snapshots(db_path, 'garmin_snapshots', '2026-04-25', metrics, '{}')
    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT metric, value FROM garmin_snapshots WHERE date='2026-04-25'").fetchall()
    conn.close()
    assert len(rows) == 3
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /mnt/c/Users/ebrid/GitHub/Bacta
source poller/.venv/bin/activate
pytest tests/poller/test_db.py -v
```

Expected: FAIL — db module not found

- [ ] **Step 4: Write `poller/db.py`**

```python
import sqlite3
import json
from typing import Optional

def upsert_snapshot(
    db_path: str,
    table: str,
    date: str,
    metric: str,
    value: float,
    unit: str,
    source_json: str
) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(f"""
            INSERT INTO {table} (date, metric, value, unit, source_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date, metric) DO UPDATE SET
                value = excluded.value,
                unit = excluded.unit,
                source_json = excluded.source_json
        """, (date, metric, value, unit, source_json))
        conn.commit()
    finally:
        conn.close()

def upsert_many_snapshots(
    db_path: str,
    table: str,
    date: str,
    metrics: list[tuple[str, float, str]],  # (metric, value, unit)
    source_json: str
) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.executemany(f"""
            INSERT INTO {table} (date, metric, value, unit, source_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date, metric) DO UPDATE SET
                value = excluded.value,
                unit = excluded.unit,
                source_json = excluded.source_json
        """, [(date, m, v, u, source_json) for m, v, u in metrics])
        conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/poller/test_db.py -v
```

Expected: 3 passing

- [ ] **Step 6: Commit**

```bash
git add poller/db.py tests/poller/test_db.py
git commit -m "feat: Python SQLite upsert helpers for poller"
```

---

## Task 8: Garmin Auth and Metrics (Playwright)

**Files:**
- Create: `poller/garmin_auth.py`
- Create: `poller/garmin_metrics.py`
- Create: `tests/poller/test_garmin_metrics.py`

- [ ] **Step 1: Install Playwright browsers**

```bash
source poller/.venv/bin/activate
playwright install chromium
```

- [ ] **Step 2: Write failing tests `tests/poller/test_garmin_metrics.py`**

These are unit tests with a mocked Playwright page — no real Garmin calls in CI.

```python
import pytest
import sys, os
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../poller'))

@pytest.fixture
def mock_page():
    page = AsyncMock()
    # Simulate a Garmin JSON API response
    response = AsyncMock()
    response.json = AsyncMock(return_value={
        "totalSteps": 9241,
        "restingHeartRate": 52,
        "averageStressLevel": 28
    })
    page.goto = AsyncMock(return_value=response)
    return page

@pytest.mark.asyncio
async def test_fetch_daily_summary_extracts_steps(mock_page):
    from garmin_metrics import fetch_daily_summary
    result = await fetch_daily_summary(mock_page, 'testuser', '2026-04-25')
    assert result['steps'] == 9241

@pytest.mark.asyncio
async def test_fetch_daily_summary_extracts_resting_hr(mock_page):
    from garmin_metrics import fetch_daily_summary
    result = await fetch_daily_summary(mock_page, 'testuser', '2026-04-25')
    assert result['resting_hr'] == 52

@pytest.mark.asyncio
async def test_fetch_daily_summary_handles_missing_field(mock_page):
    from garmin_metrics import fetch_daily_summary
    mock_page.goto.return_value.json = AsyncMock(return_value={})
    result = await fetch_daily_summary(mock_page, 'testuser', '2026-04-25')
    assert result.get('steps') is None
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/poller/test_garmin_metrics.py -v
```

Expected: FAIL — garmin_metrics not found

- [ ] **Step 4: Write `poller/garmin_auth.py`**

```python
import os
from playwright.async_api import Page, Browser

GARMIN_SSO_URL = 'https://sso.garmin.com/portal/sso/en-US/sign-in?clientId=GarminConnect&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F'
GARMIN_HOME_URL = 'https://connect.garmin.com/modern/'

async def login(browser: Browser) -> Page:
    """
    Authenticate to Garmin Connect via headless Chromium.
    Returns an authenticated page with session cookies set.
    """
    email = os.environ['GARMIN_EMAIL']
    password = os.environ['GARMIN_PASSWORD']

    page = await browser.new_page()
    await page.goto(GARMIN_SSO_URL, wait_until='networkidle')

    # Fill credentials
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')

    # Wait for redirect to Garmin Connect home
    await page.wait_for_url('**/modern/**', timeout=30_000)

    print('[garmin_auth] authenticated successfully')
    return page

async def get_display_name(page: Page) -> str:
    """Get the Garmin Connect display name from the current session."""
    response = await page.goto('https://connect.garmin.com/modern/proxy/userprofile-service/socialProfile/')
    data = await response.json()
    return data.get('displayName', '')
```

- [ ] **Step 5: Write `poller/garmin_metrics.py`**

```python
import json
from datetime import date
from playwright.async_api import Page

BASE = 'https://connect.garmin.com/modern/proxy'

async def _get_json(page: Page, url: str) -> dict:
    response = await page.goto(url, wait_until='networkidle')
    try:
        return await response.json()
    except Exception:
        return {}

async def fetch_daily_summary(page: Page, display_name: str, date_str: str) -> dict:
    """Fetch the core daily user summary from Garmin Connect."""
    url = f'{BASE}/usersummary-service/usersummary/daily/{display_name}?calendarDate={date_str}'
    data = await _get_json(page, url)
    return {
        'steps': data.get('totalSteps'),
        'resting_hr': data.get('restingHeartRate'),
        'stress_score': data.get('averageStressLevel'),
        'body_battery_charged': data.get('bodyBatteryChargedValue'),
        'body_battery_drained': data.get('bodyBatteryDrainedValue'),
        'intensity_minutes': data.get('moderateIntensityMinutes', 0) + data.get('vigorousIntensityMinutes', 0) * 2,
        'floors': data.get('floorsAscended'),
        'hydration_ml': data.get('waterIntakeInML'),
    }

async def fetch_hrv(page: Page, date_str: str) -> dict:
    url = f'{BASE}/hrv-service/hrv/{date_str}'
    data = await _get_json(page, url)
    summary = data.get('hrvSummary', {})
    return {
        'hrv': summary.get('lastNight'),
        'hrv_5min_high': summary.get('lastNight5MinHigh'),
        'hrv_status': summary.get('status'),
    }

async def fetch_sleep(page: Page, date_str: str) -> dict:
    url = f'{BASE}/wellness-service/wellness/dailySleepData?date={date_str}'
    data = await _get_json(page, url)
    daily = data.get('dailySleepDTO', {})
    return {
        'sleep_duration': daily.get('sleepTimeSeconds', 0) // 60,
        'sleep_score': daily.get('sleepScores', {}).get('overall', {}).get('value'),
        'sleep_deep_minutes': daily.get('deepSleepSeconds', 0) // 60,
        'sleep_light_minutes': daily.get('lightSleepSeconds', 0) // 60,
        'sleep_rem_minutes': daily.get('remSleepSeconds', 0) // 60,
        'sleep_awake_minutes': daily.get('awakeSleepSeconds', 0) // 60,
    }

async def fetch_body_battery(page: Page, date_str: str) -> dict:
    url = f'{BASE}/wellness-service/wellness/bodyBattery?startDate={date_str}&endDate={date_str}'
    data = await _get_json(page, url)
    if isinstance(data, list) and len(data) > 0:
        readings = data[0].get('bodyBatteryValuesArray', [])
        if readings:
            return {'body_battery': readings[-1][1] if readings[-1] else None}
    return {'body_battery': None}

async def fetch_recovery(page: Page, date_str: str) -> dict:
    url = f'{BASE}/training-readiness-service/trainingReadiness/{date_str}'
    data = await _get_json(page, url)
    return {
        'recovery_score': data.get('score'),
        'training_load': data.get('acuteLoad'),
        'recovery_time_hours': data.get('recoveryTime'),
    }

async def fetch_vo2max(page: Page, display_name: str) -> dict:
    url = f'{BASE}/fitnessstats-service/activity/{display_name}?aggregation=weekly&startDate=2020-01-01&endDate=2099-12-31&metrics=VO2_MAX_RUNNING'
    data = await _get_json(page, url)
    values = data.get('metricsMap', {}).get('VO2_MAX_RUNNING', [])
    latest = values[-1] if values else {}
    return {'vo2max': latest.get('value')}

async def fetch_all(page: Page, display_name: str, date_str: str) -> dict:
    """Fetch all metrics and return as flat dict of {metric: (value, unit)}."""
    results = {}

    def add(data: dict, units: dict[str, str]):
        for k, v in data.items():
            if v is not None:
                results[k] = (v, units.get(k, ''))

    add(await fetch_daily_summary(page, display_name, date_str), {
        'steps': 'steps', 'resting_hr': 'bpm', 'stress_score': 'score',
        'body_battery_charged': 'score', 'body_battery_drained': 'score',
        'intensity_minutes': 'minutes', 'floors': 'floors', 'hydration_ml': 'ml'
    })
    add(await fetch_hrv(page, date_str), {
        'hrv': 'ms', 'hrv_5min_high': 'ms', 'hrv_status': ''
    })
    add(await fetch_sleep(page, date_str), {
        'sleep_duration': 'minutes', 'sleep_score': 'score',
        'sleep_deep_minutes': 'minutes', 'sleep_light_minutes': 'minutes',
        'sleep_rem_minutes': 'minutes', 'sleep_awake_minutes': 'minutes'
    })
    add(await fetch_body_battery(page, date_str), {'body_battery': 'score'})
    add(await fetch_recovery(page, date_str), {
        'recovery_score': 'score', 'training_load': 'load', 'recovery_time_hours': 'hours'
    })
    add(await fetch_vo2max(page, display_name), {'vo2max': 'ml/kg/min'})

    return results
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/poller/test_garmin_metrics.py -v
```

Expected: 3 passing

- [ ] **Step 7: Commit**

```bash
git add poller/garmin_auth.py poller/garmin_metrics.py tests/poller/test_garmin_metrics.py
git commit -m "feat: Garmin Playwright auth and metric fetchers"
```

---

## Task 9: Persistent Garmin Poller Service

**Files:**
- Create: `poller/garmin_service.py`
- Create: `poller/macrofactor.py`

- [ ] **Step 1: Write `poller/garmin_service.py`**

```python
#!/usr/bin/env python3
"""
Persistent Garmin Connect polling service.
Authenticates once via headless Chromium, polls all metrics hourly.
Watches for a signal file to trigger immediate poll (force-poll from API).
"""
import asyncio
import json
import os
import signal
import sys
from datetime import date, datetime
from pathlib import Path

from playwright.async_api import async_playwright

from db import upsert_many_snapshots
from garmin_auth import login, get_display_name
from garmin_metrics import fetch_all

DB_PATH = os.environ.get('DB_PATH', './data/bacta.db')
SIGNAL_PATH = os.environ.get('POLL_SIGNAL_PATH', './data/poll_signal')
POLL_INTERVAL_SECONDS = int(os.environ.get('POLL_INTERVAL_SECONDS', '3600'))

def log(msg: str):
    print(f'[garmin_service] {datetime.now().isoformat()} {msg}', flush=True)

async def poll_once(page, display_name: str):
    today = date.today().isoformat()
    log(f'polling metrics for {today}')
    try:
        metrics = await fetch_all(page, display_name, today)
        rows = [(metric, value, unit) for metric, (value, unit) in metrics.items()]
        upsert_many_snapshots(DB_PATH, 'garmin_snapshots', today, rows, '{}')
        log(f'wrote {len(rows)} metrics to db')
    except Exception as e:
        log(f'ERROR during poll: {e}')

def check_signal() -> bool:
    """Returns True and removes signal file if force-poll was requested."""
    path = Path(SIGNAL_PATH)
    if path.exists():
        path.unlink()
        return True
    return False

async def main():
    log('starting up')
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await login(browser)
        display_name = await get_display_name(page)
        log(f'authenticated as {display_name}')

        # Initial poll on startup
        await poll_once(page, display_name)

        while True:
            # Sleep in 10-second increments, checking for signal
            for _ in range(POLL_INTERVAL_SECONDS // 10):
                await asyncio.sleep(10)
                if check_signal():
                    log('force-poll signal received')
                    await poll_once(page, display_name)
                    break  # Reset the hourly timer

            await poll_once(page, display_name)

if __name__ == '__main__':
    asyncio.run(main())
```

- [ ] **Step 2: Write `poller/macrofactor.py`** (stub)

```python
"""
MacroFactor poller stub.
Will use @sjawhar/macrofactor-mcp as a TypeScript library import
once a MacroFactor account is created.
"""

def poll():
    print('[macrofactor] stub — no account configured, skipping')
```

- [ ] **Step 3: Verify the poller starts with real credentials**

```bash
cd /mnt/c/Users/ebrid/GitHub/Bacta
source poller/.venv/bin/activate
export $(cat .env | xargs)
python poller/garmin_service.py
```

Expected output:
```
[garmin_service] <timestamp> starting up
[garmin_service] <timestamp> authenticated as <your-display-name>
[garmin_service] <timestamp> polling metrics for 2026-04-25
[garmin_service] <timestamp> wrote N metrics to db
```

Let it run for 30 seconds then Ctrl+C. Verify data was written:

```bash
sqlite3 data/bacta.db "SELECT metric, value, unit FROM garmin_snapshots LIMIT 10;"
```

Expected: rows of real Garmin data.

- [ ] **Step 4: Commit**

```bash
git add poller/garmin_service.py poller/macrofactor.py
git commit -m "feat: persistent Playwright Garmin poller service with force-poll signal"
```

---

## Task 10: Docker Compose and Smoke Test

**Files:**
- Create: `docker-compose.yml`
- Create: `poller/Dockerfile`
- Create: `server/Dockerfile`

- [ ] **Step 1: Write `poller/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium
RUN playwright install-deps chromium

COPY *.py .

CMD ["python", "garmin_service.py"]
```

- [ ] **Step 2: Write `server/Dockerfile`**

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server/db/schema.sql ./server/db/schema.sql

ENV NODE_ENV=production
CMD ["node", "dist/server/index.js"]
```

- [ ] **Step 3: Write `docker-compose.yml`**

```yaml
services:
  bacta-api:
    build:
      context: .
      dockerfile: server/Dockerfile
    ports:
      - "3001:3001"
    env_file: .env
    volumes:
      - ./data:/app/data
      - ./insights:/app/insights
      - ./mx4:/app/mx4
      - /mnt/vault:/mnt/vault:ro
    restart: unless-stopped
    depends_on:
      - garmin-poller

  garmin-poller:
    build:
      context: poller
      dockerfile: Dockerfile
    env_file: .env
    environment:
      - DB_PATH=/data/bacta.db
      - POLL_SIGNAL_PATH=/data/poll_signal
    volumes:
      - ./data:/data
    restart: unless-stopped
```

- [ ] **Step 4: Build and run compose stack**

```bash
docker compose build
docker compose up -d
```

- [ ] **Step 5: Smoke test the API**

```bash
# Health check
curl http://localhost:3001/api/health
# Expected: {"status":"ok","ts":"..."}

# Wait 60 seconds for first Garmin poll, then:
curl http://localhost:3001/api/garmin/summary
# Expected: JSON object with real Garmin metrics

# Force poll
curl -X POST http://localhost:3001/api/poll/force
# Expected: {"message":"poll signal sent"}

# Check logs
docker compose logs garmin-poller --tail 20
```

- [ ] **Step 6: Run full test suite one final time**

```bash
npm test
pytest tests/poller/ -v
```

Expected: all passing

- [ ] **Step 7: Final commit**

```bash
git add docker-compose.yml poller/Dockerfile server/Dockerfile
git commit -m "feat: Docker Compose stack — bacta-api and garmin-poller services"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Express + TypeScript backend
- ✅ SQLite schema (4 tables)
- ✅ Garmin metrics (daily summary, HRV, sleep, body battery, recovery, VO2 max)
- ✅ MacroFactor stub
- ✅ Blood work stub
- ✅ Manual inputs API
- ✅ Insights API
- ✅ Force-poll signal
- ✅ Persistent Playwright poller
- ✅ Docker Compose with two services

**Not in Plan 1 (covered in Plans 2 and 3):**
- React frontend / dashboard UI → Plan 2
- MX-4 agent, system prompt, cron wiring → Plan 3
- Caddy config, LXC deployment → Plan 3 epilogue
- MacroFactor wiring → future (no account yet)
- Blood work parser → future (no Factor results yet)
- LLM-Wiki Garmin endpoint → Plan 3 epilogue

**Running dynamics, pace trends, workouts, alcohol units** — these are in the spec metrics list but not in `garmin_metrics.py`. They require fetching activity data from a different Garmin API endpoint. Add a `fetch_activities()` function to `garmin_metrics.py` as a follow-up task after Plan 1 is deployed and real data confirmed working.
