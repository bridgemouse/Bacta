# Multi-Device Integration Layer — Plan 2, Phase 1 (Strava + Hevy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full server-side integration layer for Strava (OAuth 2.0) and Hevy (API key), including encrypted credential storage, a unified `/api/integrations` router, and thin Python pollers that plug into the existing nightly dispatcher.

**Architecture:** AES-256-GCM encryption for all secrets/tokens (key from `BACTA_ENCRYPTION_KEY` env var). Each provider has a `XxxService.ts` (OAuth + API calls) and `XxxProcessor.ts` (DB writes). A unified `server/api/integrations.ts` router handles all HTTP routes. OAuth callbacks are registered before the `requireAuth` guard in `server/index.ts`. Python pollers are thin HTTP callers (~20 lines each) that POST to the local sync endpoint.

**Tech Stack:** Node 20 (native `fetch`), TypeScript strict mode, Express 4, better-sqlite3, Vitest + supertest, Python 3 + requests

## Global Constraints

- TypeScript strict mode — no `any`, no implicit returns missing types
- All DB imports use `../../../db/client` (3 levels up from `server/lib/integrations/{provider}/`)
- `INSERT OR REPLACE` for all health_activities and health_snapshots writes (idempotent re-syncs)
- No CSS, no frontend changes — this is backend-only
- Test files: `process.env.DB_PATH = ':memory:'` at the top before any imports; dynamic `await import()` for server modules
- Run `npx tsc -p tsconfig.server.json --noEmit` after each task — must pass with zero errors
- Commit after each task passes type-check and tests
- Spec: `docs/superpowers/specs/2026-06-23-multi-device-plan2-integration-layer.md`

---

## File Map

| Status | File | Task |
|--------|------|------|
| CREATE | `server/lib/integrations/shared/encryption.ts` | Task 1 |
| CREATE | `server/lib/integrations/shared/types.ts` | Task 1 |
| MODIFY | `server/lib/settings.ts` | Task 1 |
| MODIFY | `server/api/settings.ts` | Task 1 |
| MODIFY | `.env.example` | Task 1 |
| CREATE | `tests/server/encryption.test.ts` | Task 1 |
| CREATE | `server/lib/integrations/strava/stravaService.ts` | Task 2 |
| CREATE | `server/lib/integrations/strava/stravaProcessor.ts` | Task 2 |
| CREATE | `tests/server/stravaService.test.ts` | Task 2 |
| CREATE | `tests/server/stravaProcessor.test.ts` | Task 2 |
| CREATE | `server/lib/integrations/hevy/hevyService.ts` | Task 3 |
| CREATE | `server/lib/integrations/hevy/hevyProcessor.ts` | Task 3 |
| CREATE | `tests/server/hevyService.test.ts` | Task 3 |
| CREATE | `tests/server/hevyProcessor.test.ts` | Task 3 |
| CREATE | `server/api/integrations.ts` | Task 4 |
| MODIFY | `server/index.ts` | Task 4 |
| CREATE | `tests/server/integrations.test.ts` | Task 4 |
| CREATE | `scripts/providers/strava/poller.py` | Task 5 |
| CREATE | `scripts/providers/hevy/poller.py` | Task 5 |

---

## Task 1: Shared Infrastructure

**Files:**
- Create: `server/lib/integrations/shared/encryption.ts`
- Create: `server/lib/integrations/shared/types.ts`
- Modify: `server/lib/settings.ts`
- Modify: `server/api/settings.ts`
- Modify: `.env.example`
- Test: `tests/server/encryption.test.ts`

**Interfaces:**
- Produces:
  - `encrypt(plaintext: string | null | undefined): string` — returns encrypted JSON string or `''` for null/empty input
  - `decrypt(ciphertext: string | null | undefined): string | null` — returns plaintext or `null`
  - `interface ProviderTokens { access_token: string; refresh_token: string; expires_at: number }`
  - `tokensExpired(tokens: ProviderTokens): boolean`
  - `daysAgo(n: number): string` — ISO date string N days in the past
  - `toEpoch(dateStr: string): number` — ISO date → unix epoch seconds
  - `PROVIDERS`, `Provider` type, `SETTING_DEFAULTS` additions, `SECRET_SETTING_KEYS` additions

---

- [ ] **Step 1: Write the failing encryption test**

Create `tests/server/encryption.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

const TEST_KEY = 'a'.repeat(64) // 64 hex chars = valid 32-byte key

describe('encryption', () => {
  beforeEach(() => {
    process.env.BACTA_ENCRYPTION_KEY = TEST_KEY
  })

  it('encrypt/decrypt roundtrip returns original plaintext', async () => {
    const { encrypt, decrypt } = await import('../../server/lib/integrations/shared/encryption')
    const plain = 'super-secret-token-abc123'
    const cipher = encrypt(plain)
    expect(cipher).not.toBe(plain)
    expect(decrypt(cipher)).toBe(plain)
  })

  it('each encrypt call produces a different ciphertext (random IV)', async () => {
    const { encrypt } = await import('../../server/lib/integrations/shared/encryption')
    const a = encrypt('same')
    const b = encrypt('same')
    expect(a).not.toBe(b)
  })

  it('encrypt(null) returns empty string', async () => {
    const { encrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(encrypt(null)).toBe('')
  })

  it('encrypt(undefined) returns empty string', async () => {
    const { encrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(encrypt(undefined)).toBe('')
  })

  it('decrypt(null) returns null', async () => {
    const { decrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(decrypt(null)).toBeNull()
  })

  it('decrypt empty string returns null', async () => {
    const { decrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(decrypt('')).toBeNull()
  })

  it('decrypt garbage returns null without throwing', async () => {
    const { decrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(decrypt('not-valid-json')).toBeNull()
  })

  it('stored format is JSON with e, iv, tag fields', async () => {
    const { encrypt } = await import('../../server/lib/integrations/shared/encryption')
    const cipher = encrypt('test')
    const parsed = JSON.parse(cipher)
    expect(parsed).toHaveProperty('e')
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('tag')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/server/encryption.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/lib/integrations/shared/encryption.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

interface Encrypted { e: string; iv: string; tag: string }

function getKey(): Buffer {
  const raw = process.env.BACTA_ENCRYPTION_KEY ?? ''
  if (raw.length === 64) return Buffer.from(raw, 'hex')
  if (raw.length === 44) return Buffer.from(raw, 'base64')
  throw new Error('[encryption] BACTA_ENCRYPTION_KEY must be 64 hex chars or 44 base64 chars — generate with: openssl rand -hex 32')
}

export function encrypt(plaintext: string | null | undefined): string {
  if (!plaintext) return ''
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const e = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const result: Encrypted = {
    e:   e.toString('base64'),
    iv:  iv.toString('base64'),
    tag: tag.toString('base64'),
  }
  return JSON.stringify(result)
}

export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null
  try {
    const { e, iv, tag } = JSON.parse(ciphertext) as Encrypted
    const key = getKey()
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return decipher.update(Buffer.from(e, 'base64')).toString('utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/server/encryption.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Create `server/lib/integrations/shared/types.ts`**

```typescript
export interface ProviderTokens {
  access_token:  string
  refresh_token: string
  expires_at:    number  // unix seconds
}

export function tokensExpired(tokens: ProviderTokens): boolean {
  // 60-second buffer so we refresh before actual expiry
  return Date.now() / 1000 > tokens.expires_at - 60
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}

export function toEpoch(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000)
}
```

- [ ] **Step 6: Update `server/lib/settings.ts`**

Replace the entire file with:

```typescript
import db from '../db/client'

export const PROVIDERS = ['strava', 'hevy', 'polar', 'oura', 'whoop', 'withings'] as const
export type Provider = typeof PROVIDERS[number]

export const SETTING_DEFAULTS: Record<string, string> = {
  // AI / MX-4
  ai_provider:                    'google',
  ai_api_key:                     '',
  mx4_briefing_model:             'gemini-2.5-flash',
  mx4_chat_model:                 'gemini-2.5-flash',
  mx4_nightly_enabled:            'true',
  mx4_nightly_time:               '04:00',
  mx4_on_sync_enabled:            'true',
  mx4_chat_compression_threshold: '20',
  mx4_home_rerun_mode:            'home_only',
  mx4_custom_skills:              JSON.stringify([{
    label:  'SYNC WIKI',
    prompt: 'Review your wiki pages and update them based on our conversation so far. Write any new patterns or findings worth preserving.',
  }]),
  vault_enabled:     'false',
  vault_url:         '',
  research_provider: 'none',
  research_api_key:  '',
  app_logo:          'splash',

  // Multi-device globals
  base_url:        'http://bacta.home',
  source_priority: JSON.stringify(['garmin']),

  // Strava
  strava_client_id:   '', strava_client_secret: '', strava_tokens: '',
  strava_enabled:     'false', strava_last_sync: '', strava_oauth_state: '',

  // Hevy
  hevy_api_key:   '', hevy_enabled: 'false', hevy_last_sync: '',

  // Polar
  polar_client_id:    '', polar_client_secret: '', polar_tokens: '',
  polar_enabled:      'false', polar_last_sync: '', polar_oauth_state: '',

  // Oura
  oura_client_id:     '', oura_client_secret: '', oura_tokens: '',
  oura_enabled:       'false', oura_last_sync: '', oura_oauth_state: '',

  // Whoop
  whoop_client_id:    '', whoop_client_secret: '', whoop_tokens: '',
  whoop_enabled:      'false', whoop_last_sync: '', whoop_oauth_state: '',

  // Withings
  withings_client_id: '', withings_client_secret: '', withings_tokens: '',
  withings_enabled:   'false', withings_last_sync: '', withings_oauth_state: '',
}

// Keys whose values must never be returned to the client in cleartext.
export const SECRET_SETTING_KEYS = new Set([
  'ai_api_key', 'research_api_key',
  'strava_client_secret', 'strava_tokens',
  'hevy_api_key',
  'polar_client_secret',   'polar_tokens',
  'oura_client_secret',    'oura_tokens',
  'whoop_client_secret',   'whoop_tokens',
  'withings_client_secret','withings_tokens',
])

export function initSettings(): void {
  const insert = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    insert.run(key, value)
  }
}

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
    .run(key, value)
}
```

- [ ] **Step 7: Add validators for new settings keys in `server/api/settings.ts`**

Find the `SETTING_VALIDATORS` object (starts around line 13) and add these entries before the closing `}`:

```typescript
  // Multi-device globals
  base_url:               v => v === '' || /^https?:\/\/[^\s]+$/.test(v),
  source_priority:        v => { try { return Array.isArray(JSON.parse(v)) } catch { return false } },
  // Provider credentials (writeable via API for Settings UI)
  strava_client_id:       v => v.length <= 200,
  strava_client_secret:   v => v.length <= 400,
  hevy_api_key:           v => v.length <= 400,
  hevy_enabled:           v => v === 'true' || v === 'false',
  polar_client_id:        v => v.length <= 200,
  polar_client_secret:    v => v.length <= 400,
  oura_client_id:         v => v.length <= 200,
  oura_client_secret:     v => v.length <= 400,
  whoop_client_id:        v => v.length <= 200,
  whoop_client_secret:    v => v.length <= 400,
  withings_client_id:     v => v.length <= 200,
  withings_client_secret: v => v.length <= 400,
```

- [ ] **Step 8: Update `.env.example`**

Add at the end of the file:

```
# --- Multi-Device Integrations ---
# AES-256-GCM key for encrypting OAuth tokens at rest (REQUIRED for OAuth providers)
# Generate: openssl rand -hex 32
BACTA_ENCRYPTION_KEY=

# Pre-shared token used by Python pollers to authenticate with the local API
# Generate: openssl rand -hex 32
BACTA_INTERNAL_TOKEN=

# Base URL used by Python pollers to reach the local Bacta API (no trailing slash)
BACTA_BASE_URL=http://localhost:3001
```

- [ ] **Step 9: Type-check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```

Expected: zero errors.

- [ ] **Step 10: Run all server tests**

```bash
npx vitest run tests/server/
```

Expected: all pass. If `settings-schema.test.ts` fails due to new keys, update it to include the new defaults.

- [ ] **Step 11: Commit**

```bash
git add server/lib/integrations/shared/encryption.ts \
        server/lib/integrations/shared/types.ts \
        server/lib/settings.ts \
        server/api/settings.ts \
        .env.example \
        tests/server/encryption.test.ts
git commit -m "feat(integrations): add encryption module, shared types, and provider settings"
```

---

## Task 2: Strava Service + Processor

**Files:**
- Create: `server/lib/integrations/strava/stravaService.ts`
- Create: `server/lib/integrations/strava/stravaProcessor.ts`
- Test: `tests/server/stravaService.test.ts`
- Test: `tests/server/stravaProcessor.test.ts`

**Interfaces:**
- Consumes: `ProviderTokens`, `tokensExpired`, `daysAgo`, `toEpoch` from `../shared/types`
- Produces:
  - `getAuthUrl(clientId, redirectUri, state): string`
  - `exchangeCode(clientId, clientSecret, code, redirectUri): Promise<ProviderTokens>`
  - `refreshTokens(clientId, clientSecret, tokens): Promise<ProviderTokens>` — returns input unchanged if not expired
  - `fetchActivities(accessToken, afterEpoch): Promise<StravaActivity[]>`
  - `interface StravaActivity { id, name, sport_type, start_date_local, distance, moving_time, total_elevation_gain, average_heartrate?, kilojoules? }`
  - `processActivities(activities: StravaActivity[]): number` — returns count written
  - `toTypeKey(sportType: string): string` — exported for test access

---

- [ ] **Step 1: Write failing Strava service test**

Create `tests/server/stravaService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('stravaService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Strava OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/strava/stravaService')
    const url = getAuthUrl('client123', 'http://bacta.home/api/integrations/strava/callback', 'state-abc')
    expect(url).toContain('https://www.strava.com/oauth/authorize')
    expect(url).toContain('client_id=client123')
    expect(url).toContain('state=state-abc')
    expect(url).toContain('activity%3Aread_all')
  })

  it('exchangeCode POSTs to Strava token endpoint and returns tokens', async () => {
    const mockTokens = { access_token: 'acc', refresh_token: 'ref', expires_at: 9999999999 }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokens,
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/strava/stravaService')
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')

    expect(fetch).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    )
    expect(tokens).toEqual(mockTokens)
  })

  it('refreshTokens skips refresh when token not expired', async () => {
    const { refreshTokens } = await import('../../server/lib/integrations/strava/stravaService')
    const tokens = { access_token: 'acc', refresh_token: 'ref', expires_at: Math.floor(Date.now() / 1000) + 3600 }
    const result = await refreshTokens('cid', 'csec', tokens)
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toBe(tokens) // same reference — not refreshed
  })

  it('refreshTokens calls Strava when token is expired', async () => {
    const newTokens = { access_token: 'new-acc', refresh_token: 'new-ref', expires_at: 9999999999 }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => newTokens,
    } as Response)

    const { refreshTokens } = await import('../../server/lib/integrations/strava/stravaService')
    const expired = { access_token: 'old', refresh_token: 'old-ref', expires_at: 100 }
    const result = await refreshTokens('cid', 'csec', expired)

    expect(fetch).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.access_token).toBe('new-acc')
  })

  it('fetchActivities returns activities from Strava', async () => {
    const mockActivities = [
      { id: 1, name: 'Morning Run', sport_type: 'Run', start_date_local: '2026-06-20T07:00:00', distance: 5000, moving_time: 1800, total_elevation_gain: 50 },
    ]
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockActivities } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) // empty page = done

    const { fetchActivities } = await import('../../server/lib/integrations/strava/stravaService')
    const result = await fetchActivities('token', 1700000000)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Morning Run')
  })

  it('fetchActivities throws when Strava returns non-ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 401 } as Response)
    const { fetchActivities } = await import('../../server/lib/integrations/strava/stravaService')
    await expect(fetchActivities('bad-token', 0)).rejects.toThrow('401')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/server/stravaService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/lib/integrations/strava/stravaService.ts`**

```typescript
import { ProviderTokens, tokensExpired } from '../shared/types'

const TOKEN_URL = 'https://www.strava.com/oauth/token'
const API_BASE  = 'https://www.strava.com/api/v3'

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id:       clientId,
    redirect_uri:    redirectUri,
    response_type:   'code',
    approval_prompt: 'auto',
    scope:           'read,activity:read_all,profile:read_all',
    state,
  })
  return `https://www.strava.com/oauth/authorize?${p}`
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
  })
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_at: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at }
}

export async function refreshTokens(
  clientId: string, clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  if (!tokensExpired(tokens)) return tokens
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }),
  })
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_at: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at }
}

export interface StravaActivity {
  id:                   number
  name:                 string
  sport_type:           string
  start_date_local:     string   // ISO 8601 local e.g. '2026-06-20T07:00:00'
  distance:             number   // metres
  moving_time:          number   // seconds
  total_elevation_gain: number   // metres
  average_heartrate?:   number
  kilojoules?:          number
}

export async function fetchActivities(accessToken: string, afterEpoch: number): Promise<StravaActivity[]> {
  const all: StravaActivity[] = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({ after: String(afterEpoch), per_page: '100', page: String(page) })
    const res = await fetch(`${API_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`)
    const batch = await res.json() as StravaActivity[]
    if (batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
    page++
    await new Promise(r => setTimeout(r, 500))
  }

  return all
}
```

- [ ] **Step 4: Run Strava service tests**

```bash
npx vitest run tests/server/stravaService.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Write failing Strava processor test**

Create `tests/server/stravaProcessor.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('stravaProcessor', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('toTypeKey maps known Strava sport types to Bacta type_key', async () => {
    const { toTypeKey } = await import('../../server/lib/integrations/strava/stravaProcessor')
    expect(toTypeKey('Run')).toBe('running')
    expect(toTypeKey('Ride')).toBe('cycling')
    expect(toTypeKey('WeightTraining')).toBe('strength_training')
    expect(toTypeKey('VirtualRide')).toBe('cycling')
    expect(toTypeKey('UnknownSport')).toBe('unknownsport')
  })

  it('processActivities writes rows to health_activities', async () => {
    const { processActivities } = await import('../../server/lib/integrations/strava/stravaProcessor')
    const { default: db } = await import('../../server/db/client')

    const activities = [
      { id: 1001, name: 'Morning Run', sport_type: 'Run', start_date_local: '2026-06-20T07:00:00', distance: 5000, moving_time: 1800, total_elevation_gain: 50, average_heartrate: 145, kilojoules: 600 },
      { id: 1002, name: 'Evening Ride', sport_type: 'Ride', start_date_local: '2026-06-21T18:00:00', distance: 20000, moving_time: 3600, total_elevation_gain: 200 },
    ]

    const count = processActivities(activities)
    expect(count).toBe(2)

    const rows = db.prepare("SELECT * FROM health_activities WHERE source = 'strava' ORDER BY activity_id").all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0].activity_id).toBe('1001')
    expect(rows[0].type_key).toBe('running')
    expect(rows[0].distance_m).toBe(5000)
    expect(rows[0].avg_hr).toBe(145)
    expect(rows[0].calories).toBe(143) // Math.round(600 * 0.239)
    expect(rows[1].type_key).toBe('cycling')
    expect(rows[1].calories).toBeNull()
  })

  it('processActivities writes distance rollup to health_snapshots', async () => {
    const { processActivities } = await import('../../server/lib/integrations/strava/stravaProcessor')
    const { default: db } = await import('../../server/db/client')

    processActivities([
      { id: 2001, name: 'Long Run', sport_type: 'Run', start_date_local: '2026-06-22T06:00:00', distance: 15000, moving_time: 5400, total_elevation_gain: 100 },
    ])

    const snap = db.prepare("SELECT value FROM health_snapshots WHERE date = '2026-06-22' AND metric = 'distance_m' AND source = 'strava'").get() as { value: number } | undefined
    expect(snap?.value).toBe(15000)
  })

  it('processActivities is idempotent — re-running same data does not duplicate rows', async () => {
    const { processActivities } = await import('../../server/lib/integrations/strava/stravaProcessor')
    const { default: db } = await import('../../server/db/client')

    const activity = [{ id: 3001, name: 'Run', sport_type: 'Run', start_date_local: '2026-06-23T07:00:00', distance: 5000, moving_time: 1800, total_elevation_gain: 0 }]
    processActivities(activity)
    processActivities(activity)

    const rows = db.prepare("SELECT COUNT(*) as n FROM health_activities WHERE activity_id = '3001'").get() as { n: number }
    expect(rows.n).toBe(1)
  })
})
```

- [ ] **Step 6: Run to verify it fails**

```bash
npx vitest run tests/server/stravaProcessor.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Create `server/lib/integrations/strava/stravaProcessor.ts`**

```typescript
import db from '../../../db/client'
import { StravaActivity } from './stravaService'

const TYPE_MAP: Record<string, string> = {
  Run:              'running',
  TrailRun:         'trail_running',
  Walk:             'walking',
  Hike:             'hiking',
  Ride:             'cycling',
  VirtualRide:      'cycling',
  MountainBikeRide: 'cycling',
  GravelRide:       'cycling',
  EBikeRide:        'cycling',
  WeightTraining:   'strength_training',
  Crossfit:         'strength_training',
  Swim:             'swimming',
  Workout:          'workout',
  Yoga:             'yoga',
  Rowing:           'rowing',
  Kayaking:         'kayaking',
  Soccer:           'sport',
  Tennis:           'sport',
  Golf:             'sport',
  Skiing:           'skiing',
  Snowboard:        'skiing',
  IceSkate:         'skating',
  InlineSkate:      'skating',
  Elliptical:       'cardio',
  StairStepper:     'cardio',
  Velomobile:       'cycling',
}

export function toTypeKey(sportType: string): string {
  return TYPE_MAP[sportType] ?? sportType.toLowerCase().replace(/\s+/g, '_')
}

const insertActivity = db.prepare(`
  INSERT OR REPLACE INTO health_activities
    (activity_id, source, date, start_time, name, type_key,
     distance_m, duration_s, calories, avg_hr, elevation_m)
  VALUES (?, 'strava', ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertSnapshot = db.prepare(`
  INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source)
  VALUES (?, 'distance_m', ?, 'm', 'strava')
`)

export function processActivities(activities: StravaActivity[]): number {
  let count = 0
  const run = db.transaction((acts: StravaActivity[]) => {
    for (const act of acts) {
      const date     = act.start_date_local.slice(0, 10)
      const calories = act.kilojoules != null ? Math.round(act.kilojoules * 0.239) : null
      const avgHr    = act.average_heartrate != null ? Math.round(act.average_heartrate) : null

      insertActivity.run(
        String(act.id), date, act.start_date_local, act.name,
        toTypeKey(act.sport_type),
        act.distance   || null,
        act.moving_time || null,
        calories,
        avgHr,
        act.total_elevation_gain || null,
      )

      if (act.distance > 0) insertSnapshot.run(date, act.distance)
      count++
    }
  })
  run(activities)
  console.log(`[strava] processed ${count} activities`)
  return count
}
```

- [ ] **Step 8: Run Strava processor tests**

```bash
npx vitest run tests/server/stravaProcessor.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 9: Type-check and commit**

```bash
npx tsc -p tsconfig.server.json --noEmit
git add server/lib/integrations/strava/ tests/server/stravaService.test.ts tests/server/stravaProcessor.test.ts
git commit -m "feat(integrations): add Strava service and processor"
```

---

## Task 3: Hevy Service + Processor

**Files:**
- Create: `server/lib/integrations/hevy/hevyService.ts`
- Create: `server/lib/integrations/hevy/hevyProcessor.ts`
- Test: `tests/server/hevyService.test.ts`
- Test: `tests/server/hevyProcessor.test.ts`

**Interfaces:**
- Consumes: `db` from `../../../db/client`
- Produces:
  - `fetchWorkouts(apiKey, page?, pageSize?): Promise<HevyWorkout[]>` — pageSize capped at 10
  - `fetchWorkoutsSince(apiKey, sinceDate): Promise<HevyWorkout[]>` — paginates until oldest record < sinceDate
  - `interface HevyWorkout { id, title, start_time, end_time, exercises }`
  - `processWorkouts(workouts: HevyWorkout[]): number` — returns count written

---

- [ ] **Step 1: Write failing Hevy service test**

Create `tests/server/hevyService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('hevyService', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('fetchWorkouts calls Hevy API with api-key header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workouts: [] }),
    } as Response)

    const { fetchWorkouts } = await import('../../server/lib/integrations/hevy/hevyService')
    await fetchWorkouts('my-api-key')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.hevyapp.com/v1/workouts'),
      expect.objectContaining({ headers: { 'api-key': 'my-api-key' } })
    )
  })

  it('fetchWorkouts uses pageSize=10 by default', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ workouts: [] }) } as Response)
    const { fetchWorkouts } = await import('../../server/lib/integrations/hevy/hevyService')
    await fetchWorkouts('key')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('pageSize=10'),
      expect.anything()
    )
  })

  it('fetchWorkouts throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 403 } as Response)
    const { fetchWorkouts } = await import('../../server/lib/integrations/hevy/hevyService')
    await expect(fetchWorkouts('bad-key')).rejects.toThrow('403')
  })

  it('fetchWorkoutsSince stops pagination when batch contains records older than sinceDate', async () => {
    const page1 = [
      { id: 'w1', title: 'Workout A', start_time: '2026-06-22T10:00:00Z', end_time: '2026-06-22T11:00:00Z', exercises: [] },
      { id: 'w2', title: 'Workout B', start_time: '2026-05-01T10:00:00Z', end_time: '2026-05-01T11:00:00Z', exercises: [] },
    ]
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ workouts: page1 }) } as Response)

    const { fetchWorkoutsSince } = await import('../../server/lib/integrations/hevy/hevyService')
    const result = await fetchWorkoutsSince('key', '2026-06-01')

    // Only w1 is on or after sinceDate
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('w1')
    // Should not fetch page 2 since oldest record is before sinceDate
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/server/hevyService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/lib/integrations/hevy/hevyService.ts`**

```typescript
const API_BASE = 'https://api.hevyapp.com/v1'

export interface HevySet {
  weight_kg:         number | null
  reps:              number | null
  duration_seconds:  number | null
}

export interface HevyExercise {
  title: string
  sets:  HevySet[]
}

export interface HevyWorkout {
  id:         string
  title:      string
  start_time: string   // ISO 8601 UTC
  end_time:   string   // ISO 8601 UTC
  exercises:  HevyExercise[]
}

export async function fetchWorkouts(
  apiKey: string, page = 1, pageSize = 10
): Promise<HevyWorkout[]> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  const res = await fetch(`${API_BASE}/workouts?${params}`, {
    headers: { 'api-key': apiKey },
  })
  if (!res.ok) throw new Error(`Hevy workouts fetch failed: ${res.status}`)
  const data = await res.json() as { workouts: HevyWorkout[] }
  return data.workouts ?? []
}

export async function fetchWorkoutsSince(apiKey: string, sinceDate: string): Promise<HevyWorkout[]> {
  const all: HevyWorkout[] = []
  let page = 1

  while (true) {
    const batch = await fetchWorkouts(apiKey, page, 10)
    if (batch.length === 0) break

    for (const w of batch) {
      if (w.start_time.slice(0, 10) >= sinceDate) all.push(w)
    }

    // Hevy returns newest-first — stop when oldest record in batch predates sinceDate
    const oldest = batch[batch.length - 1]?.start_time?.slice(0, 10) ?? ''
    if (oldest < sinceDate || batch.length < 10) break
    page++
  }

  return all
}
```

- [ ] **Step 4: Run Hevy service tests**

```bash
npx vitest run tests/server/hevyService.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Write failing Hevy processor test**

Create `tests/server/hevyProcessor.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('hevyProcessor', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('processWorkouts writes rows to health_activities with type_key=strength_training', async () => {
    const { processWorkouts } = await import('../../server/lib/integrations/hevy/hevyProcessor')
    const { default: db } = await import('../../server/db/client')

    const workouts = [
      { id: 'hevy-001', title: 'Push Day', start_time: '2026-06-20T09:00:00Z', end_time: '2026-06-20T10:00:00Z', exercises: [] },
      { id: 'hevy-002', title: 'Pull Day', start_time: '2026-06-21T09:00:00Z', end_time: '2026-06-21T09:45:00Z', exercises: [] },
    ]

    const count = processWorkouts(workouts)
    expect(count).toBe(2)

    const rows = db.prepare("SELECT * FROM health_activities WHERE source = 'hevy' ORDER BY activity_id").all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0].activity_id).toBe('hevy-001')
    expect(rows[0].type_key).toBe('strength_training')
    expect(rows[0].duration_s).toBe(3600)
    expect(rows[1].duration_s).toBe(2700)
  })

  it('processWorkouts is idempotent', async () => {
    const { processWorkouts } = await import('../../server/lib/integrations/hevy/hevyProcessor')
    const { default: db } = await import('../../server/db/client')

    const w = [{ id: 'hevy-999', title: 'Test', start_time: '2026-06-23T08:00:00Z', end_time: '2026-06-23T09:00:00Z', exercises: [] }]
    processWorkouts(w)
    processWorkouts(w)

    const row = db.prepare("SELECT COUNT(*) as n FROM health_activities WHERE activity_id = 'hevy-999'").get() as { n: number }
    expect(row.n).toBe(1)
  })
})
```

- [ ] **Step 6: Run to verify it fails**

```bash
npx vitest run tests/server/hevyProcessor.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Create `server/lib/integrations/hevy/hevyProcessor.ts`**

```typescript
import db from '../../../db/client'
import { HevyWorkout } from './hevyService'

const insertActivity = db.prepare(`
  INSERT OR REPLACE INTO health_activities
    (activity_id, source, date, start_time, name, type_key, duration_s)
  VALUES (?, 'hevy', ?, ?, ?, 'strength_training', ?)
`)

export function processWorkouts(workouts: HevyWorkout[]): number {
  let count = 0
  const run = db.transaction((ws: HevyWorkout[]) => {
    for (const w of ws) {
      const date      = w.start_time.slice(0, 10)
      const durationS = w.end_time && w.start_time
        ? Math.round((new Date(w.end_time).getTime() - new Date(w.start_time).getTime()) / 1000)
        : null
      insertActivity.run(w.id, date, w.start_time, w.title || 'Strength Training', durationS)
      count++
    }
  })
  run(workouts)
  console.log(`[hevy] processed ${count} workouts`)
  return count
}
```

- [ ] **Step 8: Run Hevy processor tests**

```bash
npx vitest run tests/server/hevyProcessor.test.ts
```

Expected: both tests PASS.

- [ ] **Step 9: Type-check and commit**

```bash
npx tsc -p tsconfig.server.json --noEmit
git add server/lib/integrations/hevy/ tests/server/hevyService.test.ts tests/server/hevyProcessor.test.ts
git commit -m "feat(integrations): add Hevy service and processor"
```

---

## Task 4: Integrations Router + Server Wiring

**Files:**
- Create: `server/api/integrations.ts`
- Modify: `server/index.ts`
- Test: `tests/server/integrations.test.ts`

**Interfaces:**
- Consumes: all service/processor functions from Tasks 1–3; `getSetting`, `setSetting`, `PROVIDERS`, `Provider` from `../lib/settings`; `encrypt`, `decrypt` from `../lib/integrations/shared/encryption`; `ProviderTokens`, `daysAgo`, `toEpoch` from `../lib/integrations/shared/types`; `isAuthConfigured`, `verifyToken`, `parseCookies`, `SESSION_COOKIE` from `../lib/auth`
- Produces:
  - `integrationsRouter` — Express Router (status, authorize, single-provider status, disconnect, sync)
  - `callbackHandler` — Express RequestHandler (OAuth callback, registered separately without requireAuth)

---

- [ ] **Step 1: Write failing integrations router tests**

Create `tests/server/integrations.test.ts`:

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'
process.env.BACTA_ENCRYPTION_KEY = 'a'.repeat(64)
process.env.BACTA_INTERNAL_TOKEN = 'test-internal-token'

describe('Integrations API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('GET /api/integrations/status returns all providers as not connected', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/status')
    expect(res.status).toBe(200)
    expect(res.body.strava).toEqual({ connected: false, lastSync: null })
    expect(res.body.hevy).toEqual({ connected: false, lastSync: null })
    expect(res.body.polar).toEqual({ connected: false, lastSync: null })
    expect(res.body.oura).toEqual({ connected: false, lastSync: null })
    expect(res.body.whoop).toEqual({ connected: false, lastSync: null })
    expect(res.body.withings).toEqual({ connected: false, lastSync: null })
  })

  it('GET /api/integrations/strava/authorize returns 400 when client_id not set', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/strava/authorize')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/client_id/)
  })

  it('GET /api/integrations/strava/authorize returns { url } when configured', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('strava_client_id', 'cid123')").run()
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('base_url', 'http://bacta.home')").run()

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/strava/authorize')
    expect(res.status).toBe(200)
    expect(res.body.url).toContain('www.strava.com/oauth/authorize')
    expect(res.body.url).toContain('cid123')
  })

  it('GET /api/integrations/hevy/authorize returns 400 (Hevy has no OAuth)', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/hevy/authorize')
    expect(res.status).toBe(400)
  })

  it('GET /api/integrations/strava/callback returns 400 on state mismatch', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .get('/api/integrations/strava/callback')
      .query({ code: 'some-code', state: 'wrong-state' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/state/i)
  })

  it('POST /api/integrations/strava/disconnect clears tokens and sets enabled=false', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('strava_enabled', 'true')").run()
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('strava_tokens', 'encrypted-stuff')").run()

    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/integrations/strava/disconnect')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const enabled = db.prepare("SELECT value FROM app_settings WHERE key = 'strava_enabled'").get() as { value: string }
    const tokens  = db.prepare("SELECT value FROM app_settings WHERE key = 'strava_tokens'").get()  as { value: string }
    expect(enabled.value).toBe('false')
    expect(tokens.value).toBe('')
  })

  it('POST /api/integrations/strava/sync returns 401 without auth', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/integrations/strava/sync')
    expect(res.status).toBe(401)
  })

  it('POST /api/integrations/strava/sync returns 400 when provider not connected', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .post('/api/integrations/strava/sync')
      .set('Authorization', 'Bearer test-internal-token')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not connected/)
  })

  it('GET /api/integrations/unknown-provider/authorize returns 400', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/notaprovider/authorize')
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run tests/server/integrations.test.ts
```

Expected: FAIL — module not found / routes not registered.

- [ ] **Step 3: Create `server/api/integrations.ts`**

```typescript
import { Router, Request, Response, RequestHandler } from 'express'
import { randomUUID } from 'crypto'
import { getSetting, setSetting, PROVIDERS, Provider } from '../lib/settings'
import { isAuthConfigured, verifyToken, parseCookies, SESSION_COOKIE } from '../lib/auth'
import { encrypt, decrypt } from '../lib/integrations/shared/encryption'
import { ProviderTokens, daysAgo, toEpoch } from '../lib/integrations/shared/types'
import { getAuthUrl as stravaAuthUrl, exchangeCode as stravaExchange, refreshTokens as stravaRefresh, fetchActivities } from '../lib/integrations/strava/stravaService'
import { processActivities } from '../lib/integrations/strava/stravaProcessor'
import { fetchWorkoutsSince } from '../lib/integrations/hevy/hevyService'
import { processWorkouts } from '../lib/integrations/hevy/hevyProcessor'

const router = Router()
const OAUTH_PROVIDERS = new Set<Provider>(['strava', 'polar', 'oura', 'whoop', 'withings'])

// Accepts BACTA_INTERNAL_TOKEN (for pollers) OR a valid session cookie
function requireSyncAuth(req: Request, res: Response, next: () => void): void {
  const bearer   = (req.headers.authorization ?? '').replace('Bearer ', '')
  const internal = process.env.BACTA_INTERNAL_TOKEN ?? ''
  if (internal && bearer === internal) return next()
  if (!isAuthConfigured()) return next()
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  if (verifyToken(token)) return next()
  res.status(401).json({ error: 'Authentication required' })
}

function getTokens(provider: Provider): ProviderTokens | null {
  const raw = getSetting(`${provider}_tokens`)
  if (!raw) return null
  const plain = decrypt(raw)
  if (!plain) return null
  try { return JSON.parse(plain) as ProviderTokens } catch { return null }
}

function saveTokens(provider: Provider, tokens: ProviderTokens): void {
  setSetting(`${provider}_tokens`, encrypt(JSON.stringify(tokens)))
}

function getRedirectUri(provider: Provider): string {
  const base = getSetting('base_url') || 'http://localhost:3001'
  return `${base}/api/integrations/${provider}/callback`
}

// GET /api/integrations/status — must be registered before /:provider routes
router.get('/status', (_req: Request, res: Response) => {
  const out: Record<string, { connected: boolean; lastSync: string | null }> = {}
  for (const p of PROVIDERS) {
    const tokens  = getTokens(p)
    const enabled = getSetting(`${p}_enabled`)
    out[p] = {
      connected: enabled === 'true' && !!tokens,
      lastSync:  getSetting(`${p}_last_sync`) || null,
    }
  }
  res.json(out)
})

// GET /api/integrations/:provider/status
router.get('/:provider/status', (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!PROVIDERS.includes(provider)) return void res.status(400).json({ error: 'Unknown provider' })
  const tokens  = getTokens(provider)
  const enabled = getSetting(`${provider}_enabled`)
  res.json({
    connected: enabled === 'true' && !!tokens,
    lastSync:  getSetting(`${provider}_last_sync`) || null,
    enabled:   enabled === 'true',
  })
})

// GET /api/integrations/:provider/authorize
router.get('/:provider/authorize', (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!PROVIDERS.includes(provider))    return void res.status(400).json({ error: 'Unknown provider' })
  if (!OAUTH_PROVIDERS.has(provider))   return void res.status(400).json({ error: 'Provider uses API key, not OAuth' })

  const baseUrl  = getSetting('base_url')
  if (!baseUrl) return void res.status(400).json({ error: 'base_url not configured — set it in Settings first' })

  const clientId = getSetting(`${provider}_client_id`) ?? ''
  if (!clientId) return void res.status(400).json({ error: `${provider}_client_id not configured` })

  const state = randomUUID()
  setSetting(`${provider}_oauth_state`, state)
  const redirectUri = getRedirectUri(provider)

  let url: string
  switch (provider) {
    case 'strava': url = stravaAuthUrl(clientId, redirectUri, state); break
    // Phases 2 and 3 providers added here later
    default: return void res.status(400).json({ error: 'Provider not yet implemented' })
  }

  res.json({ url })
})

// POST /api/integrations/:provider/disconnect
router.post('/:provider/disconnect', (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!PROVIDERS.includes(provider)) return void res.status(400).json({ error: 'Unknown provider' })
  setSetting(`${provider}_tokens`,   '')
  setSetting(`${provider}_enabled`,  'false')
  setSetting(`${provider}_last_sync`, '')
  console.log(`[integrations] ${provider} disconnected`)
  res.json({ ok: true })
})

// POST /api/integrations/:provider/sync
router.post('/:provider/sync', requireSyncAuth, async (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!PROVIDERS.includes(provider)) return void res.status(400).json({ error: 'Unknown provider' })
  if (getSetting(`${provider}_enabled`) !== 'true') return void res.status(400).json({ error: 'Provider not connected' })

  try {
    const recordsWritten = await runSync(provider)
    setSetting(`${provider}_last_sync`, new Date().toISOString())
    res.json({ ok: true, provider, recordsWritten })
  } catch (err) {
    console.error(`[integrations] ${provider} sync error:`, err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sync failed' })
  }
})

async function runSync(provider: Provider): Promise<number> {
  const since = daysAgo(30)

  switch (provider) {
    case 'strava': {
      const tokens = getTokens('strava')
      if (!tokens) throw new Error('Strava not connected')
      const clientId     = getSetting('strava_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('strava_client_secret') ?? '') ?? ''
      const fresh = await stravaRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('strava', fresh)
      const activities = await fetchActivities(fresh.access_token, toEpoch(since))
      return processActivities(activities)
    }

    case 'hevy': {
      const apiKey = decrypt(getSetting('hevy_api_key') ?? '') ?? ''
      if (!apiKey) throw new Error('Hevy API key not configured')
      const workouts = await fetchWorkoutsSince(apiKey, since)
      return processWorkouts(workouts)
    }

    // Phases 2 and 3 providers added here later
    default:
      throw new Error(`Sync not yet implemented for ${provider}`)
  }
}

// OAuth callback — registered WITHOUT requireAuth in server/index.ts
// because the browser arrives here from an external redirect with no session cookie.
// CSRF protection: state parameter is verified against the stored oauth_state.
export const callbackHandler: RequestHandler = async (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!OAUTH_PROVIDERS.has(provider)) {
    return void res.status(400).json({ error: 'Unknown OAuth provider' })
  }

  const { code, state, error } = req.query as Record<string, string>
  const baseUrl = getSetting('base_url') || ''

  if (error) {
    return void res.redirect(`${baseUrl}/#/settings?error=${provider}`)
  }
  if (!code || !state) {
    return void res.status(400).json({ error: 'Missing code or state' })
  }

  const savedState = getSetting(`${provider}_oauth_state`)
  if (!savedState || state !== savedState) {
    return void res.status(400).json({ error: 'State mismatch — possible CSRF' })
  }

  const clientId     = getSetting(`${provider}_client_id`)     ?? ''
  const clientSecret = decrypt(getSetting(`${provider}_client_secret`) ?? '') ?? ''
  const redirectUri  = getRedirectUri(provider)

  try {
    let tokens: ProviderTokens
    switch (provider) {
      case 'strava':
        tokens = await stravaExchange(clientId, clientSecret, code, redirectUri)
        break
      // Phases 2 and 3 providers added here later
      default:
        return void res.redirect(`${baseUrl}/#/settings?error=${provider}`)
    }

    saveTokens(provider, tokens)
    setSetting(`${provider}_enabled`, 'true')
    setSetting(`${provider}_oauth_state`, '')  // clear used state
    console.log(`[integrations] ${provider} connected successfully`)
    res.redirect(`${baseUrl}/#/settings?connected=${provider}`)
  } catch (err) {
    console.error(`[integrations] ${provider} callback error:`, err)
    res.redirect(`${baseUrl}/#/settings?error=${provider}`)
  }
}

export { router as integrationsRouter }
```

- [ ] **Step 4: Update `server/index.ts`**

Add the import after the existing imports:

```typescript
import { integrationsRouter, callbackHandler } from './api/integrations'
```

Add the routes after `app.use('/api/settings', requireAuth, settingsRouter)`:

```typescript
// OAuth callbacks exempt from requireAuth — browser arrives from external redirect
// CSRF state parameter is the guard inside callbackHandler
app.get('/api/integrations/:provider/callback', callbackHandler)

// All other integration routes require session auth
app.use('/api/integrations', requireAuth, integrationsRouter)
```

- [ ] **Step 5: Run integrations tests**

```bash
npx vitest run tests/server/integrations.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 6: Run the full test suite to check for regressions**

```bash
npx vitest run tests/server/
```

Expected: all tests PASS.

- [ ] **Step 7: Type-check and commit**

```bash
npx tsc -p tsconfig.server.json --noEmit
git add server/api/integrations.ts server/index.ts tests/server/integrations.test.ts
git commit -m "feat(integrations): add unified /api/integrations router (Phase 1: Strava + Hevy)"
```

---

## Task 5: Python Pollers

**Files:**
- Create: `scripts/providers/strava/poller.py`
- Create: `scripts/providers/hevy/poller.py`

**Note:** `scripts/health_poller.py` already dispatches to strava and hevy when `{provider}_enabled='true'` and passes `os.environ` (which contains `BACTA_BASE_URL` and `BACTA_INTERNAL_TOKEN`) to subprocesses. No changes needed to the dispatcher.

---

- [ ] **Step 1: Create `scripts/providers/strava/poller.py`**

```python
#!/usr/bin/env python3
"""
strava/poller.py — triggers a Strava data sync via the Bacta API.
Called by health_poller.py when strava_enabled=true in app_settings.

Required env vars:
  BACTA_INTERNAL_TOKEN  — pre-shared token for API auth
  BACTA_BASE_URL        — base URL of local Bacta server (default: http://localhost:3001)
"""
import os
import sys

try:
    import requests
except ImportError:
    print('[strava] requests library not installed — run: pip3 install requests', file=sys.stderr)
    sys.exit(1)

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')


def main() -> None:
    if not TOKEN:
        print('[strava] BACTA_INTERNAL_TOKEN not set — cannot authenticate', file=sys.stderr)
        sys.exit(1)

    try:
        r = requests.post(
            f'{BASE_URL}/api/integrations/strava/sync',
            headers={'Authorization': f'Bearer {TOKEN}'},
            timeout=120,
        )
    except requests.exceptions.ConnectionError:
        print(f'[strava] could not connect to {BASE_URL} — is bacta-api running?', file=sys.stderr)
        sys.exit(1)

    if not r.ok:
        print(f'[strava] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)

    data = r.json()
    print(f'[strava] synced: {data.get("recordsWritten", "?")} records written')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Create `scripts/providers/hevy/poller.py`**

```python
#!/usr/bin/env python3
"""
hevy/poller.py — triggers a Hevy data sync via the Bacta API.
Called by health_poller.py when hevy_enabled=true in app_settings.

Required env vars:
  BACTA_INTERNAL_TOKEN  — pre-shared token for API auth
  BACTA_BASE_URL        — base URL of local Bacta server (default: http://localhost:3001)
"""
import os
import sys

try:
    import requests
except ImportError:
    print('[hevy] requests library not installed — run: pip3 install requests', file=sys.stderr)
    sys.exit(1)

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')


def main() -> None:
    if not TOKEN:
        print('[hevy] BACTA_INTERNAL_TOKEN not set — cannot authenticate', file=sys.stderr)
        sys.exit(1)

    try:
        r = requests.post(
            f'{BASE_URL}/api/integrations/hevy/sync',
            headers={'Authorization': f'Bearer {TOKEN}'},
            timeout=60,
        )
    except requests.exceptions.ConnectionError:
        print(f'[hevy] could not connect to {BASE_URL} — is bacta-api running?', file=sys.stderr)
        sys.exit(1)

    if not r.ok:
        print(f'[hevy] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)

    data = r.json()
    print(f'[hevy] synced: {data.get("recordsWritten", "?")} records written')


if __name__ == '__main__':
    main()
```

- [ ] **Step 3: Validate Python syntax**

```bash
python3 -c "import py_compile; py_compile.compile('scripts/providers/strava/poller.py', doraise=True)"
python3 -c "import py_compile; py_compile.compile('scripts/providers/hevy/poller.py', doraise=True)"
```

Expected: no output (clean compile).

- [ ] **Step 4: Final full test run + type-check**

```bash
npx vitest run tests/server/
npx tsc -p tsconfig.server.json --noEmit
```

Expected: all tests pass, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/providers/strava/poller.py scripts/providers/hevy/poller.py
git commit -m "feat(integrations): add Strava and Hevy Python pollers"
```

---

## Operator Steps (not automated — do after plan is complete)

These require manual configuration on the LXC 109 host:

1. **Generate encryption key:**
   ```bash
   openssl rand -hex 32
   ```
   Add to `/opt/bacta/.env` as `BACTA_ENCRYPTION_KEY=<result>`

2. **Generate internal token:**
   ```bash
   openssl rand -hex 32
   ```
   Add to `/opt/bacta/.env` as `BACTA_INTERNAL_TOKEN=<result>` and `BACTA_BASE_URL=http://localhost:3001`

3. **Update systemd service** — add env vars so pollers inherit them. Edit `/opt/bacta/.env` (the file `bacta-api.service` already loads via `EnvironmentFile=`).

4. **Connect Strava** — set `strava_client_id` in Settings, set `strava_client_secret` via `PUT /api/settings/strava_client_secret`, then visit `GET /api/integrations/strava/authorize` to begin OAuth flow.
