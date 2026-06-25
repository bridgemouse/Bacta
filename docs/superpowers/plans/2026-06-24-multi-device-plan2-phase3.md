# Multi-Device Integration Layer — Plan 2 Phase 3 (Polar + Withings)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Polar and Withings as health data sources, following the exact file/pattern structure established in Phases 1 and 2.

**Architecture:** Each provider gets a service file (HTTP client + OAuth + data fetch) and a processor file (DB writes). Both are wired into the existing `server/api/integrations.ts` by adding cases to three switch statements where "Phase 3 providers added here later" comments currently live. Python pollers follow the same thin 20-line pattern from Phases 1 and 2.

**Tech Stack:** TypeScript, Express, better-sqlite3, Node fetch API, Vitest

## Global Constraints

- Branch: `feature/multi-device` — never commit directly to main
- `INSERT OR REPLACE` for all `health_snapshots` and `health_activities` writes; source = `'polar'` or `'withings'`
- All `db.prepare()` calls MUST be inside function bodies (lazy init) — not at module level
- **Polar auth:** token exchange uses HTTP Basic auth — `Authorization: Basic base64(clientId:clientSecret)` — same as Oura. No `expires_in` in Polar token response — set `expires_at = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600` (10 years)
- **Polar refresh:** tokens are long-lived; `refreshTokens` always returns the same tokens unchanged (no API call)
- **Polar registration:** after exchanging code, `exchangeCode` must POST to `https://www.polaraccesslink.com/v3/users` with XML body `<?xml version="1.0" encoding="UTF-8"?><register><member-id>{x_user_id}</member-id></register>` where `x_user_id` comes from the token response; HTTP 409 = already registered = treat as success
- **Withings auth:** token exchange/refresh uses `application/x-www-form-urlencoded` body with `action=requesttoken` plus `client_id`, `client_secret`, and `grant_type` in the body (no Basic auth header)
- **Withings tokens:** response is `{ status: 0, body: { access_token, refresh_token, expires_in } }`; non-zero `status` = error; convert `expires_in` to `expires_at = Math.floor(Date.now() / 1000) + body.expires_in`
- **Withings measurements:** response wraps as `{ status: 0, body: { measuregrps: [...] } }`; each `measuregrp` has `date` (Unix epoch) and `measures: [{value, type, unit}]`; actual value = `measure.value * Math.pow(10, measure.unit)`
- Test files: set `process.env.DB_PATH = ':memory:'` at the top (before imports). Service tests mock fetch with `vi.stubGlobal`. Processor tests call `migrate()` in `beforeAll`.
- Run a single test file: `npx vitest run tests/server/<file>.test.ts`
- Run full suite: `npm test`
- Type-check: `npx tsc -p tsconfig.server.json --noEmit`
- Existing test count: 385 passing (215 server + 170 client)

---

### Task 1: Polar service + processor + tests

**Files:**
- Create: `server/lib/integrations/polar/polarService.ts`
- Create: `server/lib/integrations/polar/polarProcessor.ts`
- Create: `tests/server/polarService.test.ts`
- Create: `tests/server/polarProcessor.test.ts`

**Interfaces produced (used by Task 3):**
```typescript
// polarService.ts exports:
export function getAuthUrl(clientId: string, redirectUri: string, state: string): string
export async function exchangeCode(clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<ProviderTokens>
export async function refreshTokens(clientId: string, clientSecret: string, tokens: ProviderTokens): Promise<ProviderTokens>
export async function fetchPolarData(accessToken: string, startDate: string, endDate: string): Promise<PolarData>

// polarProcessor.ts exports:
export function processPolarData(data: PolarData): number
```

- [ ] **Step 1: Write the failing Polar service tests**

Create `tests/server/polarService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('polarService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Polar OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/polar/polarService')
    const url = getAuthUrl('client123', 'http://bacta.home/api/integrations/polar/callback', 'state-abc')
    expect(url).toContain('https://flow.polar.com/oauth2/authorization')
    expect(url).toContain('client_id=client123')
    expect(url).toContain('state=state-abc')
  })

  it('exchangeCode uses Basic auth, registers user, and returns tokens with far-future expires_at', async () => {
    // First call: token exchange
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'acc', token_type: 'Bearer', x_user_id: 42 }),
    } as Response)
    // Second call: user registration → 200 OK
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/polar/polarService')
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')

    // Verify Basic auth on token exchange call
    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['Authorization']).toMatch(/^Basic /)
    const decoded = Buffer.from(headers['Authorization'].replace('Basic ', ''), 'base64').toString()
    expect(decoded).toBe('cid:csec')

    // Verify registration call was made
    expect(vi.mocked(fetch).mock.calls.length).toBe(2)
    const regUrl = vi.mocked(fetch).mock.calls[1][0] as string
    expect(regUrl).toContain('/v3/users')

    // Verify tokens
    expect(tokens.access_token).toBe('acc')
    const tenYears = 10 * 365 * 24 * 3600
    expect(tokens.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + tenYears - 60)
  })

  it('exchangeCode treats 409 registration response as success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'acc', token_type: 'Bearer', x_user_id: 42 }),
    } as Response)
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/polar/polarService')
    // Should not throw on 409
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')
    expect(tokens.access_token).toBe('acc')
  })

  it('refreshTokens returns same tokens without calling fetch (long-lived)', async () => {
    const { refreshTokens } = await import('../../server/lib/integrations/polar/polarService')
    const tenYears = 10 * 365 * 24 * 3600
    const tokens = { access_token: 'acc', refresh_token: '', expires_at: Math.floor(Date.now() / 1000) + tenYears }
    const result = await refreshTokens('cid', 'csec', tokens)
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toBe(tokens)
  })

  it('fetchPolarData fetches exercises, sleep, and nightly-recharge in parallel', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ exercises: [
          { id: 'ex1', start_time: '2024-01-10T07:00:00.000Z', duration: 'PT1H0M0S',
            sport: 'RUNNING', distance: 10000.0,
            heart_rate: { average: 145 }, calories: 500 }
        ]})
      } as Response)
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ nights: [
          { date: '2024-01-10', sleep_summary: {
            total_sleep_time: 25200, deep_sleep_time: 7200,
            light_sleep_time: 14400, rem_time: 3600,
            sleep_score: 82, breathing_rate_avg: 14.2,
            heart_rate: { average: 52 }
          }}
        ]})
      } as Response)
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ recharges: [
          { date: '2024-01-10', heart_rate_avg: 52, heart_rate_variability_sdnn: 44.5 }
        ]})
      } as Response)

    const { fetchPolarData } = await import('../../server/lib/integrations/polar/polarService')
    const data = await fetchPolarData('tok', '2024-01-01', '2024-01-10')
    expect(data.exercises).toHaveLength(1)
    expect(data.nights).toHaveLength(1)
    expect(data.recharges).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/server/polarService.test.ts
```
Expected: fail with "Cannot find module"

- [ ] **Step 3: Write the failing Polar processor tests**

Create `tests/server/polarProcessor.test.ts`:

```typescript
process.env.DB_PATH = ':memory:'

import { describe, it, expect, beforeAll } from 'vitest'
import { migrate } from '../../server/db/migrate'

describe('polarProcessor', () => {
  beforeAll(() => { migrate() })

  it('writes exercise to health_activities', async () => {
    const db = (await import('../../server/db/client')).default
    const { processPolarData } = await import('../../server/lib/integrations/polar/polarProcessor')

    const count = processPolarData({
      exercises: [{ id: 'ex1', start_time: '2024-01-10T07:00:00.000Z', duration: 'PT1H0M0S',
        sport: 'RUNNING', distance: 10000.0, heart_rate: { average: 145 }, calories: 500 }],
      nights: [],
      recharges: [],
    })
    expect(count).toBe(1)
    const row = db.prepare("SELECT * FROM health_activities WHERE activity_id = 'ex1'").get() as Record<string, unknown>
    expect(row.type_key).toBe('running')
    expect(row.duration_s).toBe(3600)
    expect(row.source).toBe('polar')
  })

  it('writes sleep snapshots from nights', async () => {
    const db = (await import('../../server/db/client')).default
    const { processPolarData } = await import('../../server/lib/integrations/polar/polarProcessor')

    processPolarData({
      exercises: [],
      nights: [{ date: '2024-01-11', sleep_summary: {
        total_sleep_time: 25200, deep_sleep_time: 7200, light_sleep_time: 14400,
        rem_time: 3600, sleep_score: 82, breathing_rate_avg: 14.2,
        heart_rate: { average: 52 },
      }}],
      recharges: [],
    })
    const rows = db.prepare(
      "SELECT metric, value FROM health_snapshots WHERE date = '2024-01-11' AND source = 'polar'"
    ).all() as { metric: string; value: number }[]
    const map = Object.fromEntries(rows.map(r => [r.metric, r.value]))
    expect(map.sleep_duration_s).toBe(25200)
    expect(map.deep_sleep_s).toBe(7200)
    expect(map.sleep_score).toBe(82)
  })

  it('writes resting_hr and hrv from nightly-recharge', async () => {
    const db = (await import('../../server/db/client')).default
    const { processPolarData } = await import('../../server/lib/integrations/polar/polarProcessor')

    processPolarData({
      exercises: [],
      nights: [],
      recharges: [{ date: '2024-01-12', heart_rate_avg: 48, heart_rate_variability_sdnn: 55.0 }],
    })
    const rows = db.prepare(
      "SELECT metric, value FROM health_snapshots WHERE date = '2024-01-12' AND source = 'polar'"
    ).all() as { metric: string; value: number }[]
    const map = Object.fromEntries(rows.map(r => [r.metric, r.value]))
    expect(map.resting_hr).toBe(48)
    expect(map.hrv).toBe(55.0)
  })

  it('skips null/missing fields in nights', async () => {
    const db = (await import('../../server/db/client')).default
    const { processPolarData } = await import('../../server/lib/integrations/polar/polarProcessor')

    processPolarData({
      exercises: [],
      nights: [{ date: '2024-01-13', sleep_summary: {
        total_sleep_time: null, deep_sleep_time: null, light_sleep_time: null,
        rem_time: null, sleep_score: null, breathing_rate_avg: null,
        heart_rate: null,
      }}],
      recharges: [],
    })
    const rows = db.prepare(
      "SELECT metric FROM health_snapshots WHERE date = '2024-01-13' AND source = 'polar'"
    ).all()
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx vitest run tests/server/polarProcessor.test.ts
```
Expected: fail with "Cannot find module"

- [ ] **Step 5: Implement `polarService.ts`**

Create `server/lib/integrations/polar/polarService.ts`:

```typescript
import { ProviderTokens } from '../shared/types'

const BASE_ACCESSLINK = 'https://www.polaraccesslink.com'

function basicAuth(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    state,
  })
  return `https://flow.polar.com/oauth2/authorization?${p.toString()}`
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
  const res = await fetch('https://polarremote.com/v2/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization':  basicAuth(clientId, clientSecret),
      'Content-Type':   'application/x-www-form-urlencoded',
      'Accept':         'application/json',
    },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Polar token exchange failed: ${res.status}`)
  const d = await res.json() as { access_token: string; token_type: string; x_user_id: number }

  // Register user — 409 = already registered = OK
  const regRes = await fetch(`${BASE_ACCESSLINK}/v3/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${d.access_token}`,
      'Content-Type':  'application/xml',
      'Accept':        'application/json',
    },
    body: `<?xml version="1.0" encoding="UTF-8"?><register><member-id>${d.x_user_id}</member-id></register>`,
  })
  if (!regRes.ok && regRes.status !== 409) {
    throw new Error(`Polar user registration failed: ${regRes.status}`)
  }

  const tenYears = 10 * 365 * 24 * 3600
  return {
    access_token:  d.access_token,
    refresh_token: '',
    expires_at:    Math.floor(Date.now() / 1000) + tenYears,
  }
}

// Polar tokens are long-lived — no refresh needed
export async function refreshTokens(
  _clientId: string, _clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  return tokens
}

export interface PolarExercise {
  id:           string
  start_time:   string
  duration:     string  // ISO 8601 duration: "PT1H0M0S"
  sport:        string
  distance:     number | null
  heart_rate:   { average: number } | null
  calories:     number | null
}

export interface PolarNight {
  date:          string
  sleep_summary: {
    total_sleep_time:    number | null
    deep_sleep_time:     number | null
    light_sleep_time:    number | null
    rem_time:            number | null
    sleep_score:         number | null
    breathing_rate_avg:  number | null
    heart_rate:          { average: number } | null
  }
}

export interface PolarRecharge {
  date:                          string
  heart_rate_avg:                number | null
  heart_rate_variability_sdnn:   number | null
}

export interface PolarData {
  exercises: PolarExercise[]
  nights:    PolarNight[]
  recharges: PolarRecharge[]
}

async function getCollection<T>(accessToken: string, path: string, startDate: string, endDate: string, key: string): Promise<T[]> {
  const p = new URLSearchParams({ date_start: startDate, date_end: endDate })
  const res = await fetch(`${BASE_ACCESSLINK}${path}?${p.toString()}`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Polar ${path} failed: ${res.status}`)
  const d = await res.json() as Record<string, T[]>
  return d[key] ?? []
}

export async function fetchPolarData(accessToken: string, startDate: string, endDate: string): Promise<PolarData> {
  const [exercises, nights, recharges] = await Promise.all([
    getCollection<PolarExercise>(accessToken, '/v3/exercises',              startDate, endDate, 'exercises'),
    getCollection<PolarNight>   (accessToken, '/v3/users/sleep',            startDate, endDate, 'nights'),
    getCollection<PolarRecharge>(accessToken, '/v3/users/nightly-recharge', startDate, endDate, 'recharges'),
  ])
  // Filter exercises by start_time (exercises endpoint may not support date_start)
  const filtered = exercises.filter(e => e.start_time >= `${startDate}T00:00:00`)
  return { exercises: filtered, nights, recharges }
}
```

- [ ] **Step 6: Implement `polarProcessor.ts`**

Create `server/lib/integrations/polar/polarProcessor.ts`:

```typescript
import db from '../../db/client'
import { PolarData } from './polarService'

function parseDuration(dur: string): number {
  const m = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0')
}

const SPORT_MAP: Record<string, string> = {
  RUNNING:              'running',
  TRAIL_RUNNING:        'trail_running',
  CYCLING:              'cycling',
  MOUNTAIN_BIKING:      'cycling',
  SWIMMING:             'swimming',
  STRENGTH_TRAINING:    'strength_training',
  WALKING:              'walking',
  HIKING:               'hiking',
  CROSS_COUNTRY_SKIING: 'cross_country_skiing',
  OTHER:                'workout',
}

function toTypeKey(sport: string): string {
  return SPORT_MAP[sport] ?? 'workout'
}

export function processPolarData(data: PolarData): number {
  let count = 0

  const upsertActivity = db.prepare(`
    INSERT OR REPLACE INTO health_activities
      (activity_id, date, start_time, name, type_key, duration_s, distance_meter, calories, avg_hr, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'polar')
  `)

  const upsertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source)
    VALUES (?, ?, ?, ?, 'polar')
  `)

  db.transaction(() => {
    for (const ex of data.exercises) {
      const date = ex.start_time.slice(0, 10)
      const name = ex.sport.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      upsertActivity.run(
        ex.id, date, ex.start_time, name, toTypeKey(ex.sport),
        parseDuration(ex.duration),
        ex.distance ?? null,
        ex.calories ?? null,
        ex.heart_rate?.average ?? null,
      )
      count++
    }

    for (const night of data.nights) {
      const s = night.sleep_summary
      const rows: [string, number | null, string][] = [
        ['sleep_duration_s', s.total_sleep_time,   's'],
        ['deep_sleep_s',     s.deep_sleep_time,    's'],
        ['light_sleep_s',    s.light_sleep_time,   's'],
        ['rem_sleep_s',      s.rem_time,           's'],
        ['sleep_score',      s.sleep_score,        'score'],
        ['respiration',      s.breathing_rate_avg, 'rpm'],
      ]
      for (const [metric, value, unit] of rows) {
        if (value == null) continue
        upsertSnapshot.run(night.date, metric, value, unit)
        count++
      }
    }

    for (const r of data.recharges) {
      if (r.heart_rate_avg != null) {
        upsertSnapshot.run(r.date, 'resting_hr', r.heart_rate_avg, 'bpm')
        count++
      }
      if (r.heart_rate_variability_sdnn != null) {
        upsertSnapshot.run(r.date, 'hrv', r.heart_rate_variability_sdnn, 'ms')
        count++
      }
    }
  })()

  return count
}
```

- [ ] **Step 7: Run both Polar test files**

```bash
npx vitest run tests/server/polarService.test.ts tests/server/polarProcessor.test.ts
```
Expected: 9/9 passing (5 service + 4 processor)

- [ ] **Step 8: Type-check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add server/lib/integrations/polar/ tests/server/polarService.test.ts tests/server/polarProcessor.test.ts
git commit -m "feat(polar): add Polar Access Link service, processor, and tests"
```

---

### Task 2: Withings service + processor + tests

**Files:**
- Create: `server/lib/integrations/withings/withingsService.ts`
- Create: `server/lib/integrations/withings/withingsProcessor.ts`
- Create: `tests/server/withingsService.test.ts`
- Create: `tests/server/withingsProcessor.test.ts`

**Interfaces produced (used by Task 3):**
```typescript
// withingsService.ts exports:
export function getAuthUrl(clientId: string, redirectUri: string, state: string): string
export async function exchangeCode(clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<ProviderTokens>
export async function refreshTokens(clientId: string, clientSecret: string, tokens: ProviderTokens): Promise<ProviderTokens>
export async function fetchWithingsData(accessToken: string, startDate: string, endDate: string): Promise<WithingsMeasureGroup[]>

// withingsProcessor.ts exports:
export function processWithingsData(groups: WithingsMeasureGroup[]): number
```

- [ ] **Step 1: Write the failing Withings service tests**

Create `tests/server/withingsService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('withingsService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Withings OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/withings/withingsService')
    const url = getAuthUrl('wid', 'http://bacta.home/api/integrations/withings/callback', 'st8')
    expect(url).toContain('https://account.withings.com/oauth2_user/authorize2')
    expect(url).toContain('client_id=wid')
    expect(url).toContain('state=st8')
  })

  it('exchangeCode sends action=requesttoken and returns tokens with expires_at', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: { access_token: 'acc', refresh_token: 'ref', expires_in: 10800 },
      }),
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/withings/withingsService')
    const before = Math.floor(Date.now() / 1000)
    const tokens = await exchangeCode('wid', 'wsec', 'code123', 'http://redirect')
    const after  = Math.floor(Date.now() / 1000)

    // Verify body contains action=requesttoken
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as string
    expect(body).toContain('action=requesttoken')
    expect(body).toContain('client_id=wid')
    expect(body).not.toContain('Authorization')

    expect(tokens.access_token).toBe('acc')
    expect(tokens.expires_at).toBeGreaterThanOrEqual(before + 10800)
    expect(tokens.expires_at).toBeLessThanOrEqual(after + 10800)
  })

  it('exchangeCode throws on non-zero Withings status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 503, body: {} }),
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/withings/withingsService')
    await expect(exchangeCode('wid', 'wsec', 'code', 'http://redirect')).rejects.toThrow('503')
  })

  it('refreshTokens sends action=requesttoken with refresh_token grant', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: { access_token: 'new', refresh_token: 'newref', expires_in: 10800 },
      }),
    } as Response)

    const { refreshTokens } = await import('../../server/lib/integrations/withings/withingsService')
    const tokens = { access_token: 'old', refresh_token: 'ref', expires_at: 0 }
    const fresh  = await refreshTokens('wid', 'wsec', tokens)

    const body = vi.mocked(fetch).mock.calls[0][1]?.body as string
    expect(body).toContain('action=requesttoken')
    expect(body).toContain('grant_type=refresh_token')
    expect(body).toContain('refresh_token=ref')
    expect(fresh.access_token).toBe('new')
  })

  it('fetchWithingsData returns parsed measure groups', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: {
          measuregrps: [
            {
              date: 1704844800,
              measures: [
                { value: 70750, type: 1, unit: -3 },  // 70.75 kg
                { value: 62, type: 11, unit: 0 },     // 62 bpm
              ],
            },
          ],
        },
      }),
    } as Response)

    const { fetchWithingsData } = await import('../../server/lib/integrations/withings/withingsService')
    const groups = await fetchWithingsData('tok', '2024-01-01', '2024-01-10')
    expect(groups).toHaveLength(1)
    expect(groups[0].measures).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/server/withingsService.test.ts
```
Expected: fail with "Cannot find module"

- [ ] **Step 3: Write the failing Withings processor tests**

Create `tests/server/withingsProcessor.test.ts`:

```typescript
process.env.DB_PATH = ':memory:'

import { describe, it, expect, beforeAll } from 'vitest'
import { migrate } from '../../server/db/migrate'

describe('withingsProcessor', () => {
  beforeAll(() => { migrate() })

  it('writes weight_kg from meastype 1', async () => {
    const db = (await import('../../server/db/client')).default
    const { processWithingsData } = await import('../../server/lib/integrations/withings/withingsProcessor')

    processWithingsData([{ date: 1704844800, measures: [{ value: 70750, type: 1, unit: -3 }] }])
    const row = db.prepare(
      "SELECT value FROM health_snapshots WHERE metric = 'weight_kg' AND source = 'withings'"
    ).get() as { value: number } | undefined
    expect(row).toBeDefined()
    expect(row!.value).toBeCloseTo(70.75, 2)
  })

  it('writes resting_hr from meastype 11', async () => {
    const db = (await import('../../server/db/client')).default
    const { processWithingsData } = await import('../../server/lib/integrations/withings/withingsProcessor')

    processWithingsData([{ date: 1704931200, measures: [{ value: 58, type: 11, unit: 0 }] }])
    const row = db.prepare(
      "SELECT value FROM health_snapshots WHERE metric = 'resting_hr' AND source = 'withings'"
    ).get() as { value: number } | undefined
    expect(row).toBeDefined()
    expect(row!.value).toBe(58)
  })

  it('writes spo2 from meastype 54', async () => {
    const db = (await import('../../server/db/client')).default
    const { processWithingsData } = await import('../../server/lib/integrations/withings/withingsProcessor')

    processWithingsData([{ date: 1705017600, measures: [{ value: 9800, type: 54, unit: -2 }] }])
    const row = db.prepare(
      "SELECT value FROM health_snapshots WHERE metric = 'spo2' AND source = 'withings'"
    ).get() as { value: number } | undefined
    expect(row).toBeDefined()
    expect(row!.value).toBeCloseTo(98.0, 1)
  })

  it('skips unknown meastype', async () => {
    const db = (await import('../../server/db/client')).default
    const { processWithingsData } = await import('../../server/lib/integrations/withings/withingsProcessor')

    const count = processWithingsData([{ date: 1705104000, measures: [{ value: 999, type: 99, unit: 0 }] }])
    expect(count).toBe(0)
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx vitest run tests/server/withingsProcessor.test.ts
```
Expected: fail with "Cannot find module"

- [ ] **Step 5: Implement `withingsService.ts`**

Create `server/lib/integrations/withings/withingsService.ts`:

```typescript
import { ProviderTokens, tokensExpired } from '../shared/types'

const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2'
const MEASURE_URL = 'https://wbsapi.withings.net/measure'

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         'user.info,user.metrics',
    state,
  })
  return `https://account.withings.com/oauth2_user/authorize2?${p.toString()}`
}

async function tokenRequest(body: URLSearchParams): Promise<ProviderTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Withings token request failed: ${res.status}`)
  const d = await res.json() as { status: number; body: { access_token: string; refresh_token: string; expires_in: number } }
  if (d.status !== 0) throw new Error(`Withings token error status: ${d.status}`)
  return {
    access_token:  d.body.access_token,
    refresh_token: d.body.refresh_token,
    expires_at:    Math.floor(Date.now() / 1000) + d.body.expires_in,
  }
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  return tokenRequest(new URLSearchParams({
    action:        'requesttoken',
    grant_type:    'authorization_code',
    client_id:     clientId,
    client_secret: clientSecret,
    code,
    redirect_uri:  redirectUri,
  }))
}

export async function refreshTokens(
  clientId: string, clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  if (!tokensExpired(tokens)) return tokens
  return tokenRequest(new URLSearchParams({
    action:        'requesttoken',
    grant_type:    'refresh_token',
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
  }))
}

export interface WithingsMeasure {
  value: number
  type:  number
  unit:  number
}

export interface WithingsMeasureGroup {
  date:     number  // Unix epoch
  measures: WithingsMeasure[]
}

export async function fetchWithingsData(
  accessToken: string, startDate: string, endDate: string
): Promise<WithingsMeasureGroup[]> {
  const startEpoch = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)
  const endEpoch   = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000)

  const body = new URLSearchParams({
    action:    'getmeas',
    meastype:  '1,11,54',
    startdate: String(startEpoch),
    enddate:   String(endEpoch),
    category:  '1',
  })

  const res = await fetch(MEASURE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Withings measure failed: ${res.status}`)
  const d = await res.json() as { status: number; body: { measuregrps: WithingsMeasureGroup[] } }
  if (d.status !== 0) throw new Error(`Withings measure error status: ${d.status}`)
  return d.body.measuregrps ?? []
}
```

- [ ] **Step 6: Implement `withingsProcessor.ts`**

Create `server/lib/integrations/withings/withingsProcessor.ts`:

```typescript
import db from '../../db/client'
import { WithingsMeasureGroup } from './withingsService'

const MEAS_TYPE: Record<number, { metric: string; unit: string }> = {
  1:  { metric: 'weight_kg',  unit: 'kg'  },
  11: { metric: 'resting_hr', unit: 'bpm' },
  54: { metric: 'spo2',       unit: '%'   },
}

export function processWithingsData(groups: WithingsMeasureGroup[]): number {
  let count = 0

  const upsertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source)
    VALUES (?, ?, ?, ?, 'withings')
  `)

  db.transaction(() => {
    for (const grp of groups) {
      const date = new Date(grp.date * 1000).toISOString().slice(0, 10)
      for (const m of grp.measures) {
        const def = MEAS_TYPE[m.type]
        if (!def) continue
        const value = Math.round(m.value * Math.pow(10, m.unit) * 1000) / 1000
        upsertSnapshot.run(date, def.metric, value, def.unit)
        count++
      }
    }
  })()

  return count
}
```

- [ ] **Step 7: Run both Withings test files**

```bash
npx vitest run tests/server/withingsService.test.ts tests/server/withingsProcessor.test.ts
```
Expected: 9/9 passing (5 service + 4 processor)

- [ ] **Step 8: Type-check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add server/lib/integrations/withings/ tests/server/withingsService.test.ts tests/server/withingsProcessor.test.ts
git commit -m "feat(withings): add Withings service, processor, and tests"
```

---

### Task 3: Wire Polar + Withings into integrations router, add pollers, extend integration tests

**Files:**
- Modify: `server/api/integrations.ts` (imports + 3 switch statements)
- Modify: `tests/server/integrations.test.ts` (4 new tests)
- Create: `scripts/providers/polar/poller.py`
- Create: `scripts/providers/withings/poller.py`

**What Task 3 depends on from Tasks 1–2:**
- `getAuthUrl as polarAuthUrl`, `exchangeCode as polarExchange`, `refreshTokens as polarRefresh`, `fetchPolarData` from `'../lib/integrations/polar/polarService'`
- `processPolarData` from `'../lib/integrations/polar/polarProcessor'`
- `getAuthUrl as withingsAuthUrl`, `exchangeCode as withingsExchange`, `refreshTokens as withingsRefresh`, `fetchWithingsData` from `'../lib/integrations/withings/withingsService'`
- `processWithingsData` from `'../lib/integrations/withings/withingsProcessor'`

- [ ] **Step 1: Add imports to integrations.ts**

In `server/api/integrations.ts`, after the whoop imports (lines 13–14), add:

```typescript
import { getAuthUrl as polarAuthUrl, exchangeCode as polarExchange, refreshTokens as polarRefresh, fetchPolarData } from '../lib/integrations/polar/polarService'
import { processPolarData } from '../lib/integrations/polar/polarProcessor'
import { getAuthUrl as withingsAuthUrl, exchangeCode as withingsExchange, refreshTokens as withingsRefresh, fetchWithingsData } from '../lib/integrations/withings/withingsService'
import { processWithingsData } from '../lib/integrations/withings/withingsProcessor'
```

- [ ] **Step 2: Extend the authorize switch**

In `server/api/integrations.ts`, find the authorize switch (around line 95). Replace the `// Phase 3 providers added here later` comment before the `default` case with:

```typescript
    case 'polar':    url = polarAuthUrl   (clientId, redirectUri, state); break
    case 'withings': url = withingsAuthUrl(clientId, redirectUri, state); break
```

- [ ] **Step 3: Extend the callback switch**

In `callbackHandler`, find the callback switch (around line 214). Replace the `// Phase 3 providers added here later` comment before the `default` case with:

```typescript
      case 'polar':
        tokens = await polarExchange(clientId, clientSecret, code, redirectUri)
        break
      case 'withings':
        tokens = await withingsExchange(clientId, clientSecret, code, redirectUri)
        break
```

- [ ] **Step 4: Extend the runSync switch**

In `runSync()`, find the switch (around line 135). Replace the `// Phase 3 providers added here later` comment before the `default` case with:

```typescript
    case 'polar': {
      const tokens = getTokens('polar')
      if (!tokens) throw new Error('Polar not connected')
      const clientId     = getSetting('polar_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('polar_client_secret') ?? '') ?? ''
      const fresh = await polarRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('polar', fresh)
      const today = new Date().toISOString().slice(0, 10)
      const data  = await fetchPolarData(fresh.access_token, daysAgo(30), today)
      return processPolarData(data)
    }

    case 'withings': {
      const tokens = getTokens('withings')
      if (!tokens) throw new Error('Withings not connected')
      const clientId     = getSetting('withings_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('withings_client_secret') ?? '') ?? ''
      const fresh = await withingsRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('withings', fresh)
      const today = new Date().toISOString().slice(0, 10)
      const groups = await fetchWithingsData(fresh.access_token, daysAgo(30), today)
      return processWithingsData(groups)
    }
```

- [ ] **Step 5: Add 4 integration tests**

In `tests/server/integrations.test.ts`, inside the existing `describe` block, before the final `})`, append:

```typescript
  describe('polar', () => {
    it('GET /api/integrations/polar/authorize returns 400 without client_id', async () => {
      await request(app).put('/api/settings').send({ key: 'base_url', value: 'http://bacta.home' })
      await request(app).put('/api/settings').send({ key: 'polar_client_id', value: '' })
      const res = await request(app).get('/api/integrations/polar/authorize')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/client_id/)
    })

    it('GET /api/integrations/polar/authorize returns { url } when configured', async () => {
      await request(app).put('/api/settings').send({ key: 'base_url', value: 'http://bacta.home' })
      await request(app).put('/api/settings').send({ key: 'polar_client_id', value: 'pol123' })
      const res = await request(app).get('/api/integrations/polar/authorize')
      expect(res.status).toBe(200)
      expect(res.body.url).toContain('flow.polar.com')
      expect(res.body.url).toContain('pol123')
    })
  })

  describe('withings', () => {
    it('GET /api/integrations/withings/authorize returns 400 without client_id', async () => {
      await request(app).put('/api/settings').send({ key: 'base_url', value: 'http://bacta.home' })
      await request(app).put('/api/settings').send({ key: 'withings_client_id', value: '' })
      const res = await request(app).get('/api/integrations/withings/authorize')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/client_id/)
    })

    it('POST /api/integrations/withings/sync returns 400 when not connected', async () => {
      const token = process.env.BACTA_INTERNAL_TOKEN ?? ''
      const res = await request(app)
        .post('/api/integrations/withings/sync')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not connected/)
    })
  })
```

- [ ] **Step 6: Create Polar poller**

Create `scripts/providers/polar/poller.py`:

```python
import os
import sys
import requests

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')
PROVIDER = 'polar'

def main():
    r = requests.post(
        f'{BASE_URL}/api/integrations/{PROVIDER}/sync',
        headers={'Authorization': f'Bearer {TOKEN}'},
        timeout=120,
    )
    if not r.ok:
        print(f'[{PROVIDER}] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)
    data = r.json()
    print(f'[{PROVIDER}] synced: {data.get("recordsWritten", "?")} records written')

if __name__ == '__main__':
    main()
```

- [ ] **Step 7: Create Withings poller**

Create `scripts/providers/withings/poller.py`:

```python
import os
import sys
import requests

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')
PROVIDER = 'withings'

def main():
    r = requests.post(
        f'{BASE_URL}/api/integrations/{PROVIDER}/sync',
        headers={'Authorization': f'Bearer {TOKEN}'},
        timeout=120,
    )
    if not r.ok:
        print(f'[{PROVIDER}] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)
    data = r.json()
    print(f'[{PROVIDER}] synced: {data.get("recordsWritten", "?")} records written')

if __name__ == '__main__':
    main()
```

- [ ] **Step 8: Validate Python syntax**

```bash
python3 -c "import py_compile; py_compile.compile('scripts/providers/polar/poller.py', doraise=True)"
python3 -c "import py_compile; py_compile.compile('scripts/providers/withings/poller.py', doraise=True)"
```
Expected: no output (no errors)

- [ ] **Step 9: Run integration tests**

```bash
npx vitest run tests/server/integrations.test.ts
```
Expected: all integration tests passing (prior tests + 4 new)

- [ ] **Step 10: Run full suite**

```bash
npm test
```
Expected: 403+ tests passing (385 + 18 new: 5 polarService + 4 polarProcessor + 5 withingsService + 4 withingsProcessor + 4 integrations)

- [ ] **Step 11: Type-check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add server/api/integrations.ts tests/server/integrations.test.ts scripts/providers/polar/ scripts/providers/withings/
git commit -m "feat(polar,withings): wire into integrations router, add pollers and integration tests"
```
