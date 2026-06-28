# Multi-Device Integration Layer — Plan 2 Phase 2 (Oura + Whoop)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Oura and Whoop as health data sources, following the exact file/pattern structure established in Phase 1 (stravaService/Processor + hevyService/Processor).

**Architecture:** Each provider gets a service file (HTTP client + OAuth + data fetch) and a processor file (DB writes to health_snapshots and health_activities). Both are wired into the existing `server/api/integrations.ts` by adding cases to three switch statements. Python pollers follow the same thin 20-line pattern from Phase 1.

**Tech Stack:** TypeScript, Express, better-sqlite3, Node fetch API, Vitest

## Global Constraints

- Branch: `feature/multi-device` — never commit directly to main
- `INSERT OR REPLACE` for all health_snapshots writes; source = `'oura'` or `'whoop'`
- All `db.prepare()` calls MUST be inside function bodies (lazy init) — not at module level. This is a known gotcha from Phase 1; violating it causes import-ordering failures in tests.
- **Oura auth:** token exchange and refresh use HTTP Basic auth — `Authorization: Basic base64(clientId:clientSecret)` — with a `application/x-www-form-urlencoded` body. Client credentials do NOT go in the body.
- **Oura tokens:** response returns `expires_in` (seconds), not `expires_at`. Convert: `expires_at = Math.floor(Date.now() / 1000) + d.expires_in`
- **Whoop auth:** token exchange and refresh use `application/x-www-form-urlencoded` body with `client_id` and `client_secret` in the body (no Basic auth header).
- **Whoop tokens:** same as Oura — response returns `expires_in`, not `expires_at`. Same conversion.
- **Whoop v2 API:** all endpoints use `/v2/` prefix; workout IDs are UUIDs (strings), not integers.
- Only process Whoop records with `score_state === 'SCORED'` and a non-null `score` object.
- Skip Whoop sleep records where `nap === true`.
- Test files: set `process.env.DB_PATH = ':memory:'` at the top (before imports). Service tests mock fetch with `vi.stubGlobal`. Processor tests call `migrate()` in `beforeAll`.
- Run a single test file: `npx vitest run tests/server/<file>.test.ts`
- Run full suite: `npm test` (runs both client + server suites)
- Type-check: `npx tsc -p tsconfig.server.json --noEmit`
- Existing test count: 363 passing (193 server + 170 client)

---

### Task 1: Oura service + processor + tests

**Files:**
- Create: `server/lib/integrations/oura/ouraService.ts`
- Create: `server/lib/integrations/oura/ouraProcessor.ts`
- Create: `tests/server/ouraService.test.ts`
- Create: `tests/server/ouraProcessor.test.ts`

**Interfaces produced (used by Task 3):**
```typescript
// ouraService.ts exports:
export function getAuthUrl(clientId: string, redirectUri: string, state: string): string
export async function exchangeCode(clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<ProviderTokens>
export async function refreshTokens(clientId: string, clientSecret: string, tokens: ProviderTokens): Promise<ProviderTokens>
export async function fetchOuraData(accessToken: string, startDate: string, endDate: string): Promise<OuraData>

// ouraProcessor.ts exports:
export function processOuraData(data: OuraData): number
```

- [ ] **Step 1: Write the failing Oura service tests**

Create `tests/server/ouraService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('ouraService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Oura OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/oura/ouraService')
    const url = getAuthUrl('client123', 'http://bacta.home/api/integrations/oura/callback', 'state-abc')
    expect(url).toContain('https://cloud.ouraring.com/oauth/authorize')
    expect(url).toContain('client_id=client123')
    expect(url).toContain('state=state-abc')
    expect(url).toContain('daily+sleep')
  })

  it('exchangeCode uses Basic auth and returns tokens with expires_at', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'acc', refresh_token: 'ref', expires_in: 3600 }),
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/oura/ouraService')
    const before = Math.floor(Date.now() / 1000)
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')
    const after  = Math.floor(Date.now() / 1000)

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['Authorization']).toMatch(/^Basic /)
    const decoded = Buffer.from(headers['Authorization'].replace('Basic ', ''), 'base64').toString()
    expect(decoded).toBe('cid:csec')
    expect(tokens.access_token).toBe('acc')
    expect(tokens.expires_at).toBeGreaterThanOrEqual(before + 3600)
    expect(tokens.expires_at).toBeLessThanOrEqual(after + 3600)
  })

  it('refreshTokens skips refresh when token not expired', async () => {
    const { refreshTokens } = await import('../../server/lib/integrations/oura/ouraService')
    const tokens = { access_token: 'acc', refresh_token: 'ref', expires_at: Math.floor(Date.now() / 1000) + 3600 }
    const result = await refreshTokens('cid', 'csec', tokens)
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toBe(tokens)
  })

  it('refreshTokens calls Oura when token is expired', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-acc', refresh_token: 'new-ref', expires_in: 3600 }),
    } as Response)

    const { refreshTokens } = await import('../../server/lib/integrations/oura/ouraService')
    const expired = { access_token: 'old', refresh_token: 'old-ref', expires_at: 100 }
    const result  = await refreshTokens('cid', 'csec', expired)
    expect(fetch).toHaveBeenCalled()
    expect(result.access_token).toBe('new-acc')
  })

  it('fetchOuraData fetches all three collections and returns combined data', async () => {
    const sleepData     = { data: [{ day: '2026-06-20', score: 78, average_hrv: 45, average_breath: 15, total_sleep_duration: 25200, deep_sleep_duration: 5400, light_sleep_duration: 10800, rem_sleep_duration: 9000, average_saturation: 97 }], next_token: null }
    const readinessData = { data: [{ day: '2026-06-20', score: 82, resting_heart_rate: 54 }], next_token: null }
    const activityData  = { data: [{ day: '2026-06-20', steps: 8500 }], next_token: null }

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => sleepData     } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => readinessData } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => activityData  } as Response)

    const { fetchOuraData } = await import('../../server/lib/integrations/oura/ouraService')
    const result = await fetchOuraData('token', '2026-05-25', '2026-06-24')

    expect(result.sleep).toHaveLength(1)
    expect(result.readiness).toHaveLength(1)
    expect(result.activity).toHaveLength(1)
    expect(result.sleep[0].score).toBe(78)
    expect(result.readiness[0].resting_heart_rate).toBe(54)
    expect(result.activity[0].steps).toBe(8500)
  })
})
```

- [ ] **Step 2: Run — confirm they fail**

```bash
npx vitest run tests/server/ouraService.test.ts
```
Expected: all tests FAIL with "Cannot find module"

- [ ] **Step 3: Write `server/lib/integrations/oura/ouraService.ts`**

```typescript
import { ProviderTokens, tokensExpired } from '../shared/types'

const TOKEN_URL = 'https://api.ouraring.com/oauth/token'
const API_BASE  = 'https://api.ouraring.com'

function basicAuth(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         'daily sleep heartrate workout personal',
    state,
  })
  return `https://cloud.ouraring.com/oauth/authorize?${p}`
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { Authorization: basicAuth(clientId, clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error(`Oura token exchange failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + d.expires_in }
}

export async function refreshTokens(
  clientId: string, clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  if (!tokensExpired(tokens)) return tokens
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { Authorization: basicAuth(clientId, clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error(`Oura token refresh failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + d.expires_in }
}

export interface OuraDailySleep {
  day:                  string
  score:                number | null
  average_hrv:          number | null
  average_breath:       number | null
  total_sleep_duration: number | null
  deep_sleep_duration:  number | null
  light_sleep_duration: number | null
  rem_sleep_duration:   number | null
  average_saturation:   number | null
}

export interface OuraDailyReadiness {
  day:                string
  score:              number | null
  resting_heart_rate: number | null
}

export interface OuraDailyActivity {
  day:   string
  steps: number | null
}

export interface OuraData {
  sleep:     OuraDailySleep[]
  readiness: OuraDailyReadiness[]
  activity:  OuraDailyActivity[]
}

async function fetchCollection<T>(accessToken: string, path: string, startDate: string, endDate: string): Promise<T[]> {
  const all: T[] = []
  let nextToken: string | null = null
  do {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
    if (nextToken) params.set('next_token', nextToken)
    const res = await fetch(`${API_BASE}${path}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Oura ${path} fetch failed: ${res.status}`)
    const data = await res.json() as { data: T[]; next_token: string | null }
    all.push(...data.data)
    nextToken = data.next_token
  } while (nextToken)
  return all
}

export async function fetchOuraData(accessToken: string, startDate: string, endDate: string): Promise<OuraData> {
  const [sleep, readiness, activity] = await Promise.all([
    fetchCollection<OuraDailySleep>    (accessToken, '/v2/usercollection/daily_sleep',     startDate, endDate),
    fetchCollection<OuraDailyReadiness>(accessToken, '/v2/usercollection/daily_readiness', startDate, endDate),
    fetchCollection<OuraDailyActivity> (accessToken, '/v2/usercollection/daily_activity',  startDate, endDate),
  ])
  return { sleep, readiness, activity }
}
```

- [ ] **Step 4: Run service tests — confirm they pass**

```bash
npx vitest run tests/server/ouraService.test.ts
```
Expected: 5/5 PASS

- [ ] **Step 5: Write the failing Oura processor tests**

Create `tests/server/ouraProcessor.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('ouraProcessor', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('processOuraData writes sleep snapshots to health_snapshots', async () => {
    const { processOuraData } = await import('../../server/lib/integrations/oura/ouraProcessor')
    const { default: db }     = await import('../../server/db/client')

    const count = processOuraData({
      sleep: [{
        day: '2026-06-20', score: 78, average_hrv: 45, average_breath: 15.2,
        total_sleep_duration: 25200, deep_sleep_duration: 5400,
        light_sleep_duration: 10800, rem_sleep_duration: 9000, average_saturation: 97.5,
      }],
      readiness: [],
      activity:  [],
    })

    expect(count).toBe(8) // score + hrv + breath + total + deep + light + rem + spo2

    const snap = (key: string) =>
      (db.prepare("SELECT value FROM health_snapshots WHERE date='2026-06-20' AND metric=? AND source='oura'").get(key) as { value: number } | undefined)?.value

    expect(snap('sleep_score')).toBe(78)
    expect(snap('hrv')).toBe(45)
    expect(snap('respiration')).toBeCloseTo(15.2, 1)
    expect(snap('sleep_duration_s')).toBe(25200)
    expect(snap('deep_sleep_s')).toBe(5400)
    expect(snap('light_sleep_s')).toBe(10800)
    expect(snap('rem_sleep_s')).toBe(9000)
    expect(snap('spo2')).toBeCloseTo(97.5, 1)
  })

  it('processOuraData writes readiness snapshots', async () => {
    const { processOuraData } = await import('../../server/lib/integrations/oura/ouraProcessor')
    const { default: db }     = await import('../../server/db/client')

    processOuraData({
      sleep:     [],
      readiness: [{ day: '2026-06-21', score: 82, resting_heart_rate: 54 }],
      activity:  [],
    })

    const snap = (key: string) =>
      (db.prepare("SELECT value FROM health_snapshots WHERE date='2026-06-21' AND metric=? AND source='oura'").get(key) as { value: number } | undefined)?.value

    expect(snap('readiness_score')).toBe(82)
    expect(snap('resting_hr')).toBe(54)
  })

  it('processOuraData writes steps from activity', async () => {
    const { processOuraData } = await import('../../server/lib/integrations/oura/ouraProcessor')
    const { default: db }     = await import('../../server/db/client')

    processOuraData({ sleep: [], readiness: [], activity: [{ day: '2026-06-22', steps: 9500 }] })

    const snap = db.prepare("SELECT value FROM health_snapshots WHERE date='2026-06-22' AND metric='steps' AND source='oura'").get() as { value: number } | undefined
    expect(snap?.value).toBe(9500)
  })

  it('processOuraData skips null fields without writing', async () => {
    const { processOuraData } = await import('../../server/lib/integrations/oura/ouraProcessor')
    const { default: db }     = await import('../../server/db/client')

    const count = processOuraData({
      sleep: [{ day: '2026-06-23', score: null, average_hrv: null, average_breath: null, total_sleep_duration: null, deep_sleep_duration: null, light_sleep_duration: null, rem_sleep_duration: null, average_saturation: null }],
      readiness: [{ day: '2026-06-23', score: null, resting_heart_rate: null }],
      activity:  [{ day: '2026-06-23', steps: null }],
    })

    expect(count).toBe(0)
    const rows = db.prepare("SELECT * FROM health_snapshots WHERE date='2026-06-23' AND source='oura'").all()
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 6: Run — confirm they fail**

```bash
npx vitest run tests/server/ouraProcessor.test.ts
```
Expected: all tests FAIL with "Cannot find module"

- [ ] **Step 7: Write `server/lib/integrations/oura/ouraProcessor.ts`**

```typescript
import db from '../../../db/client'
import { OuraData } from './ouraService'

export function processOuraData(data: OuraData): number {
  const upsert = db.prepare(
    `INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source) VALUES (?, ?, ?, ?, 'oura')`
  )

  let count = 0
  const run = db.transaction(() => {
    for (const s of data.sleep) {
      if (s.score != null)                { upsert.run(s.day, 'sleep_score',      s.score,                'score'); count++ }
      if (s.average_hrv != null)          { upsert.run(s.day, 'hrv',              s.average_hrv,          'ms');    count++ }
      if (s.average_breath != null)       { upsert.run(s.day, 'respiration',      s.average_breath,       'rpm');   count++ }
      if (s.total_sleep_duration != null) { upsert.run(s.day, 'sleep_duration_s', s.total_sleep_duration, 's');     count++ }
      if (s.deep_sleep_duration != null)  { upsert.run(s.day, 'deep_sleep_s',     s.deep_sleep_duration,  's');     count++ }
      if (s.light_sleep_duration != null) { upsert.run(s.day, 'light_sleep_s',    s.light_sleep_duration, 's');     count++ }
      if (s.rem_sleep_duration != null)   { upsert.run(s.day, 'rem_sleep_s',      s.rem_sleep_duration,   's');     count++ }
      if (s.average_saturation != null)   { upsert.run(s.day, 'spo2',             s.average_saturation,   '%');     count++ }
    }
    for (const r of data.readiness) {
      if (r.score != null)              { upsert.run(r.day, 'readiness_score', r.score,              'score'); count++ }
      if (r.resting_heart_rate != null) { upsert.run(r.day, 'resting_hr',     r.resting_heart_rate, 'bpm');   count++ }
    }
    for (const a of data.activity) {
      if (a.steps != null) { upsert.run(a.day, 'steps', a.steps, 'steps'); count++ }
    }
  })
  run()
  console.log(`[oura] processed ${count} snapshots`)
  return count
}
```

- [ ] **Step 8: Run processor tests — confirm they pass**

```bash
npx vitest run tests/server/ouraProcessor.test.ts
```
Expected: 4/4 PASS

- [ ] **Step 9: Type-check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add server/lib/integrations/oura/ tests/server/ouraService.test.ts tests/server/ouraProcessor.test.ts
git commit -m "feat(oura): add Oura service, processor, and tests"
```

---

### Task 2: Whoop service + processor + tests

**Files:**
- Create: `server/lib/integrations/whoop/whoopService.ts`
- Create: `server/lib/integrations/whoop/whoopProcessor.ts`
- Create: `tests/server/whoopService.test.ts`
- Create: `tests/server/whoopProcessor.test.ts`

**Interfaces produced (used by Task 3):**
```typescript
// whoopService.ts exports:
export function getAuthUrl(clientId: string, redirectUri: string, state: string): string
export async function exchangeCode(clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<ProviderTokens>
export async function refreshTokens(clientId: string, clientSecret: string, tokens: ProviderTokens): Promise<ProviderTokens>
export async function fetchWhoopData(accessToken: string, startDate: string, endDate: string): Promise<WhoopData>

// whoopProcessor.ts exports:
export function toTypeKey(sportId: number): string
export function processWhoopData(data: WhoopData): number
```

- [ ] **Step 1: Write the failing Whoop service tests**

Create `tests/server/whoopService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('whoopService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Whoop OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/whoop/whoopService')
    const url = getAuthUrl('client123', 'http://bacta.home/api/integrations/whoop/callback', 'state-abc')
    expect(url).toContain('https://api.prod.whoop.com/oauth/oauth2/auth')
    expect(url).toContain('client_id=client123')
    expect(url).toContain('state=state-abc')
    expect(url).toContain('read%3Arecovery')
  })

  it('exchangeCode POSTs form-urlencoded (not Basic auth) and converts expires_in to expires_at', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'acc', refresh_token: 'ref', expires_in: 3600 }),
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/whoop/whoopService')
    const before = Math.floor(Date.now() / 1000)
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')
    const after  = Math.floor(Date.now() / 1000)

    const call    = vi.mocked(fetch).mock.calls[0]
    const headers = call[1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(tokens.access_token).toBe('acc')
    expect(tokens.expires_at).toBeGreaterThanOrEqual(before + 3600)
    expect(tokens.expires_at).toBeLessThanOrEqual(after + 3600)
  })

  it('refreshTokens skips refresh when token not expired', async () => {
    const { refreshTokens } = await import('../../server/lib/integrations/whoop/whoopService')
    const tokens = { access_token: 'acc', refresh_token: 'ref', expires_at: Math.floor(Date.now() / 1000) + 3600 }
    const result = await refreshTokens('cid', 'csec', tokens)
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toBe(tokens)
  })

  it('refreshTokens calls Whoop when token is expired', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-acc', refresh_token: 'new-ref', expires_in: 3600 }),
    } as Response)

    const { refreshTokens } = await import('../../server/lib/integrations/whoop/whoopService')
    const expired = { access_token: 'old', refresh_token: 'old-ref', expires_at: 100 }
    const result  = await refreshTokens('cid', 'csec', expired)
    expect(fetch).toHaveBeenCalled()
    expect(result.access_token).toBe('new-acc')
  })

  it('fetchWhoopData fetches recovery, sleep, and workouts', async () => {
    const recovery = { records: [{ created_at: '2026-06-20T10:00:00.000Z', score_state: 'SCORED', score: { recovery_score: 75, resting_heart_rate: 56, hrv_rmssd_milli: 42.5 } }], next_token: null }
    const sleep    = { records: [{ start: '2026-06-20T00:00:00.000Z', end: '2026-06-20T07:30:00.000Z', nap: false, score_state: 'SCORED', score: { stage_summary: { total_in_bed_time_milli: 28800000, total_awake_time_milli: 1800000, total_light_sleep_time_milli: 9000000, total_slow_wave_sleep_time_milli: 5400000, total_rem_sleep_time_milli: 10800000 }, respiratory_rate: 15.5, sleep_performance_percentage: 88 } }], next_token: null }
    const workouts = { records: [{ id: 'uuid-1', start: '2026-06-20T07:30:00.000Z', end: '2026-06-20T08:30:00.000Z', sport_id: 1, score_state: 'SCORED', score: { strain: 10, average_heart_rate: 148, max_heart_rate: 175, kilojoule: 1200, distance_meter: 8000 } }], next_token: null }

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => recovery } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => sleep    } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => workouts } as Response)

    const { fetchWhoopData } = await import('../../server/lib/integrations/whoop/whoopService')
    const result = await fetchWhoopData('token', '2026-05-25', '2026-06-24')

    expect(result.recovery).toHaveLength(1)
    expect(result.sleep).toHaveLength(1)
    expect(result.workouts).toHaveLength(1)
    expect(result.recovery[0].score?.recovery_score).toBe(75)
  })
})
```

- [ ] **Step 2: Run — confirm they fail**

```bash
npx vitest run tests/server/whoopService.test.ts
```
Expected: all tests FAIL with "Cannot find module"

- [ ] **Step 3: Write `server/lib/integrations/whoop/whoopService.ts`**

```typescript
import { ProviderTokens, tokensExpired } from '../shared/types'

const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const API_BASE  = 'https://api.prod.whoop.com'

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         'offline read:recovery read:sleep read:workout read:body_measurement',
    state,
  })
  return `https://api.prod.whoop.com/oauth/oauth2/auth?${p}`
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
  })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error(`Whoop token exchange failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + d.expires_in }
}

export async function refreshTokens(
  clientId: string, clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  if (!tokensExpired(tokens)) return tokens
  const body = new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId, client_secret: clientSecret,
  })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error(`Whoop token refresh failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + d.expires_in }
}

export interface WhoopRecovery {
  created_at:  string
  score_state: string
  score: {
    recovery_score:     number
    resting_heart_rate: number
    hrv_rmssd_milli:    number
  } | null
}

export interface WhoopSleep {
  start:       string
  end:         string
  nap:         boolean
  score_state: string
  score: {
    stage_summary: {
      total_in_bed_time_milli:          number
      total_awake_time_milli:           number
      total_light_sleep_time_milli:     number
      total_slow_wave_sleep_time_milli: number
      total_rem_sleep_time_milli:       number
    }
    respiratory_rate: number
  } | null
}

export interface WhoopWorkout {
  id:          string
  start:       string
  end:         string
  sport_id:    number
  score_state: string
  score: {
    average_heart_rate: number
    kilojoule:          number
    distance_meter?:    number
  } | null
}

export interface WhoopData {
  recovery: WhoopRecovery[]
  sleep:    WhoopSleep[]
  workouts: WhoopWorkout[]
}

async function fetchPaginated<T>(accessToken: string, path: string, start: string, end: string): Promise<T[]> {
  const all: T[] = []
  let nextToken: string | null = null
  do {
    const params = new URLSearchParams({ start, end, limit: '25' })
    if (nextToken) params.set('nextToken', nextToken)
    const res = await fetch(`${API_BASE}${path}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Whoop ${path} fetch failed: ${res.status}`)
    const data = await res.json() as { records: T[]; next_token: string | null }
    all.push(...data.records)
    nextToken = data.next_token
  } while (nextToken)
  return all
}

export async function fetchWhoopData(
  accessToken: string, startDate: string, endDate: string
): Promise<WhoopData> {
  const start = `${startDate}T00:00:00.000Z`
  const end   = `${endDate}T23:59:59.999Z`
  const [recovery, sleep, workouts] = await Promise.all([
    fetchPaginated<WhoopRecovery>(accessToken, '/v2/recovery',         start, end),
    fetchPaginated<WhoopSleep>   (accessToken, '/v2/activity/sleep',   start, end),
    fetchPaginated<WhoopWorkout> (accessToken, '/v2/activity/workout', start, end),
  ])
  return { recovery, sleep, workouts }
}
```

- [ ] **Step 4: Run service tests — confirm they pass**

```bash
npx vitest run tests/server/whoopService.test.ts
```
Expected: 5/5 PASS

- [ ] **Step 5: Write the failing Whoop processor tests**

Create `tests/server/whoopProcessor.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('whoopProcessor', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('toTypeKey maps Whoop sport IDs to Bacta type_key', async () => {
    const { toTypeKey } = await import('../../server/lib/integrations/whoop/whoopProcessor')
    expect(toTypeKey(1)).toBe('running')
    expect(toTypeKey(2)).toBe('cycling')
    expect(toTypeKey(40)).toBe('swimming')
    expect(toTypeKey(999)).toBe('workout') // fallback
  })

  it('processWhoopData writes recovery snapshots', async () => {
    const { processWhoopData } = await import('../../server/lib/integrations/whoop/whoopProcessor')
    const { default: db }      = await import('../../server/db/client')

    processWhoopData({
      recovery: [{ created_at: '2026-06-20T10:00:00.000Z', score_state: 'SCORED', score: { recovery_score: 75, resting_heart_rate: 56, hrv_rmssd_milli: 42.5 } }],
      sleep:    [],
      workouts: [],
    })

    const snap = (key: string) =>
      (db.prepare("SELECT value FROM health_snapshots WHERE date='2026-06-20' AND metric=? AND source='whoop'").get(key) as { value: number } | undefined)?.value

    expect(snap('readiness_score')).toBe(75)
    expect(snap('resting_hr')).toBe(56)
    expect(snap('hrv')).toBeCloseTo(42.5, 1)
  })

  it('processWhoopData writes sleep stage snapshots, skips naps', async () => {
    const { processWhoopData } = await import('../../server/lib/integrations/whoop/whoopProcessor')
    const { default: db }      = await import('../../server/db/client')

    const stages = { total_in_bed_time_milli: 28800000, total_awake_time_milli: 1800000, total_light_sleep_time_milli: 9000000, total_slow_wave_sleep_time_milli: 5400000, total_rem_sleep_time_milli: 10800000 }
    processWhoopData({
      recovery: [],
      sleep: [
        { start: '2026-06-21T00:00:00.000Z', end: '2026-06-21T07:30:00.000Z', nap: false, score_state: 'SCORED', score: { stage_summary: stages, respiratory_rate: 15 } },
        { start: '2026-06-21T13:00:00.000Z', end: '2026-06-21T13:30:00.000Z', nap: true,  score_state: 'SCORED', score: { stage_summary: stages, respiratory_rate: 14 } },
      ],
      workouts: [],
    })

    const rows = db.prepare("SELECT metric FROM health_snapshots WHERE date='2026-06-21' AND source='whoop'").all() as { metric: string }[]
    const metrics = rows.map(r => r.metric)
    expect(metrics).toContain('sleep_duration_s')
    expect(metrics).toContain('deep_sleep_s')
    expect(metrics).toContain('light_sleep_s')
    expect(metrics).toContain('rem_sleep_s')
    // Nap was skipped — only one set of sleep rows
    const sleepRows = db.prepare("SELECT COUNT(*) as n FROM health_snapshots WHERE date='2026-06-21' AND metric='sleep_duration_s' AND source='whoop'").get() as { n: number }
    expect(sleepRows.n).toBe(1)
  })

  it('processWhoopData writes workouts to health_activities', async () => {
    const { processWhoopData } = await import('../../server/lib/integrations/whoop/whoopProcessor')
    const { default: db }      = await import('../../server/db/client')

    processWhoopData({
      recovery: [],
      sleep:    [],
      workouts: [{
        id: 'workout-uuid-1', start: '2026-06-22T07:00:00.000Z', end: '2026-06-22T08:00:00.000Z',
        sport_id: 1, score_state: 'SCORED',
        score: { average_heart_rate: 148, kilojoule: 1200, distance_meter: 8000 },
      }],
    })

    const row = db.prepare("SELECT * FROM health_activities WHERE activity_id = 'workout-uuid-1'").get() as Record<string, unknown> | undefined
    expect(row).toBeDefined()
    expect(row?.type_key).toBe('running')
    expect(row?.duration_s).toBe(3600)
    expect(row?.avg_hr).toBe(148)
    expect(row?.calories).toBe(287) // Math.round(1200 * 0.239)
    expect(row?.distance_m).toBe(8000)
  })
})
```

- [ ] **Step 6: Run — confirm they fail**

```bash
npx vitest run tests/server/whoopProcessor.test.ts
```
Expected: all tests FAIL with "Cannot find module"

- [ ] **Step 7: Write `server/lib/integrations/whoop/whoopProcessor.ts`**

```typescript
import db from '../../../db/client'
import { WhoopData } from './whoopService'

const SPORT_MAP: Record<number, string> = {
  0:  'workout',
  1:  'running',
  2:  'cycling',
  18: 'rowing',
  28: 'cycling',
  32: 'climbing',
  36: 'skiing',
  37: 'sport',
  40: 'swimming',
  41: 'sport',
  50: 'yoga',
}

export function toTypeKey(sportId: number): string {
  return SPORT_MAP[sportId] ?? 'workout'
}

export function processWhoopData(data: WhoopData): number {
  const upsertSnapshot = db.prepare(
    `INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source) VALUES (?, ?, ?, ?, 'whoop')`
  )
  const upsertActivity = db.prepare(`
    INSERT OR REPLACE INTO health_activities
      (activity_id, source, date, start_time, name, type_key, distance_m, duration_s, calories, avg_hr, elevation_m)
    VALUES (?, 'whoop', ?, ?, ?, ?, ?, ?, ?, ?, null)
  `)

  let count = 0
  const run = db.transaction(() => {
    for (const r of data.recovery) {
      if (r.score_state !== 'SCORED' || !r.score) continue
      const day = r.created_at.slice(0, 10)
      upsertSnapshot.run(day, 'readiness_score', r.score.recovery_score,     'score'); count++
      upsertSnapshot.run(day, 'resting_hr',       r.score.resting_heart_rate, 'bpm');   count++
      upsertSnapshot.run(day, 'hrv',              r.score.hrv_rmssd_milli,    'ms');    count++
    }
    for (const s of data.sleep) {
      if (s.nap || s.score_state !== 'SCORED' || !s.score) continue
      const day    = s.end.slice(0, 10)
      const ss     = s.score.stage_summary
      const totalS = Math.round((ss.total_in_bed_time_milli - ss.total_awake_time_milli) / 1000)
      upsertSnapshot.run(day, 'sleep_duration_s', totalS,                                                       's'); count++
      upsertSnapshot.run(day, 'deep_sleep_s',     Math.round(ss.total_slow_wave_sleep_time_milli / 1000), 's'); count++
      upsertSnapshot.run(day, 'light_sleep_s',    Math.round(ss.total_light_sleep_time_milli / 1000),    's'); count++
      upsertSnapshot.run(day, 'rem_sleep_s',      Math.round(ss.total_rem_sleep_time_milli / 1000),      's'); count++
    }
    for (const w of data.workouts) {
      if (w.score_state !== 'SCORED' || !w.score) continue
      const day       = w.start.slice(0, 10)
      const durationS = Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 1000)
      const calories  = w.score.kilojoule > 0 ? Math.round(w.score.kilojoule * 0.239) : null
      const distanceM = w.score.distance_meter != null && w.score.distance_meter > 0 ? w.score.distance_meter : null
      const typeKey   = toTypeKey(w.sport_id)
      upsertActivity.run(w.id, day, w.start, `Whoop ${typeKey}`, typeKey, distanceM, durationS > 0 ? durationS : null, calories, w.score.average_heart_rate > 0 ? Math.round(w.score.average_heart_rate) : null)
      count++
    }
  })
  run()
  console.log(`[whoop] processed ${count} records`)
  return count
}
```

- [ ] **Step 8: Run processor tests — confirm they pass**

```bash
npx vitest run tests/server/whoopProcessor.test.ts
```
Expected: 4/4 PASS

- [ ] **Step 9: Type-check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add server/lib/integrations/whoop/ tests/server/whoopService.test.ts tests/server/whoopProcessor.test.ts
git commit -m "feat(whoop): add Whoop v2 service, processor, and tests"
```

---

### Task 3: Wire Oura + Whoop into integrations router + pollers + integration tests

**Files:**
- Modify: `server/api/integrations.ts` (3 switch statements + import additions)
- Create: `scripts/providers/oura/poller.py`
- Create: `scripts/providers/whoop/poller.py`
- Modify: `tests/server/integrations.test.ts` (add 4 new tests)

**Interfaces consumed:**
```typescript
// From ouraService.ts:
import { getAuthUrl as ouraAuthUrl, exchangeCode as ouraExchange, refreshTokens as ouraRefresh, fetchOuraData } from '../lib/integrations/oura/ouraService'
// From ouraProcessor.ts:
import { processOuraData } from '../lib/integrations/oura/ouraProcessor'
// From whoopService.ts:
import { getAuthUrl as whoopAuthUrl, exchangeCode as whoopExchange, refreshTokens as whoopRefresh, fetchWhoopData } from '../lib/integrations/whoop/whoopService'
// From whoopProcessor.ts:
import { processWhoopData } from '../lib/integrations/whoop/whoopProcessor'
```

- [ ] **Step 1: Write the failing integration tests**

Add to `tests/server/integrations.test.ts` (append inside the outer `describe` block, before the closing `}`):

```typescript
  it('GET /api/integrations/oura/authorize returns 400 when client_id not set', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/oura/authorize')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/client_id/)
  })

  it('GET /api/integrations/oura/authorize returns { url } when configured', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('oura_client_id', 'ouri123')").run()
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('base_url', 'http://bacta.home')").run()

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/oura/authorize')
    expect(res.status).toBe(200)
    expect(res.body.url).toContain('cloud.ouraring.com/oauth/authorize')
    expect(res.body.url).toContain('ouri123')
  })

  it('GET /api/integrations/whoop/authorize returns 400 when client_id not set', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/whoop/authorize')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/client_id/)
  })

  it('POST /api/integrations/oura/sync returns 400 when provider not connected', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .post('/api/integrations/oura/sync')
      .set('Authorization', 'Bearer test-internal-token')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not connected/)
  })
```

- [ ] **Step 2: Run — confirm the 4 new tests fail**

```bash
npx vitest run tests/server/integrations.test.ts
```
Expected: 9 pass (existing), 4 fail (new ones — "Provider not yet implemented")

- [ ] **Step 3: Update `server/api/integrations.ts`**

Add imports at the top (after the hevy imports, line 10):

```typescript
import { getAuthUrl as ouraAuthUrl, exchangeCode as ouraExchange, refreshTokens as ouraRefresh, fetchOuraData } from '../lib/integrations/oura/ouraService'
import { processOuraData } from '../lib/integrations/oura/ouraProcessor'
import { getAuthUrl as whoopAuthUrl, exchangeCode as whoopExchange, refreshTokens as whoopRefresh, fetchWhoopData } from '../lib/integrations/whoop/whoopService'
import { processWhoopData } from '../lib/integrations/whoop/whoopProcessor'
```

In the `authorize` switch (replace the `default` case placeholder comment):

```typescript
    case 'oura':  url = ouraAuthUrl (clientId, redirectUri, state); break
    case 'whoop': url = whoopAuthUrl(clientId, redirectUri, state); break
    // Phase 3 providers added here later
    default: return void res.status(400).json({ error: 'Provider not yet implemented' })
```

In the `callbackHandler` switch (replace the `default` case placeholder comment):

```typescript
      case 'oura':
        tokens = await ouraExchange(clientId, clientSecret, code, redirectUri)
        break
      case 'whoop':
        tokens = await whoopExchange(clientId, clientSecret, code, redirectUri)
        break
      // Phase 3 providers added here later
      default:
        return void res.redirect(`${baseUrl}/#/settings?error=${provider}`)
```

In the `runSync` switch (replace the `// Phases 2 and 3 providers added here later` comment and `default` case):

```typescript
    case 'oura': {
      const tokens = getTokens('oura')
      if (!tokens) throw new Error('Oura not connected')
      const clientId     = getSetting('oura_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('oura_client_secret') ?? '') ?? ''
      const fresh = await ouraRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('oura', fresh)
      const today = new Date().toISOString().slice(0, 10)
      const data  = await fetchOuraData(fresh.access_token, daysAgo(30), today)
      return processOuraData(data)
    }

    case 'whoop': {
      const tokens = getTokens('whoop')
      if (!tokens) throw new Error('Whoop not connected')
      const clientId     = getSetting('whoop_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('whoop_client_secret') ?? '') ?? ''
      const fresh = await whoopRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('whoop', fresh)
      const today = new Date().toISOString().slice(0, 10)
      const data  = await fetchWhoopData(fresh.access_token, daysAgo(30), today)
      return processWhoopData(data)
    }

    // Phase 3 providers added here later
    default:
      throw new Error(`Sync not yet implemented for ${provider}`)
```

- [ ] **Step 4: Run integration tests — confirm all 13 pass**

```bash
npx vitest run tests/server/integrations.test.ts
```
Expected: 13/13 PASS

- [ ] **Step 5: Run full server test suite**

```bash
npx vitest run tests/server/
```
Expected: all tests pass (should be 215 total server — 193 + 22 new: 5 ouraService + 4 ouraProcessor + 5 whoopService + 4 whoopProcessor + 4 integrations)

- [ ] **Step 6: Type-check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors

- [ ] **Step 7: Write `scripts/providers/oura/poller.py`**

```python
import os
import sys
import requests

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')

def main():
    r = requests.post(
        f'{BASE_URL}/api/integrations/oura/sync',
        headers={'Authorization': f'Bearer {TOKEN}'},
        timeout=120,
    )
    if not r.ok:
        print(f'[oura] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)
    data = r.json()
    print(f'[oura] synced: {data.get("recordsWritten", "?")} records written')

if __name__ == '__main__':
    main()
```

- [ ] **Step 8: Write `scripts/providers/whoop/poller.py`**

```python
import os
import sys
import requests

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')

def main():
    r = requests.post(
        f'{BASE_URL}/api/integrations/whoop/sync',
        headers={'Authorization': f'Bearer {TOKEN}'},
        timeout=120,
    )
    if not r.ok:
        print(f'[whoop] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)
    data = r.json()
    print(f'[whoop] synced: {data.get("recordsWritten", "?")} records written')

if __name__ == '__main__':
    main()
```

- [ ] **Step 9: Validate Python syntax**

```bash
python3 -c "import py_compile; py_compile.compile('scripts/providers/oura/poller.py', doraise=True)"
python3 -c "import py_compile; py_compile.compile('scripts/providers/whoop/poller.py', doraise=True)"
```
Expected: no output (no errors)

- [ ] **Step 10: Run full test suite one final time**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 11: Commit**

```bash
git add server/api/integrations.ts tests/server/integrations.test.ts scripts/providers/oura/ scripts/providers/whoop/
git commit -m "feat(integrations): wire Oura + Whoop into router, add pollers and integration tests"
```
