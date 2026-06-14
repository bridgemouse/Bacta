# MX-4 Phase 1: Settings Page + AI Provider Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the settings page and AI provider foundation that Phases 2 and 3 depend on — users can store API keys, choose models, and configure MX-4's schedule; the provider layer reads those settings at call time.

**Architecture:** `server/lib/settings.ts` is a pure DB helper (no HTTP) imported by both the API router and the AI provider — this breaks what would otherwise be a circular dependency. `server/lib/ai/provider.ts` wraps the Vercel AI SDK and switches providers based on the `ai_provider` setting read at call time (no restart required). Tools in `server/lib/ai/tools.ts` are fully implemented but only called in Phase 2.

**Tech Stack:** Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/openai`), `zod` (schema validation for tools), `node-cron` (Phase 2 scheduler, installed now), `react-markdown` (Phase 3 briefing rendering, installed now), `supertest` + Vitest for server tests.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/db/schema.sql` | Modify | Add `app_settings`, `mx4_briefings`, `mx4_chat_messages` tables |
| `server/db/migrate.ts` | Modify | Call `initSettings()` after schema exec |
| `server/lib/settings.ts` | **Create** | `getSetting`, `setSetting`, `initSettings` — pure DB helpers |
| `server/api/settings.ts` | **Create** | HTTP router: GET /api/settings, PUT /api/settings/:key, POST /api/settings/test-connection |
| `server/lib/ai/provider.ts` | **Create** | Vercel AI SDK wrapper; `getModel(purpose)`, `testConnection()` |
| `server/lib/ai/tools.ts` | **Create** | All 6 MX-4 tool definitions: queryDb, readVault, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage |
| `server/index.ts` | Modify | Import + mount settings router; call `initSettings()` |
| `client/src/theme.ts` | Modify | Add `'settings'` to `SectionKey`, `SECTION_ACCENTS`, `SECTION_LABELS` |
| `client/src/components/primitives/Sigil.tsx` | Modify | Add `'settings'` case (gear/cog icon) |
| `client/src/pages/SettingsPage.tsx` | **Create** | Full settings UI |
| `client/src/App.tsx` | Modify | Add `/settings` route |
| `client/src/components/BottomSheet.tsx` | Modify | Add Settings entry below channel grid |
| `tests/server/settings.test.ts` | **Create** | Settings API tests |
| `tests/server/provider.test.ts` | **Create** | Provider layer tests |
| `tests/server/tools.test.ts` | **Create** | Tool function tests |

---

## Task 1: Install npm dependencies

**Files:** `package.json`

- [ ] **Step 1: Install server-side AI packages**

```bash
npm install ai @ai-sdk/google @ai-sdk/anthropic @ai-sdk/openai node-cron zod
npm install --save-dev @types/node-cron
```

Expected: packages added to `package.json`, no errors.

- [ ] **Step 2: Install client-side packages**

```bash
npm install react-markdown
```

Expected: `react-markdown` in `package.json` dependencies.

- [ ] **Step 3: Verify type check still passes**

```bash
npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add Vercel AI SDK, zod, node-cron, react-markdown"
```

---

## Task 2: DB schema — three new tables

**Files:** `server/db/schema.sql`

- [ ] **Step 1: Add tables to schema**

Append to the end of `server/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mx4_briefings (
  section      TEXT PRIMARY KEY,
  content_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  model        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mx4_chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON mx4_chat_messages(session_id, created_at);
```

- [ ] **Step 2: Write the failing test**

Create `tests/server/db.test.ts` additions — add to the existing file or create a new one at `tests/server/settings-schema.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('DB schema — new tables', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('app_settings table exists', async () => {
    const { default: db } = await import('../../server/db/client')
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('mx4_briefings table exists', async () => {
    const { default: db } = await import('../../server/db/client')
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='mx4_briefings'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('mx4_chat_messages table exists', async () => {
    const { default: db } = await import('../../server/db/client')
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='mx4_chat_messages'"
    ).get()
    expect(row).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
npm run test:server -- tests/server/settings-schema.test.ts
```

Expected: fails — tables don't exist yet (schema not updated).

- [ ] **Step 4: Apply schema change from Step 1, run — expect PASS**

```bash
npm run test:server -- tests/server/settings-schema.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add server/db/schema.sql tests/server/settings-schema.test.ts
git commit -m "feat: add app_settings, mx4_briefings, mx4_chat_messages tables"
```

---

## Task 3: `server/lib/settings.ts` — pure DB helpers

**Files:** Create `server/lib/settings.ts`

- [ ] **Step 1: Create the file**

```typescript
import db from '../db/client'

export const SETTING_DEFAULTS: Record<string, string> = {
  ai_provider:           'google',
  ai_api_key:            '',
  mx4_briefing_model:    'gemini-2.5-flash',
  mx4_chat_model:        'gemini-2.5-flash',
  mx4_nightly_enabled:   'true',
  mx4_nightly_time:      '04:00',
  mx4_on_sync_enabled:   'true',
}

export function initSettings(): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
  )
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

- [ ] **Step 2: Update `server/db/migrate.ts` to call `initSettings()`**

```typescript
import db from './client'
import fs from 'fs'
import path from 'path'
import { initSettings } from '../lib/settings'

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

  for (const col of NEW_ACTIVITY_COLS) {
    try {
      db.exec(`ALTER TABLE garmin_activities ADD COLUMN ${col}`)
    } catch (e: unknown) {
      if (!(e instanceof Error) || !e.message.includes('duplicate column name')) throw e
    }
  }

  initSettings()

  console.log('[db] migrations complete')
}
```

- [ ] **Step 3: Run full test suite to confirm nothing broke**

```bash
npm run test:server
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/lib/settings.ts server/db/migrate.ts
git commit -m "feat: settings DB helpers and auto-init on migrate"
```

---

## Task 4: `server/api/settings.ts` — HTTP router

**Files:** Create `server/api/settings.ts`, create `tests/server/settings.test.ts`, modify `server/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server/settings.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Settings API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('GET /api/settings returns all default keys', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body.ai_provider).toBe('google')
    expect(res.body.mx4_briefing_model).toBe('gemini-2.5-flash')
    expect(res.body.mx4_chat_model).toBe('gemini-2.5-flash')
    expect(res.body.mx4_nightly_enabled).toBe('true')
    expect(res.body.mx4_nightly_time).toBe('04:00')
    expect(res.body.mx4_on_sync_enabled).toBe('true')
  })

  it('GET /api/settings masks a non-empty api key — only last 4 chars visible', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('ai_api_key', 'sk-abcdefgh1234')"
    ).run()
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body.ai_api_key).toBe('••••1234')
    expect(res.body.ai_api_key).not.toContain('abcdefgh')
  })

  it('GET /api/settings returns empty string for empty api key — not masked', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('ai_api_key', '')"
    ).run()
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.body.ai_api_key).toBe('')
  })

  it('PUT /api/settings/:key updates a value and GET reflects the change', async () => {
    const { app } = await import('../../server/index')
    const putRes = await request(app)
      .put('/api/settings/mx4_nightly_time')
      .send({ value: '05:30' })
    expect(putRes.status).toBe(200)
    expect(putRes.body.ok).toBe(true)
    const getRes = await request(app).get('/api/settings')
    expect(getRes.body.mx4_nightly_time).toBe('05:30')
  })

  it('PUT /api/settings/:key returns 400 when value is not a string', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .put('/api/settings/mx4_nightly_time')
      .send({ value: 123 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/string/)
  })

  it('PUT /api/settings/:key returns 400 when value is missing', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .put('/api/settings/mx4_nightly_time')
      .send({})
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run test:server -- tests/server/settings.test.ts
```

Expected: fails — route doesn't exist yet.

- [ ] **Step 3: Create `server/api/settings.ts`**

```typescript
import { Router } from 'express'
import { getSetting, setSetting } from '../lib/settings'
import { testConnection } from '../lib/ai/provider'

const settingsRouter = Router()

settingsRouter.get('/', (_req, res) => {
  const db = require('../db/client').default
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as
    { key: string; value: string }[]

  const out: Record<string, string> = {}
  for (const row of rows) {
    if (row.key === 'ai_api_key' && row.value.length > 0) {
      out[row.key] = '••••' + row.value.slice(-4)
    } else {
      out[row.key] = row.value
    }
  }
  res.json(out)
})

settingsRouter.put('/:key', (req, res) => {
  const { key } = req.params
  const { value } = req.body
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'value must be a string' })
  }
  setSetting(key, value)
  res.json({ ok: true })
})

settingsRouter.post('/test-connection', async (_req, res) => {
  const result = await testConnection()
  res.json(result)
})

export default settingsRouter
```

- [ ] **Step 4: Mount route in `server/index.ts`**

Add after the existing imports and before `migrate()`:

```typescript
import settingsRouter from './api/settings'
```

Add after `app.use('/api/mx4', mx4Router)`:

```typescript
app.use('/api/settings', settingsRouter)
```

- [ ] **Step 5: Run — expect PASS**

```bash
npm run test:server -- tests/server/settings.test.ts
```

Expected: 6 passing.

- [ ] **Step 6: Run full suite to confirm no regressions**

```bash
npm run test:server
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/api/settings.ts server/index.ts tests/server/settings.test.ts
git commit -m "feat: settings API — GET/PUT /api/settings, test-connection endpoint"
```

---

## Task 5: `server/lib/ai/provider.ts` — Vercel AI SDK wrapper

**Files:** Create `server/lib/ai/provider.ts`, create `tests/server/provider.test.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p server/lib/ai
```

- [ ] **Step 2: Write the failing tests**

Create `tests/server/provider.test.ts`:

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest'

process.env.DB_PATH = ':memory:'

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'ok' }),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(
    () => (modelId: string) => ({ _provider: 'google', modelId })
  ),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(
    () => (modelId: string) => ({ _provider: 'anthropic', modelId })
  ),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(
    () => (modelId: string) => ({ _provider: 'openai', modelId })
  ),
}))

describe('AI Provider', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('getModel returns a google model with default settings', async () => {
    const { getModel } = await import('../../server/lib/ai/provider')
    const model = getModel('briefing') as any
    expect(model._provider).toBe('google')
    expect(model.modelId).toBe('gemini-2.5-flash')
  })

  it('getModel returns chat model for purpose="chat"', async () => {
    const { getModel } = await import('../../server/lib/ai/provider')
    const model = getModel('chat') as any
    expect(model._provider).toBe('google')
    expect(model.modelId).toBe('gemini-2.5-flash')
  })

  it('getModel switches to anthropic when ai_provider=anthropic', async () => {
    const { setSetting } = await import('../../server/lib/settings')
    setSetting('ai_provider', 'anthropic')
    setSetting('mx4_briefing_model', 'claude-sonnet-4-6')
    const { getModel } = await import('../../server/lib/ai/provider')
    const model = getModel('briefing') as any
    expect(model._provider).toBe('anthropic')
    expect(model.modelId).toBe('claude-sonnet-4-6')
    // restore
    setSetting('ai_provider', 'google')
    setSetting('mx4_briefing_model', 'gemini-2.5-flash')
  })

  it('getModel switches to openai when ai_provider=openai', async () => {
    const { setSetting } = await import('../../server/lib/settings')
    setSetting('ai_provider', 'openai')
    setSetting('mx4_briefing_model', 'gpt-4o')
    const { getModel } = await import('../../server/lib/ai/provider')
    const model = getModel('briefing') as any
    expect(model._provider).toBe('openai')
    expect(model.modelId).toBe('gpt-4o')
    // restore
    setSetting('ai_provider', 'google')
    setSetting('mx4_briefing_model', 'gemini-2.5-flash')
  })

  it('testConnection returns ok:true when generateText succeeds', async () => {
    const { testConnection } = await import('../../server/lib/ai/provider')
    const result = await testConnection()
    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('testConnection returns ok:false when generateText throws', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockRejectedValueOnce(new Error('API key invalid'))
    const { testConnection } = await import('../../server/lib/ai/provider')
    const result = await testConnection()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('API key invalid')
  })

  it('SUPPORTED_MODELS lists models for all three providers', async () => {
    const { SUPPORTED_MODELS } = await import('../../server/lib/ai/provider')
    expect(SUPPORTED_MODELS.google.length).toBeGreaterThan(0)
    expect(SUPPORTED_MODELS.anthropic.length).toBeGreaterThan(0)
    expect(SUPPORTED_MODELS.openai.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
npm run test:server -- tests/server/provider.test.ts
```

Expected: fails — file doesn't exist.

- [ ] **Step 4: Create `server/lib/ai/provider.ts`**

```typescript
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { getSetting } from '../settings'

export const SUPPORTED_MODELS: Record<string, string[]> = {
  google:    ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.5-flash'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8'],
  openai:    ['gpt-4o-mini', 'gpt-4o', 'o3'],
}

export function getModel(purpose: 'briefing' | 'chat'): LanguageModel {
  const provider  = getSetting('ai_provider')       ?? 'google'
  const apiKey    = getSetting('ai_api_key')        ?? ''
  const modelId   = purpose === 'briefing'
    ? (getSetting('mx4_briefing_model') ?? 'gemini-2.5-flash')
    : (getSetting('mx4_chat_model')     ?? 'gemini-2.5-flash')

  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey })
      return anthropic(modelId)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey })
      return openai(modelId)
    }
    case 'google':
    default: {
      const google = createGoogleGenerativeAI({ apiKey })
      return google(modelId)
    }
  }
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { generateText } = await import('ai')
    const model = getModel('chat')
    await generateText({ model, prompt: 'Reply with only: ok', maxTokens: 5 })
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
npm run test:server -- tests/server/provider.test.ts
```

Expected: 7 passing.

- [ ] **Step 6: Run full test suite**

```bash
npm run test:server
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add server/lib/ai/provider.ts tests/server/provider.test.ts
git commit -m "feat: AI provider layer — Vercel AI SDK wrapper with multi-provider support"
```

---

## Task 6: `server/lib/ai/tools.ts` — MX-4 tool definitions

**Files:** Create `server/lib/ai/tools.ts`, create `tests/server/tools.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/server/tools.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

process.env.DB_PATH = ':memory:'

const TEST_WIKI_DIR  = path.join(os.tmpdir(), 'bacta-wiki-test-' + process.pid)
const TEST_VAULT_DIR = path.join(os.tmpdir(), 'bacta-vault-test-' + process.pid)
process.env.WIKI_DIR       = TEST_WIKI_DIR
process.env.VAULT_WIKI_ROOT = TEST_VAULT_DIR

describe('MX-4 Tools', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { default: db } = await import('../../server/db/client')
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      'INSERT INTO garmin_snapshots (date, metric, value, unit) VALUES (?, ?, ?, ?)'
    ).run(today, 'hrv', 52, 'ms')
    fs.mkdirSync(TEST_WIKI_DIR, { recursive: true })
    fs.mkdirSync(TEST_VAULT_DIR, { recursive: true })
    fs.writeFileSync(path.join(TEST_VAULT_DIR, 'test-note.md'), '# Test Note\nSome content.')
  })

  afterAll(() => {
    fs.rmSync(TEST_WIKI_DIR, { recursive: true, force: true })
    fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true })
  })

  describe('queryDb', () => {
    it('returns rows for a valid SELECT', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const today = new Date().toISOString().slice(0, 10)
      const result = await queryDb.execute!({ sql: `SELECT value FROM garmin_snapshots WHERE metric = 'hrv' AND date = '${today}'` }) as any
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].value).toBe(52)
    })

    it('returns error for non-SELECT statement', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const result = await queryDb.execute!({ sql: "DROP TABLE garmin_snapshots" }) as any
      expect(result.error).toMatch(/SELECT/)
    })

    it('returns error for invalid SQL', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const result = await queryDb.execute!({ sql: "SELECT * FROM nonexistent_table" }) as any
      expect(result.error).toBeDefined()
    })
  })

  describe('readVault', () => {
    it('returns file content when file exists', async () => {
      const { readVault } = await import('../../server/lib/ai/tools')
      const result = await readVault.execute!({ relativePath: 'test-note.md' }) as any
      expect(result.content).toContain('Test Note')
    })

    it('returns error when file does not exist', async () => {
      const { readVault } = await import('../../server/lib/ai/tools')
      const result = await readVault.execute!({ relativePath: 'nonexistent.md' }) as any
      expect(result.error).toBeDefined()
    })
  })

  describe('readAllWikiPages', () => {
    it('returns placeholder when wiki is empty', async () => {
      const { readAllWikiPages } = await import('../../server/lib/ai/tools')
      const result = await readAllWikiPages.execute!({}) as any
      expect(result.content).toContain('empty')
    })

    it('returns page content after a page is written', async () => {
      fs.writeFileSync(path.join(TEST_WIKI_DIR, 'test-page.md'), '# Test\nHello wiki.')
      const { readAllWikiPages } = await import('../../server/lib/ai/tools')
      const result = await readAllWikiPages.execute!({}) as any
      expect(result.content).toContain('Hello wiki.')
    })
  })

  describe('writeWikiPage', () => {
    it('creates a wiki page and returns token estimate', async () => {
      const { writeWikiPage } = await import('../../server/lib/ai/tools')
      const result = await writeWikiPage.execute!({ name: 'hrv-patterns', content: '# HRV Patterns\nBaseline is 52ms.' }) as any
      expect(result.ok).toBe(true)
      expect(result.tokenEstimate).toBeGreaterThan(0)
      expect(fs.existsSync(path.join(TEST_WIKI_DIR, 'hrv-patterns.md'))).toBe(true)
    })

    it('returns a warning when content exceeds 1500 tokens', async () => {
      const { writeWikiPage } = await import('../../server/lib/ai/tools')
      const longContent = 'word '.repeat(2000) // ~2000 words ≈ ~1500+ tokens
      const result = await writeWikiPage.execute!({ name: 'long-page', content: longContent }) as any
      expect(result.warning).toBeDefined()
      expect(result.warning).toContain('1500')
    })
  })

  describe('listWikiPages', () => {
    it('returns page names and token estimates', async () => {
      const { listWikiPages } = await import('../../server/lib/ai/tools')
      const result = await listWikiPages.execute!({}) as any
      expect(result.pages.length).toBeGreaterThan(0)
      expect(result.pages[0]).toHaveProperty('name')
      expect(result.pages[0]).toHaveProperty('tokenEstimate')
    })
  })

  describe('archiveWikiPage', () => {
    it('copies the page to archive directory', async () => {
      const { archiveWikiPage } = await import('../../server/lib/ai/tools')
      const result = await archiveWikiPage.execute!({ name: 'hrv-patterns' }) as any
      expect(result.ok).toBe(true)
      const archiveDir = path.join(TEST_WIKI_DIR, 'archive')
      const files = fs.readdirSync(archiveDir)
      expect(files.some(f => f.includes('hrv-patterns'))).toBe(true)
    })

    it('returns error when page does not exist', async () => {
      const { archiveWikiPage } = await import('../../server/lib/ai/tools')
      const result = await archiveWikiPage.execute!({ name: 'nonexistent-page' }) as any
      expect(result.error).toBeDefined()
    })
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run test:server -- tests/server/tools.test.ts
```

Expected: fails — file doesn't exist.

- [ ] **Step 3: Create `server/lib/ai/tools.ts`**

```typescript
import { tool } from 'ai'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import db from '../../db/client'

const WIKI_DIR   = process.env.WIKI_DIR       ?? path.join(process.cwd(), 'mx4', 'wiki')
const VAULT_ROOT = process.env.VAULT_WIKI_ROOT ?? '/mnt/vault/wiki'

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export const queryDb = tool({
  description: 'Run a read-only SQL SELECT query against the Garmin biometric database (garmin_snapshots, garmin_activities)',
  parameters: z.object({
    sql: z.string().describe('SQL SELECT query to execute'),
  }),
  execute: async ({ sql }) => {
    if (!sql.trim().toUpperCase().startsWith('SELECT')) {
      return { error: 'Only SELECT queries are permitted' }
    }
    try {
      const rows = db.prepare(sql).all()
      return { rows }
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  },
})

export const readVault = tool({
  description: "Read a file from Ethan's Obsidian vault wiki for personal context",
  parameters: z.object({
    relativePath: z.string().describe('Path relative to vault wiki root, e.g. "training/summer-plan.md"'),
  }),
  execute: async ({ relativePath }) => {
    try {
      const content = fs.readFileSync(path.join(VAULT_ROOT, relativePath), 'utf-8')
      return { content }
    } catch {
      return { error: `Vault not accessible or file not found: ${relativePath}` }
    }
  },
})

export const readAllWikiPages = tool({
  description: "Load all of MX-4's persistent wiki pages into context",
  parameters: z.object({}),
  execute: async () => {
    if (!fs.existsSync(WIKI_DIR)) return { content: '(wiki not yet initialized)' }
    const files = fs.readdirSync(WIKI_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
    if (files.length === 0) return { content: '(wiki is empty)' }
    const parts = files.map(f => {
      const content = fs.readFileSync(path.join(WIKI_DIR, f), 'utf-8')
      return `\n\n=== ${f} ===\n${content}`
    })
    return { content: parts.join('') }
  },
})

export const writeWikiPage = tool({
  description: 'Write or update a wiki page. Returns a warning if the page exceeds 1500 estimated tokens.',
  parameters: z.object({
    name:    z.string().describe('Page filename without extension, e.g. "hrv-patterns"'),
    content: z.string().describe('Full markdown content for the page'),
  }),
  execute: async ({ name, content }) => {
    fs.mkdirSync(WIKI_DIR, { recursive: true })
    fs.writeFileSync(path.join(WIKI_DIR, `${name}.md`), content, 'utf-8')
    const tokenEstimate = estimateTokens(content)
    const warning = tokenEstimate > 1500
      ? `Page is ~${tokenEstimate} estimated tokens (soft limit 1500, hard limit 2000). Synthesis required before next write if over 2000.`
      : undefined
    return { ok: true, tokenEstimate, warning }
  },
})

export const listWikiPages = tool({
  description: 'List all wiki pages with estimated token counts. Used by the wrap step to detect pages needing synthesis.',
  parameters: z.object({}),
  execute: async () => {
    if (!fs.existsSync(WIKI_DIR)) return { pages: [] }
    const files = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.md')).sort()
    const pages = files.map(f => {
      const content = fs.readFileSync(path.join(WIKI_DIR, f), 'utf-8')
      return { name: f.replace('.md', ''), tokenEstimate: estimateTokens(content) }
    })
    return { pages }
  },
})

export const archiveWikiPage = tool({
  description: 'Copy the current version of a wiki page to the archive directory before rewriting with a synthesis.',
  parameters: z.object({
    name: z.string().describe('Page filename without extension, e.g. "hrv-patterns"'),
  }),
  execute: async ({ name }) => {
    const srcPath = path.join(WIKI_DIR, `${name}.md`)
    if (!fs.existsSync(srcPath)) return { error: `Page not found: ${name}` }
    const archiveDir = path.join(WIKI_DIR, 'archive')
    fs.mkdirSync(archiveDir, { recursive: true })
    const date      = new Date().toISOString().slice(0, 10)
    const destPath  = path.join(archiveDir, `${date}-${name}.md`)
    fs.copyFileSync(srcPath, destPath)
    return { ok: true, archivedTo: `archive/${date}-${name}.md` }
  },
})
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm run test:server -- tests/server/tools.test.ts
```

Expected: all passing.

- [ ] **Step 5: Run full suite**

```bash
npm run test:server
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/lib/ai/tools.ts tests/server/tools.test.ts
git commit -m "feat: MX-4 tool definitions — queryDb, readVault, wiki read/write/list/archive"
```

---

## Task 7: Extend `theme.ts` + `Sigil.tsx` for the settings section

**Files:** `client/src/theme.ts`, `client/src/components/primitives/Sigil.tsx`

- [ ] **Step 1: Read the current theme.ts**

Open `client/src/theme.ts`. Find `SectionKey`, `SECTION_ACCENTS`, and `SECTION_LABELS`. Add `'settings'` to each.

In `SectionKey` union: add `| 'settings'`

In `SECTION_ACCENTS`: add `settings: MX4_COLOR`

In `SECTION_LABELS`: add `settings: 'CONFIGURATION'`

- [ ] **Step 2: Add the settings sigil to `Sigil.tsx`**

Read `client/src/components/primitives/Sigil.tsx`. Find the switch/map over section keys. Add a `'settings'` case that renders a simple gear-like icon:

```tsx
case 'settings':
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If SectionKey is used as an exhaustive type anywhere, TypeScript will surface any missed cases.

- [ ] **Step 4: Run client tests**

```bash
npm run test:client
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/theme.ts client/src/components/primitives/Sigil.tsx
git commit -m "feat: add settings section key, accent, label, and gear sigil"
```

---

## Task 8: `SettingsPage.tsx`

**Files:** Create `client/src/pages/SettingsPage.tsx`

The page fetches settings on mount, saves each field on change (no submit button), and shows a brief `SAVED ·` confirmation. The Test button calls `POST /api/settings/test-connection`.

- [ ] **Step 1: Create `client/src/pages/SettingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Rail } from '../components/viz/Rail'
import { COLORS, FONT_MONO, FONT_UI, MX4_COLOR, SUPPORTED_MODELS_BY_PROVIDER } from '../theme'
import { hexA } from '../lib/hexA'

const PROVIDERS = ['google', 'anthropic', 'openai'] as const
const PROVIDER_LABELS: Record<string, string> = {
  google: 'Gemini', anthropic: 'Claude', openai: 'OpenAI',
}

// Mirrors SUPPORTED_MODELS in server/lib/ai/provider.ts
const MODELS_BY_PROVIDER: Record<string, string[]> = {
  google:    ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.5-flash'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8'],
  openai:    ['gpt-4o-mini', 'gpt-4o', 'o3'],
}

type Settings = Record<string, string>

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [apiKeyFocused, setApiKeyFocused] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((s: Settings) => {
      setSettings(s)
      // Don't pre-fill the masked key — user must re-type to change
    })
  }, [])

  const save = async (key: string, value: string) => {
    await fetch(`/api/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    setSettings(prev => ({ ...prev, [key]: value }))
    setSavedKey(key)
    setTimeout(() => setSavedKey(null), 1500)
  }

  const saveApiKey = async () => {
    if (!apiKeyDraft) return
    await save('ai_api_key', apiKeyDraft)
    setApiKeyDraft('')
    setApiKeyFocused(false)
  }

  const testConn = async () => {
    setTestStatus('testing')
    setTestError('')
    try {
      const res = await fetch('/api/settings/test-connection', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setTestStatus('ok')
        setTimeout(() => setTestStatus('idle'), 3000)
      } else {
        setTestStatus('error')
        setTestError(data.error ?? 'Unknown error')
      }
    } catch {
      setTestStatus('error')
      setTestError('Network error')
    }
  }

  const provider = settings.ai_provider ?? 'google'
  const models   = MODELS_BY_PROVIDER[provider] ?? []

  const savedBadge = (key: string) =>
    savedKey === key ? (
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: MX4_COLOR, letterSpacing: '0.1em' }}>
        SAVED ·
      </span>
    ) : null

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '11px 0',
    borderBottom: `1px solid ${COLORS.line}`,
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: FONT_UI,
    fontSize: 13.5,
    color: COLORS.textSecondary,
    flexShrink: 0,
  }

  return (
    <AppShell section="settings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* ── AI PROVIDER ── */}
        <Rail label="AI PROVIDER" accent={MX4_COLOR} />
        <div style={{ background: COLORS.surface, borderRadius: 12, padding: '0 16px', marginBottom: 8 }}>

          {/* Provider selector */}
          <div style={rowStyle}>
            <span style={labelStyle}>Provider</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {savedBadge('ai_provider')}
              {PROVIDERS.map(p => (
                <button
                  key={p}
                  onClick={() => {
                    save('ai_provider', p)
                    // Reset models to first valid for new provider
                    const firstModel = MODELS_BY_PROVIDER[p]?.[0] ?? ''
                    save('mx4_briefing_model', firstModel)
                    save('mx4_chat_model', firstModel)
                  }}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    letterSpacing: '0.05em',
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${provider === p ? MX4_COLOR : COLORS.line}`,
                    background: provider === p ? hexA(MX4_COLOR, 0.15) : COLORS.surfaceElevated,
                    color: provider === p ? MX4_COLOR : COLORS.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div style={rowStyle}>
            <span style={labelStyle}>API Key</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {savedBadge('ai_api_key')}
              <input
                type={apiKeyFocused ? 'text' : 'password'}
                placeholder={settings.ai_api_key || 'Enter key…'}
                value={apiKeyDraft}
                onFocus={() => setApiKeyFocused(true)}
                onBlur={() => { if (!apiKeyDraft) setApiKeyFocused(false) }}
                onChange={e => setApiKeyDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveApiKey() }}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  width: 160,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: `1px solid ${apiKeyFocused ? hexA(MX4_COLOR, 0.5) : COLORS.line}`,
                  background: COLORS.base,
                  color: COLORS.text,
                  outline: 'none',
                }}
              />
              <button
                onClick={apiKeyDraft ? saveApiKey : testConn}
                disabled={testStatus === 'testing'}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: `1px solid ${hexA(MX4_COLOR, 0.4)}`,
                  background: hexA(MX4_COLOR, 0.12),
                  color: testStatus === 'ok' ? '#4ade80'
                       : testStatus === 'error' ? '#f87171'
                       : MX4_COLOR,
                  cursor: testStatus === 'testing' ? 'not-allowed' : 'pointer',
                }}
              >
                {apiKeyDraft ? 'SAVE'
                 : testStatus === 'testing' ? 'TESTING…'
                 : testStatus === 'ok' ? '✓ OK'
                 : testStatus === 'error' ? '✗ FAIL'
                 : 'TEST'}
              </button>
            </div>
          </div>
          {testStatus === 'error' && testError && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: '#f87171', paddingBottom: 10 }}>
              {testError}
            </div>
          )}
        </div>

        {/* ── MX-4 INTELLIGENCE ── */}
        <Rail label="MX-4 INTELLIGENCE" accent={MX4_COLOR} />
        <div style={{ background: COLORS.surface, borderRadius: 12, padding: '0 16px', marginBottom: 8 }}>

          {/* Briefing model */}
          <div style={rowStyle}>
            <span style={labelStyle}>Briefing model</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {savedBadge('mx4_briefing_model')}
              <select
                value={settings.mx4_briefing_model ?? ''}
                onChange={e => save('mx4_briefing_model', e.target.value)}
                style={{
                  fontFamily: FONT_MONO, fontSize: 11,
                  padding: '6px 10px', borderRadius: 8,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.surfaceElevated,
                  color: COLORS.text, cursor: 'pointer',
                }}
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Chat model */}
          <div style={rowStyle}>
            <span style={labelStyle}>Chat model</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {savedBadge('mx4_chat_model')}
              <select
                value={settings.mx4_chat_model ?? ''}
                onChange={e => save('mx4_chat_model', e.target.value)}
                style={{
                  fontFamily: FONT_MONO, fontSize: 11,
                  padding: '6px 10px', borderRadius: 8,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.surfaceElevated,
                  color: COLORS.text, cursor: 'pointer',
                }}
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Nightly toggle + time */}
          <div style={rowStyle}>
            <span style={labelStyle}>Nightly sync</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {savedBadge('mx4_nightly_enabled')}
              <Toggle
                on={settings.mx4_nightly_enabled === 'true'}
                onChange={v => save('mx4_nightly_enabled', String(v))}
              />
              {settings.mx4_nightly_enabled === 'true' && (
                <>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textMuted }}>at</span>
                  <input
                    type="text"
                    value={settings.mx4_nightly_time ?? '04:00'}
                    onChange={e => save('mx4_nightly_time', e.target.value)}
                    pattern="[0-2][0-9]:[0-5][0-9]"
                    style={{
                      fontFamily: FONT_MONO, fontSize: 12, width: 56,
                      padding: '5px 8px', borderRadius: 7,
                      border: `1px solid ${COLORS.line}`,
                      background: COLORS.base, color: COLORS.text,
                      textAlign: 'center', outline: 'none',
                    }}
                  />
                  {savedBadge('mx4_nightly_time')}
                </>
              )}
            </div>
          </div>

          {/* Sync toggle */}
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <span style={labelStyle}>Sync on Garmin</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {savedBadge('mx4_on_sync_enabled')}
              <Toggle
                on={settings.mx4_on_sync_enabled === 'true'}
                onChange={v => save('mx4_on_sync_enabled', String(v))}
              />
            </div>
          </div>
        </div>

        {/* ── GARMIN (placeholder) ── */}
        <Rail label="GARMIN" accent={MX4_COLOR} />
        <div style={{
          background: COLORS.surface, borderRadius: 12, padding: '14px 16px',
          fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.1em',
          color: COLORS.textMuted, marginBottom: 8,
        }}>
          SYNC PREFERENCES — COMING SOON
        </div>

      </div>
    </AppShell>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        position: 'relative',
        width: 42,
        height: 24,
        borderRadius: 12,
        border: `1px solid ${on ? MX4_COLOR : COLORS.line}`,
        background: on ? hexA(MX4_COLOR, 0.2) : COLORS.surfaceElevated,
        cursor: 'pointer',
        padding: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 20 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: on ? MX4_COLOR : COLORS.textMuted,
          transition: 'left 0.15s, background 0.15s',
        }}
      />
    </button>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Fix any TypeScript errors before continuing.

- [ ] **Step 3: Run client tests**

```bash
npm run test:client
```

Expected: all pass (no SettingsPage tests yet — visual verification comes in Task 9).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/SettingsPage.tsx
git commit -m "feat: SettingsPage — provider selector, API key, model dropdowns, MX-4 toggles"
```

---

## Task 9: Wire route + NavSheet entry

**Files:** `client/src/App.tsx`, `client/src/components/BottomSheet.tsx`

- [ ] **Step 1: Add `/settings` route to `App.tsx`**

```tsx
import { SettingsPage } from './pages/SettingsPage'

// Inside <Routes>:
<Route path="/settings" element={<SettingsPage />} />
```

- [ ] **Step 2: Add Settings entry to `BottomSheet.tsx`**

Add after the closing `</div>` of the 6-section channel grid (before the Footer div). This adds a slim system-row button below the channels:

```tsx
{/* SYSTEM divider */}
<div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, marginBottom: 10 }}>
  <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.18em', color: COLORS.textMuted }}>
    SYSTEM
  </span>
  <span style={{ flex: 1, height: 1, background: COLORS.line }} />
</div>

{/* Settings button */}
<button
  onClick={() => { navigate('/settings'); onClose() }}
  style={{
    width: '100%',
    textAlign: 'left',
    font: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: COLORS.surface,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 10,
    padding: '11px 14px',
    marginBottom: 4,
  }}
>
  <span style={{
    flexShrink: 0,
    width: 32, height: 32,
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: hexA(MX4_COLOR, 0.1),
    border: `1px solid ${hexA(MX4_COLOR, 0.25)}`,
  }}>
    <Sigil name="settings" color={MX4_COLOR} size={16} />
  </span>
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 13.5, fontWeight: 650, color: COLORS.text }}>Configuration</div>
    <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textSecondary, marginTop: 2 }}>
      API KEYS · MODELS · SCHEDULE
    </div>
  </div>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={COLORS.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9,5 16,12 9,19" />
  </svg>
</button>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx client/src/components/BottomSheet.tsx
git commit -m "feat: wire /settings route and add Configuration entry to NavSheet"
```

---

## Task 10: Visual verification

**Files:** none (read-only verification step)

- [ ] **Step 1: Start dev servers**

```bash
npm run dev:server &
npm run dev:client &
```

- [ ] **Step 2: Open app and navigate to Settings via NavSheet**

```
Use /run skill or Playwright:
1. Navigate to http://localhost:5173
2. Tap the nav circle (bottom right)
3. Verify "Configuration" entry appears under a SYSTEM divider below the channel grid
4. Tap Configuration
5. Verify Settings page loads with MX-4 cyan accent, back chevron in TopBar, CONFIGURATION label
6. Verify three Rail sections: AI PROVIDER, MX-4 INTELLIGENCE, GARMIN
7. Verify provider segmented control shows Gemini/Claude/OpenAI
8. Verify model dropdowns update when provider changes
9. Toggle Nightly sync — verify time input appears/disappears
10. Toggle Sync on Garmin — verify toggles animate
```

- [ ] **Step 3: Test API key flow**

```
1. Type a fake key in the API Key field
2. Press Enter or SAVE — verify SAVED · confirmation flashes
3. Reload page — verify field shows masked ••••{last4}
4. Tap TEST — verify button shows TESTING… then ✗ FAIL (expected — fake key)
```

- [ ] **Step 4: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: MX-4 Phase 1 complete — settings page, AI provider layer, tool definitions"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ `app_settings` table with defaults — Task 2 + 3
- ✅ `GET /api/settings` with masked key — Task 4
- ✅ `PUT /api/settings/:key` — Task 4
- ✅ `POST /api/settings/test-connection` — Task 4 (on `settingsRouter`)
- ✅ `server/lib/ai/provider.ts` with `getModel` + `testConnection` — Task 5
- ✅ `SUPPORTED_MODELS` constant — Task 5
- ✅ Provider reads settings at call time (no restart needed) — Task 5 implementation
- ✅ All 6 tools implemented — Task 6
- ✅ `WIKI_DIR` + `VAULT_WIKI_ROOT` env overrides for testability — Task 6
- ✅ `'settings'` added to `SectionKey`, `SECTION_ACCENTS`, `SECTION_LABELS` — Task 7
- ✅ Gear sigil added to `Sigil.tsx` — Task 7
- ✅ Three-rail settings page (AI PROVIDER, MX-4 INTELLIGENCE, GARMIN placeholder) — Task 8
- ✅ Provider segmented control + model dropdowns reset on provider change — Task 8
- ✅ Nightly time input visible only when nightly toggle is on — Task 8
- ✅ `Toggle` component (inline, no CSS classes) — Task 8
- ✅ `/settings` route in `App.tsx` — Task 9
- ✅ NavSheet Settings entry under SYSTEM divider — Task 9

**Not in Phase 1 (deliberately deferred):**
- "Last run" timestamp in settings — requires `mx4_briefings` to have data (Phase 2)
- `node-cron` scheduler initialization — Phase 2 (orchestrator)
- `mx4/wiki/` directory and SCHEMA.md — Phase 2
