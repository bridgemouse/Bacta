# Pre-Release Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Custom Skills (user-defined prompt pills in AskSheet), Vault Integration (MCP-based LLM-Wiki connection), and three tech-debt cleanups before E2E testing.

**Architecture:** Custom skills stored as JSON in `app_settings`, fetched by AskSheet on open, displayed as a swipeable 3-per-page carousel replacing the hardcoded SYNC WIKI pill. Vault uses `@modelcontextprotocol/sdk` to connect to an SSE MCP server at a configurable URL, replacing the old filesystem `readVault` tool. Tech debts are in-place deletions/edits with no new abstractions.

**Tech Stack:** React 19 + TypeScript, Express 5, Vitest, supertest, `@modelcontextprotocol/sdk`, Vercel AI SDK (`ai` package)

---

## File Map

| File | Change |
|---|---|
| `server/lib/settings.ts` | Add `mx4_custom_skills`, `vault_enabled`, `vault_url` to `SETTING_DEFAULTS` |
| `server/api/settings.ts` | Add `GET /custom-skills`, `POST /test-vault-connection`; reset vault client on key changes |
| `server/lib/ai/vaultClient.ts` | **New** — MCP client singleton, 4 vault tools, `isVaultEnabled`, `testVaultConnection`, `resetVaultClient` |
| `server/lib/ai/tools.ts` | Remove `readVault` tool and `VAULT_ROOT` constant |
| `server/lib/ai/orchestrator.ts` | Import vault tools, merge conditionally into `generateText`, update tool-hint prompt |
| `server/lib/ai/sections.ts` | Remove 2× "Do not attempt readVault" guards |
| `client/src/pages/SettingsPage.tsx` | Add CUSTOM SKILLS rail + VAULT rail |
| `client/src/components/AskSheet.tsx` | Fetch custom skills on open, replace SYNC WIKI pill with swipeable carousel |
| `client/src/components/MX4Card.tsx` | Delete deprecated `MX4Card` function and `MX4Insight` interface |
| `tests/server/settings.test.ts` | Add tests for `GET /custom-skills`, vault defaults |
| `tests/server/vaultClient.test.ts` | **New** — unit tests for `isVaultEnabled`, `testVaultConnection`, `getVaultTools` |
| `tests/server/tools.test.ts` | Remove `readVault` test block and `VAULT_WIKI_ROOT` env setup |
| `tests/client/components/AskSheet.test.tsx` | Add skill carousel tests, update mocks |
| `tests/client/components/MX4Card.test.tsx` | Remove any tests for deprecated `MX4Card` / `MX4Insight` |
| `docs/ARCHITECTURE.md` | Fix two stale paragraphs about orchestrator format |
| `mx4/sections.py` | Add deprecation header |
| `mx4/orchestrator.py` | Add deprecation header |

---

## Task 1: Custom Skills — Server (defaults + GET /custom-skills)

**Files:**
- Modify: `server/lib/settings.ts`
- Modify: `server/api/settings.ts`
- Modify: `tests/server/settings.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/server/settings.test.ts`:

```typescript
  it('GET /api/settings/custom-skills returns seeded SYNC WIKI skill', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings/custom-skills')
    expect(res.status).toBe(200)
    expect(res.body.skills).toHaveLength(1)
    expect(res.body.skills[0].label).toBe('SYNC WIKI')
    expect(res.body.skills[0].prompt).toContain('wiki pages')
  })

  it('GET /api/settings/custom-skills returns updated skills after PUT', async () => {
    const { app } = await import('../../server/index')
    const updated = [
      { label: 'SYNC WIKI', prompt: 'Review your wiki pages and update them based on our conversation so far. Write any new patterns or findings worth preserving.' },
      { label: 'WEEKLY REVIEW', prompt: 'Give me a full weekly review of all systems.' },
    ]
    await request(app)
      .put('/api/settings/mx4_custom_skills')
      .send({ value: JSON.stringify(updated) })
    const res = await request(app).get('/api/settings/custom-skills')
    expect(res.body.skills).toHaveLength(2)
    expect(res.body.skills[1].label).toBe('WEEKLY REVIEW')
  })

  it('GET /api/settings/custom-skills returns empty array when setting is invalid JSON', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('mx4_custom_skills', 'not-json')").run()
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings/custom-skills')
    expect(res.status).toBe(200)
    expect(res.body.skills).toEqual([])
  })
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose 2>&1 | grep -A2 "custom-skills"
```

Expected: 3 failing tests (route not found).

- [ ] **Step 3: Add `mx4_custom_skills` to settings defaults**

In `server/lib/settings.ts`, add to `SETTING_DEFAULTS`:

```typescript
export const SETTING_DEFAULTS: Record<string, string> = {
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
}
```

- [ ] **Step 4: Add `GET /custom-skills` route to settings API**

In `server/api/settings.ts`, add `getSetting` to the import and add the route before `PUT /:key`:

```typescript
import { setSetting, getSetting } from '../lib/settings'
```

```typescript
settingsRouter.get('/custom-skills', (_req, res) => {
  const raw = getSetting('mx4_custom_skills')
  try {
    const skills = raw ? JSON.parse(raw) : []
    res.json({ skills })
  } catch {
    res.json({ skills: [] })
  }
})
```

Place this block after the `POST /test-connection` handler and before `PUT /:key`.

- [ ] **Step 5: Run tests and confirm they pass**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose 2>&1 | grep -A2 "custom-skills"
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add server/lib/settings.ts server/api/settings.ts tests/server/settings.test.ts
git commit -m "$(cat <<'EOF'
feat: add custom skills setting default and GET /custom-skills endpoint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Custom Skills — Settings UI (CUSTOM SKILLS rail)

**Files:**
- Modify: `client/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add skills state + load in the settings fetch useEffect**

In `SettingsPage`, add three new state variables and a helper after the existing state declarations:

```typescript
const [skills, setSkills] = useState<Array<{ label: string; prompt: string }>>([])
const [showAddForm, setShowAddForm] = useState(false)
const [newLabel, setNewLabel] = useState('')
const [newPrompt, setNewPrompt] = useState('')
```

Replace the existing `useEffect` that fetches settings:

```typescript
useEffect(() => {
  fetch('/api/settings').then(r => r.json()).then(setSettings)
  fetch('/api/settings/custom-skills').then(r => r.json()).then(d => setSkills(d.skills ?? []))
}, [])
```

- [ ] **Step 2: Add skill helpers**

Add after the `save` function:

```typescript
async function saveSkills(updated: Array<{ label: string; prompt: string }>) {
  await fetch('/api/settings/mx4_custom_skills', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: JSON.stringify(updated) }),
  })
  setSkills(updated)
}

async function deleteSkill(index: number) {
  await saveSkills(skills.filter((_, i) => i !== index))
}

async function addSkill() {
  if (!newLabel.trim() || !newPrompt.trim()) return
  await saveSkills([...skills, { label: newLabel.trim(), prompt: newPrompt.trim() }])
  setNewLabel('')
  setNewPrompt('')
  setShowAddForm(false)
}
```

- [ ] **Step 3: Add CUSTOM SKILLS rail and card to the JSX**

Insert this block between the closing `</div>` of the MX-4 INTELLIGENCE card and `{/* Rail 3: DATA MANAGEMENT */}`:

```tsx
      {/* Rail: CUSTOM SKILLS */}
      <Rail label="CUSTOM SKILLS" accent={MX4_COLOR} />

      <div style={cardStyle}>
        {skills.map((skill, i) => {
          const isLocked = i === 0
          const isLast = i === skills.length - 1
          return (
            <div key={i} style={isLast && !showAddForm ? rowStyleLast : rowStyle}>
              <span style={{ ...labelStyle, fontFamily: FONT_MONO, fontSize: 12, color: COLORS.text }}>
                {skill.label}
              </span>
              {!isLocked && (
                <button
                  onClick={() => deleteSkill(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    color: COLORS.mx4Red,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}

        {showAddForm ? (
          <div style={{ padding: '12px 0' }}>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="LABEL"
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                padding: '7px 10px',
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.surfaceElevated,
                color: COLORS.text,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box' as const,
                marginBottom: 8,
              }}
            />
            <textarea
              value={newPrompt}
              onChange={e => setNewPrompt(e.target.value)}
              placeholder="Full prompt text…"
              rows={3}
              style={{
                fontFamily: FONT_UI,
                fontSize: 13,
                padding: '7px 10px',
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.surfaceElevated,
                color: COLORS.text,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box' as const,
                resize: 'vertical' as const,
                marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAddForm(false); setNewLabel(''); setNewPrompt('') }}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.surfaceElevated,
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={addSkill}
                disabled={!newLabel.trim() || !newPrompt.trim()}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: `1px solid ${MX4_COLOR}`,
                  background: hexA(MX4_COLOR, 0.12),
                  color: MX4_COLOR,
                  cursor: !newLabel.trim() || !newPrompt.trim() ? 'default' : 'pointer',
                }}
              >
                SAVE ›
              </button>
            </div>
          </div>
        ) : (
          <div style={rowStyleLast}>
            <span />
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                cursor: 'pointer',
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.1em',
                color: MX4_COLOR,
              }}
            >
              ADD SKILL ›
            </button>
          </div>
        )}
      </div>
```

- [ ] **Step 4: Type-check**

```bash
cd /opt/bacta && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/SettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat: add CUSTOM SKILLS rail to Settings with add/delete UI

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Custom Skills — AskSheet carousel

**Files:**
- Modify: `client/src/components/AskSheet.tsx`
- Modify: `tests/client/components/AskSheet.test.tsx`

- [ ] **Step 1: Write failing tests**

In `tests/client/components/AskSheet.test.tsx`, add a `global.fetch` mock at the top of the file (after existing `vi.mock` blocks) and new test cases:

```typescript
// Add at top, after existing vi.mock blocks:
const mockSkillsResponse = { skills: [{ label: 'SYNC WIKI', prompt: 'Review your wiki pages...' }] }
global.fetch = vi.fn().mockResolvedValue({
  json: vi.fn().mockResolvedValue(mockSkillsResponse),
} as any)
```

Append to the `describe('AskSheet')` block:

```typescript
  it('does not render hardcoded SYNC WIKI pill', () => {
    renderAsk(true)
    // SYNC WIKI now comes from the API, not a hardcoded constant
    // The hardcoded span with this exact text should not exist
    const pills = document.querySelectorAll('[data-testid="skill-pill"]')
    expect(pills.length).toBe(0) // pills require fetch to resolve
  })

  it('renders skill carousel after skills load', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        skills: [
          { label: 'SYNC WIKI', prompt: 'Review your wiki...' },
          { label: 'WEEKLY REVIEW', prompt: 'Give me a full weekly review.' },
        ],
      }),
    } as any)
    const { rerender } = renderAsk(false)
    rerender(<AskSheet open={true} onClose={vi.fn()} accent="#2bc4e8" section="home" />)
    await screen.findByText('SYNC WIKI ›')
    expect(screen.getByText('WEEKLY REVIEW ›')).toBeInTheDocument()
  })

  it('does not render carousel when skills list is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ skills: [] }),
    } as any)
    const { rerender } = renderAsk(false)
    rerender(<AskSheet open={true} onClose={vi.fn()} accent="#2bc4e8" section="home" />)
    // Wait a tick for the effect to run
    await new Promise(r => setTimeout(r, 10))
    expect(document.querySelector('[data-testid="skill-carousel"]')).toBeNull()
  })
```

- [ ] **Step 2: Run tests and confirm new ones fail**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose tests/client/components/AskSheet.test.tsx 2>&1 | tail -20
```

Expected: new tests fail; existing tests still pass.

- [ ] **Step 3: Remove hardcoded WIKI_PROMPT and SYNC WIKI pill from AskSheet.tsx**

Delete these lines:

```typescript
const WIKI_PROMPT = 'Review your wiki pages and update them based on our conversation so far. Write any new patterns or findings worth preserving.'
```

Delete the entire `<div style={{ display: 'flex', paddingBottom: 8 }}>` block containing the SYNC WIKI span (currently lines ~257–275 of AskSheet.tsx).

- [ ] **Step 4: Add skills state, fetch, and carousel**

Update the existing React import at the top of AskSheet.tsx to include `useState`:

```typescript
import { useRef, useEffect, useState } from 'react'
```

Add state and helpers inside `AskSheet` function, after existing hook calls:

```typescript
const [skills, setSkills] = useState<Array<{ label: string; prompt: string }>>([])
const [activePage, setActivePage] = useState(0)
const carouselRef = useRef<HTMLDivElement>(null)

function chunkSkills(arr: typeof skills, size: number) {
  const out: (typeof skills)[] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function handleCarouselScroll() {
  if (!carouselRef.current) return
  const { scrollLeft, clientWidth } = carouselRef.current
  if (clientWidth > 0) setActivePage(Math.round(scrollLeft / clientWidth))
}
```

In the existing `useEffect` that runs on `open`, add the skills fetch:

```typescript
useEffect(() => {
  if (open) {
    loadMessages()
    fetch('/api/settings/custom-skills')
      .then(r => r.json())
      .then(d => setSkills(d.skills ?? []))
      .catch(() => {})
    if (textareaRef.current) autoResize(textareaRef.current)
    const t = setTimeout(() => textareaRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open])
```

- [ ] **Step 5: Add carousel JSX**

In the `{showSuggested && (...)}` block, replace the removed SYNC WIKI block with the carousel. Place it after the `</div>` that closes the suggested prompts `flexWrap` row:

```tsx
{showSuggested && skills.length > 0 && (() => {
  const pages = chunkSkills(skills, 3)
  return (
    <>
      <div
        ref={carouselRef}
        onScroll={handleCarouselScroll}
        data-testid="skill-carousel"
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          gap: 0,
          paddingBottom: 4,
        }}
      >
        {pages.map((page, pi) => (
          <div
            key={pi}
            style={{
              flex: '0 0 100%',
              scrollSnapAlign: 'start',
              display: 'flex',
              flexWrap: 'wrap' as const,
              gap: 8,
            }}
          >
            {page.map(skill => (
              <span
                key={skill.label}
                onClick={() => submit(skill.prompt)}
                data-testid="skill-pill"
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: accent,
                  background: hexA(accent, 0.08),
                  border: `1px solid ${hexA(accent, 0.25)}`,
                  borderRadius: 18,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                {skill.label} ›
              </span>
            ))}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', paddingBottom: 8 }}>
          {pages.map((_, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i === activePage ? accent : COLORS.line,
              }}
            />
          ))}
        </div>
      )}
    </>
  )
})()}
```

- [ ] **Step 6: Run all tests**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose tests/client/components/AskSheet.test.tsx 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 7: Type-check**

```bash
cd /opt/bacta && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/AskSheet.tsx tests/client/components/AskSheet.test.tsx
git commit -m "$(cat <<'EOF'
feat: replace hardcoded SYNC WIKI pill with custom skills carousel in AskSheet

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Vault Integration — npm + vaultClient.ts + settings defaults

**Files:**
- Run: `npm install @modelcontextprotocol/sdk`
- Create: `server/lib/ai/vaultClient.ts`
- Modify: `server/lib/settings.ts`
- Create: `tests/server/vaultClient.test.ts`

- [ ] **Step 1: Install the MCP SDK**

```bash
cd /opt/bacta && npm install @modelcontextprotocol/sdk
```

Expected: package added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Write failing tests**

Create `tests/server/vaultClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.DB_PATH = ':memory:'

vi.mock('../../server/lib/settings', () => ({
  getSetting: vi.fn(),
}))

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({ content: 'mock result' }),
  })),
}))

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn(),
}))

describe('vaultClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isVaultEnabled', () => {
    it('returns false when vault_enabled is false', async () => {
      const { getSetting } = await import('../../server/lib/settings')
      vi.mocked(getSetting).mockImplementation(key =>
        key === 'vault_enabled' ? 'false' : 'http://192.168.1.202:8765'
      )
      const { isVaultEnabled } = await import('../../server/lib/ai/vaultClient')
      expect(isVaultEnabled()).toBe(false)
    })

    it('returns false when vault_url is empty', async () => {
      const { getSetting } = await import('../../server/lib/settings')
      vi.mocked(getSetting).mockImplementation(key =>
        key === 'vault_enabled' ? 'true' : ''
      )
      const { isVaultEnabled } = await import('../../server/lib/ai/vaultClient')
      expect(isVaultEnabled()).toBe(false)
    })

    it('returns true when enabled and url set', async () => {
      const { getSetting } = await import('../../server/lib/settings')
      vi.mocked(getSetting).mockImplementation(key =>
        key === 'vault_enabled' ? 'true' : 'http://192.168.1.202:8765'
      )
      const { isVaultEnabled } = await import('../../server/lib/ai/vaultClient')
      expect(isVaultEnabled()).toBe(true)
    })
  })

  describe('testVaultConnection', () => {
    it('returns ok: true with details on successful health check', async () => {
      const { getSetting } = await import('../../server/lib/settings')
      vi.mocked(getSetting).mockReturnValue('http://192.168.1.202:8765')
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ domains: 4, page_count: 34 }),
      } as any)
      const { testVaultConnection } = await import('../../server/lib/ai/vaultClient')
      const result = await testVaultConnection()
      expect(result.ok).toBe(true)
      expect((result.details as any).domains).toBe(4)
      expect((result.details as any).page_count).toBe(34)
    })

    it('returns ok: false on HTTP error', async () => {
      const { getSetting } = await import('../../server/lib/settings')
      vi.mocked(getSetting).mockReturnValue('http://192.168.1.202:8765')
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as any)
      const { testVaultConnection } = await import('../../server/lib/ai/vaultClient')
      const result = await testVaultConnection()
      expect(result.ok).toBe(false)
      expect(result.error).toContain('503')
    })

    it('returns ok: false on network error', async () => {
      const { getSetting } = await import('../../server/lib/settings')
      vi.mocked(getSetting).mockReturnValue('http://192.168.1.202:8765')
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      const { testVaultConnection } = await import('../../server/lib/ai/vaultClient')
      const result = await testVaultConnection()
      expect(result.ok).toBe(false)
      expect(result.error).toContain('ECONNREFUSED')
    })
  })

  describe('getVaultTools', () => {
    it('returns empty object when vault is disabled', async () => {
      const { getSetting } = await import('../../server/lib/settings')
      vi.mocked(getSetting).mockReturnValue('false')
      const { getVaultTools } = await import('../../server/lib/ai/vaultClient')
      const tools = await getVaultTools()
      expect(Object.keys(tools)).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /opt/bacta && npm run test:server -- tests/server/vaultClient.test.ts --reporter=verbose 2>&1 | tail -10
```

Expected: fails — module not found.

- [ ] **Step 4: Create `server/lib/ai/vaultClient.ts`**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { tool } from 'ai'
import { z } from 'zod'
import { getSetting } from '../settings'

let _client: Client | null = null

export function isVaultEnabled(): boolean {
  return getSetting('vault_enabled') === 'true' && !!getSetting('vault_url')
}

export function resetVaultClient(): void {
  _client = null
}

async function getClient(): Promise<Client | null> {
  if (!isVaultEnabled()) return null
  if (_client) return _client

  const url = getSetting('vault_url') ?? ''
  _client = new Client({ name: 'bacta-mx4', version: '1.0.0' }, { capabilities: {} })
  const transport = new SSEClientTransport(new URL(`${url}/sse`))
  await _client.connect(transport)
  return _client
}

export async function testVaultConnection(): Promise<{ ok: boolean; error?: string; details?: object }> {
  try {
    const url = getSetting('vault_url') ?? ''
    const res = await fetch(`${url}/health`)
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    return { ok: true, details: data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getVaultTools() {
  const client = await getClient()
  if (!client) return {}

  return {
    search_wiki: tool({
      description: 'Full-text search across the connected LLM-Wiki vault. Use this before read_wiki_page to find relevant pages.',
      inputSchema: z.object({
        query:  z.string(),
        domain: z.string().optional(),
      }),
      execute: async ({ query, domain }) => {
        return client.callTool({ name: 'search_wiki', arguments: { query, domain } })
      },
    }),
    read_wiki_page: tool({
      description: "Read a specific page from the connected LLM-Wiki vault by path, e.g. 'health-fitness/overview.md'",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => {
        return client.callTool({ name: 'read_wiki_page', arguments: { path } })
      },
    }),
    list_wiki_pages: tool({
      description: 'List all pages in the connected LLM-Wiki vault, optionally filtered by domain.',
      inputSchema: z.object({
        domain: z.string().optional(),
      }),
      execute: async ({ domain }) => {
        return client.callTool({ name: 'list_wiki_pages', arguments: { domain } })
      },
    }),
    get_wiki_index: tool({
      description: 'Get the wiki index — the master catalog of all pages. Read this first to orient before reading individual pages.',
      inputSchema: z.object({}),
      execute: async () => {
        return client.callTool({ name: 'get_wiki_index', arguments: {} })
      },
    }),
  }
}
```

- [ ] **Step 5: Add vault defaults to `server/lib/settings.ts`**

Add to `SETTING_DEFAULTS` (after `mx4_custom_skills`):

```typescript
  vault_enabled: 'false',
  vault_url:     '',
```

- [ ] **Step 6: Run tests**

```bash
cd /opt/bacta && npm run test:server -- tests/server/vaultClient.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all 7 tests pass.

- [ ] **Step 7: Type-check server**

```bash
cd /opt/bacta && npx tsc -p tsconfig.server.json --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json server/lib/ai/vaultClient.ts server/lib/settings.ts tests/server/vaultClient.test.ts
git commit -m "$(cat <<'EOF'
feat: add MCP vault client and vault settings defaults

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Vault Integration — tools.ts + orchestrator.ts + sections.ts cleanup

**Files:**
- Modify: `server/lib/ai/tools.ts`
- Modify: `server/lib/ai/orchestrator.ts`
- Modify: `server/lib/ai/sections.ts`
- Modify: `tests/server/tools.test.ts`

- [ ] **Step 1: Remove `readVault` from tools.ts**

In `server/lib/ai/tools.ts`:
- Delete `const VAULT_ROOT = process.env.VAULT_WIKI_ROOT ?? '/mnt/vault/wiki'` (line 13)
- Delete the entire `export const readVault = tool({...})` block (lines 61–74)

The file's imports (`fs`, `path`) are still used by wiki functions — leave them.

- [ ] **Step 2: Update orchestrator.ts**

In `server/lib/ai/orchestrator.ts`:

Replace the import line:
```typescript
import { queryDb, readVault, readAllWikiPages } from './tools'
```
with:
```typescript
import { queryDb, readAllWikiPages } from './tools'
import { getVaultTools, isVaultEnabled } from './vaultClient'
```

Replace the `sectionPrompt` string (the multi-line template literal ending in "Produce a complete analysis...") — specifically the line:

```typescript
Use queryDb to pull the last 30 days of relevant metrics. Use readVault if you need personal context from the Obsidian vault. Use readAllWikiPages if you need to review accumulated knowledge.
```

with:

```typescript
Use queryDb to pull the last 30 days of relevant metrics. ${isVaultEnabled() ? 'Use get_wiki_index then read_wiki_page or search_wiki to pull personal context from the connected vault.' : ''} Use readAllWikiPages if you need to review accumulated MX-4 knowledge.
```

Replace the `generateText` call's tools object:
```typescript
    tools: { queryDb, readVault, readAllWikiPages },
```
with:
```typescript
    tools: {
      queryDb,
      readAllWikiPages,
      ...(isVaultEnabled() ? await getVaultTools() : {}),
    },
```

Note: `runSection` must be declared `async` — it already is. The `await getVaultTools()` call inside the tools spread requires the `async` keyword on `runSection`.

- [ ] **Step 3: Remove vault guards from sections.ts**

In `server/lib/ai/sections.ts`, remove these two lines (one in training, one in home prompt):

```
Do not attempt readVault — vault is inaccessible per standing orders.
```

Remove the blank line before each if present (keep prompt text coherent).

- [ ] **Step 4: Update tools.test.ts — remove readVault tests and VAULT_WIKI_ROOT setup**

In `tests/server/tools.test.ts`:
- Delete line: `const TEST_VAULT_DIR = path.join(os.tmpdir(), 'bacta-vault-test-' + process.pid)`
- Delete line: `process.env.VAULT_WIKI_ROOT = TEST_VAULT_DIR`
- In `beforeAll`, delete: `fs.mkdirSync(TEST_VAULT_DIR, { recursive: true })` and `fs.writeFileSync(path.join(TEST_VAULT_DIR, 'test-note.md'), '# Test Note\nSome content.')`
- In `afterAll`, delete: `fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true })`
- Delete the entire `describe('readVault', ...)` block (lines 75–87)

- [ ] **Step 5: Run all server tests**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose 2>&1 | tail -30
```

Expected: all server tests pass. The orchestrator test mocks `generateText` at the `ai` module level so vault tool spreading doesn't affect it.

- [ ] **Step 6: Type-check**

```bash
cd /opt/bacta && npx tsc -p tsconfig.server.json --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add server/lib/ai/tools.ts server/lib/ai/orchestrator.ts server/lib/ai/sections.ts tests/server/tools.test.ts
git commit -m "$(cat <<'EOF'
feat: replace readVault filesystem tool with MCP vault client in orchestrator

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Vault Integration — Settings API

**Files:**
- Modify: `server/api/settings.ts`
- Modify: `tests/server/settings.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/server/settings.test.ts`:

```typescript
  it('GET /api/settings includes vault_enabled and vault_url defaults', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.body.vault_enabled).toBe('false')
    expect(res.body.vault_url).toBe('')
  })

  it('POST /api/settings/test-vault-connection returns ok: false when vault url unreachable', async () => {
    const { app } = await import('../../server/index')
    // vault_url is '' by default so health check will fail
    const res = await request(app).post('/api/settings/test-vault-connection')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
  })
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose 2>&1 | grep -A2 "vault"
```

Expected: 2 failures.

- [ ] **Step 3: Update settings API**

In `server/api/settings.ts`, add import:

```typescript
import { testVaultConnection, resetVaultClient } from '../lib/ai/vaultClient'
```

Add route before `PUT /:key`:

```typescript
settingsRouter.post('/test-vault-connection', async (_req, res) => {
  const result = await testVaultConnection()
  res.json(result)
})
```

In the `PUT /:key` handler, add vault client reset after the existing `scheduleNightly` call:

```typescript
  if (key === 'vault_enabled' || key === 'vault_url') {
    resetVaultClient()
  }
```

- [ ] **Step 4: Run tests**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose 2>&1 | grep -A2 "vault"
```

Expected: vault tests pass.

- [ ] **Step 5: Run full server test suite**

```bash
cd /opt/bacta && npm run test:server 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/api/settings.ts tests/server/settings.test.ts
git commit -m "$(cat <<'EOF'
feat: add vault settings API (test-vault-connection endpoint + client reset on change)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Vault Integration — Settings UI (VAULT rail)

**Files:**
- Modify: `client/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add vault state variables**

In `SettingsPage`, add after the existing state declarations:

```typescript
const [vaultUrlInput, setVaultUrlInput] = useState('')
const [vaultTestStatus, setVaultTestStatus] = useState<TestStatus>('idle')
const [vaultDetails, setVaultDetails] = useState('')
```

- [ ] **Step 2: Sync vaultUrlInput when settings load**

The existing `useEffect` currently sets settings. Update it to also init `vaultUrlInput`:

```typescript
useEffect(() => {
  fetch('/api/settings').then(r => r.json()).then(data => {
    setSettings(data)
    setVaultUrlInput(data['vault_url'] ?? '')
  })
  fetch('/api/settings/custom-skills').then(r => r.json()).then(d => setSkills(d.skills ?? []))
}, [])
```

- [ ] **Step 3: Add testVault helper**

Add after the `testConn` function:

```typescript
async function testVault() {
  setVaultTestStatus('testing')
  setVaultDetails('')
  try {
    const res = await fetch('/api/settings/test-vault-connection', { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      setVaultTestStatus('ok')
      if (data.details) {
        const d = data.details as { domains?: number; page_count?: number }
        setVaultDetails(`${d.domains ?? 0} DOMAINS · ${d.page_count ?? 0} PAGES`)
      }
      setTimeout(() => setVaultTestStatus('idle'), 5000)
    } else {
      setVaultTestStatus('error')
    }
  } catch {
    setVaultTestStatus('error')
  }
}
```

- [ ] **Step 4: Add VAULT rail to JSX**

Insert between the MX-4 INTELLIGENCE card and the CUSTOM SKILLS rail:

```tsx
      {/* Rail: VAULT */}
      <Rail label="VAULT" accent={MX4_COLOR} />

      <div style={cardStyle}>
        <div style={settings['vault_enabled'] === 'true' ? rowStyle : rowStyleLast}>
          <span style={labelStyle}>Connect LLM-Wiki</span>
          <Toggle
            on={settings['vault_enabled'] === 'true'}
            onChange={v => save('vault_enabled', String(v))}
          />
        </div>

        {settings['vault_enabled'] === 'true' && (
          <>
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={labelStyle}>Vault URL</span>
                {savedBadge('vault_url')}
              </div>
              <input
                type="text"
                value={vaultUrlInput}
                placeholder="http://192.168.1.x:8765"
                onChange={e => setVaultUrlInput(e.target.value)}
                onBlur={() => { if (vaultUrlInput !== settings['vault_url']) save('vault_url', vaultUrlInput) }}
                onKeyDown={e => { if (e.key === 'Enter') save('vault_url', vaultUrlInput) }}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.surfaceElevated,
                  color: COLORS.text,
                  minWidth: 0,
                  width: 180,
                  outline: 'none',
                }}
              />
            </div>
            <div style={rowStyleLast}>
              <span style={labelStyle}>Connection</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {vaultDetails && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, letterSpacing: '0.06em' }}>
                    {vaultDetails}
                  </span>
                )}
                <button
                  onClick={testVault}
                  disabled={vaultTestStatus === 'testing'}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    padding: '6px 11px',
                    borderRadius: 7,
                    border: `1px solid ${vaultTestStatus === 'ok' ? COLORS.green : vaultTestStatus === 'error' ? COLORS.mx4Red : MX4_COLOR}`,
                    background: hexA(vaultTestStatus === 'ok' ? COLORS.green : vaultTestStatus === 'error' ? COLORS.mx4Red : MX4_COLOR, 0.12),
                    color: vaultTestStatus === 'ok' ? COLORS.green : vaultTestStatus === 'error' ? COLORS.mx4Red : MX4_COLOR,
                    cursor: vaultTestStatus === 'testing' ? 'default' : 'pointer',
                  }}
                >
                  {vaultTestStatus === 'testing' ? 'TESTING…' : vaultTestStatus === 'ok' ? '✓ OK' : vaultTestStatus === 'error' ? '✗ FAIL' : 'TEST ›'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
```

- [ ] **Step 5: Type-check**

```bash
cd /opt/bacta && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/SettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat: add VAULT rail to Settings with toggle, URL input, and connection test

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Tech Debt Cleanups

**Files:**
- Modify: `client/src/components/MX4Card.tsx`
- Modify: `tests/client/components/MX4Card.test.tsx`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `mx4/sections.py`
- Modify: `mx4/orchestrator.py`

- [ ] **Step 1: Read MX4Card.test.tsx to check for deprecated exports**

```bash
grep -n "MX4Card\|MX4Insight" /opt/bacta/tests/client/components/MX4Card.test.tsx
```

If any lines reference `MX4Card` (the deprecated function, not `MX4Briefing`) or `MX4Insight`, delete those test cases.

- [ ] **Step 2: Remove deprecated stub from MX4Card.tsx**

In `client/src/components/MX4Card.tsx`, delete lines 13–26 in their entirety:

```typescript
// ─── Temporary compatibility stub — removed in Task 3 / Task 5 ───
export interface MX4Insight {
  generated_at: string
  summary: string
  tone: 'positive' | 'caution' | 'flag'
  flags: string[]
}

/** @deprecated Use TransmissionPanel instead. This stub returns null until pages are updated in Tasks 3 and 5. */
export function MX4Card(_props: { insight: MX4Insight | null; section: string; isGenerating?: boolean }): null {
  return null
}
// ────────────────────────────────────────────────────────────────
```

Also delete the `useState` import from line 1 if it is now unused (check: `useState` is used by `MX4Briefing`'s `refreshState` — keep it).

- [ ] **Step 3: Run client tests**

```bash
cd /opt/bacta && npm run test:client -- tests/client/components/MX4Card.test.tsx --reporter=verbose 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 4: Update ARCHITECTURE.md stale sections**

In `docs/ARCHITECTURE.md`, find the Express API Routes table entry for `/api/insights/:section` and update:

Old:
```
| `GET` | `/api/insights/:section` | Insight for section — reads `insights/{section}.json` if present, falls back to mock JSON |
```

New:
```
| `GET` | `/api/insights/:section` | Insight for section — reads from `mx4_briefings` DB table, falls back to stub JSON |
```

Find the "Format mismatch" paragraph in the Data Flow section (under MX-4 Intelligence) and delete it entirely. The paragraph reads:

```
**Format mismatch:** `insights.ts` reads and serves `.json` files, but `mx4/orchestrator.py` writes `.html` files. The current mock fallback returns JSON objects with `summary/tone/flags` shape. The actual orchestrator output is an HTML fragment. The frontend currently uses stub text from `stubData.ts BRIEFS` and does not consume the insights endpoint in production. Resolving this mismatch is part of the orchestrator first-run work.
```

Replace with:
```
The TypeScript pipeline (`server/lib/ai/orchestrator.ts`) writes structured JSON to the `mx4_briefings` DB table. `GET /api/insights/:section` reads from that table and falls back to stub JSON when no briefing exists. The Python `mx4/orchestrator.py` is superseded.
```

- [ ] **Step 5: Add deprecation headers to Python files**

In `mx4/sections.py`, add at the very top (line 1):

```python
# SUPERSEDED — replaced by server/lib/ai/sections.ts (TypeScript pipeline).
# Section IDs here ('recovery', 'sleep-quality', 'training-week', 'vo2-fitness')
# do not match the active pipeline's IDs ('recovery', 'sleep', 'training', 'home').
# This file is retained for reference only.
```

In `mx4/orchestrator.py`, add at the very top (line 1):

```python
# SUPERSEDED — replaced by server/lib/ai/orchestrator.ts (TypeScript/Vercel AI SDK pipeline).
# The active orchestrator runs via POST /api/mx4/run and node-cron nightly schedule.
# This file is retained for reference only.
```

- [ ] **Step 6: Run full test suite**

```bash
cd /opt/bacta && npm test 2>&1 | tail -10
```

Expected: all tests pass (same count as before or higher).

- [ ] **Step 7: Type-check both client and server**

```bash
cd /opt/bacta && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/MX4Card.tsx tests/client/components/MX4Card.test.tsx docs/ARCHITECTURE.md mx4/sections.py mx4/orchestrator.py
git commit -m "$(cat <<'EOF'
chore: remove MX4Card stub, update stale ARCHITECTURE.md notes, mark Python orchestrator superseded

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Post-Implementation Verification

After all 8 tasks are committed:

- [ ] Run `npm test` — confirm all tests pass
- [ ] Run `/run` to launch the app in browser
- [ ] Navigate to Settings — verify VAULT rail (toggle + URL input + TEST ›) and CUSTOM SKILLS rail (SYNC WIKI row locked, ADD SKILL › at bottom)
- [ ] Toggle vault on, enter `http://192.168.1.202:8765`, tap TEST › — verify domain/page count appears
- [ ] Open Ask MX-4 — verify SYNC WIKI › pill appears in carousel (no longer hardcoded)
- [ ] Add a second skill in Settings — verify it appears as second pill in AskSheet
- [ ] Add 4+ skills — verify carousel pagination dots appear and swipe works
