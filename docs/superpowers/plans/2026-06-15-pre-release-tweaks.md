# Pre-Release Tweaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six targeted improvements before Bacta v1.0 E2E QA — per-section orchestrator trigger, home re-run setting, iOS zoom fix, auto-growing textarea, per-message section color-coding, and session-persistent visual history clear.

**Architecture:** Server tasks first (export runSectionById, new endpoint, DB migration, chat API updates), then client hooks (useBriefing refresh, useChat section support), then UI components (MX4Briefing refresh button, AskSheet improvements), then wiring (AppShell, section pages, SettingsPage).

**Tech Stack:** TypeScript, Express, better-sqlite3, React 19, Vitest, supertest

---

## Files

- Modify: `server/lib/ai/orchestrator.ts` — export `runSectionById`
- Modify: `server/lib/settings.ts` — add `mx4_home_rerun_mode` default
- Modify: `server/db/migrate.ts` — add `section TEXT` column migration
- Modify: `server/api/mx4.ts` — `POST /run/:section`; section+created_at on all chat endpoints
- Modify: `client/src/hooks/useBriefing.ts` — add `refresh()`, return `{ data, refresh }`
- Modify: `client/src/hooks/useChat.ts` — accept `section?` param; add `hiddenBefore`, `clearVisualHistory`, `created_at` on ChatMessage
- Modify: `client/src/components/MX4Card.tsx` — add `section?`, `onRefresh?` props; REFRESH button
- Modify: `client/src/components/Sheet.tsx` — add `actions?: ReactNode` to SheetHeader
- Modify: `client/src/components/AskSheet.tsx` — `section` prop; iOS fix; auto-grow; per-message colors; CLEAR VIEW
- Modify: `client/src/components/AppShell.tsx` — pass `section` to AskSheet
- Modify: `client/src/pages/RecoveryPage.tsx` — pass `section` + `onRefresh` to MX4Briefing
- Modify: `client/src/pages/SleepPage.tsx` — pass `section` + `onRefresh` to MX4Briefing
- Modify: `client/src/pages/TrainingPage.tsx` — pass `section` + `onRefresh` to MX4Briefing
- Modify: `client/src/pages/HomePage.tsx` — pass `section` + `onRefresh` to MX4Briefing
- Modify: `client/src/pages/SettingsPage.tsx` — home re-run mode toggle
- Modify: `tests/server/mx4.test.ts` — per-section run endpoint tests
- Modify: `tests/server/mx4chat.test.ts` — section + created_at in chat API tests
- Modify: `tests/client/components/AskSheet.test.tsx` — section prop; CLEAR VIEW button
- Modify: `tests/client/components/MX4Card.test.tsx` — REFRESH button rendering

---

### Task 1: Server infrastructure — export runSectionById, setting default, DB migration

**Files:**
- Modify: `server/lib/ai/orchestrator.ts`
- Modify: `server/lib/settings.ts`
- Modify: `server/db/migrate.ts`
- Test: `tests/server/settings.test.ts` (existing — run to confirm no regression)

- [ ] **Step 1: Export `runSectionById` from orchestrator**

In `server/lib/ai/orchestrator.ts`, add this export after the existing `runSection` function (before `runOrchestrator`):

```ts
export async function runSectionById(sectionId: string): Promise<void> {
  const section = SECTIONS.find(s => s.id === sectionId)
  if (!section) throw new Error(`Unknown section: ${sectionId}`)

  const systemPrompt = loadSystemPrompt()
  const wikiContext  = readAllWikiPagesSync()
  const heartbeat    = loadHeartbeat()

  await runSection(section.id, section.name, section.promptAddendum, wikiContext, heartbeat, systemPrompt)
  console.log(`[mx4] ${sectionId} briefing written`)
}
```

- [ ] **Step 2: Add `mx4_home_rerun_mode` to setting defaults**

In `server/lib/settings.ts`, add to `SETTING_DEFAULTS`:

```ts
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
}
```

- [ ] **Step 3: Add `section` column migration**

In `server/db/migrate.ts`, add the new column to the migration list. The existing pattern uses a `NEW_ACTIVITY_COLS` array for `garmin_activities`. Add a similar block for `mx4_chat_messages` after the existing activity columns loop:

```ts
// Add section column to mx4_chat_messages — tracks which section each message was sent from
try {
  db.exec('ALTER TABLE mx4_chat_messages ADD COLUMN section TEXT')
} catch (e: unknown) {
  if (!(e instanceof Error) || !e.message.includes('duplicate column name')) throw e
}
```

- [ ] **Step 4: Run server tests to verify no regressions**

```bash
cd /opt/bacta && npm run test:server
```

Expected: all existing tests pass (settings test confirms new default is picked up via `INSERT OR IGNORE`).

- [ ] **Step 5: Type check**

```bash
cd /opt/bacta && npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add server/lib/ai/orchestrator.ts server/lib/settings.ts server/db/migrate.ts
git commit -m "feat(mx4): export runSectionById, add home rerun setting, migrate section column"
```

---

### Task 2: Per-section run endpoint — `POST /api/mx4/run/:section`

**Files:**
- Modify: `server/api/mx4.ts`
- Modify: `tests/server/mx4.test.ts`

- [ ] **Step 1: Write failing tests**

Replace `tests/server/mx4.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

vi.mock('../../server/lib/ai/orchestrator', () => ({
  runOrchestrator: vi.fn().mockResolvedValue(undefined),
  runSectionById: vi.fn().mockResolvedValue(undefined),
  loadSystemPrompt: vi.fn().mockReturnValue('You are MX-4.'),
}))

describe('MX-4 API', () => {
  it('POST /api/mx4/run returns 202 with ok:true', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/mx4/run')
    expect(res.status).toBe(202)
    expect(res.body.ok).toBe(true)
  })

  it('POST /api/mx4/run response arrives before orchestrator completes', async () => {
    const { app } = await import('../../server/index')
    const start = Date.now()
    await request(app).post('/api/mx4/run')
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(500)
  })

  it('POST /api/mx4/run/:section returns 202 for valid section', async () => {
    const { app } = await import('../../server/index')
    for (const section of ['recovery', 'sleep', 'training', 'home']) {
      const res = await request(app).post(`/api/mx4/run/${section}`)
      expect(res.status).toBe(202)
      expect(res.body.ok).toBe(true)
    }
  })

  it('POST /api/mx4/run/:section returns 404 for unknown section', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/mx4/run/unknown')
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('POST /api/mx4/run/home with home_only setting calls runSectionById not runOrchestrator', async () => {
    const { default: db } = await import('../../server/db/client')
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('mx4_home_rerun_mode', 'home_only')").run()

    const { runOrchestrator, runSectionById } = await import('../../server/lib/ai/orchestrator') as any
    runOrchestrator.mockClear()
    runSectionById.mockClear()

    const { app } = await import('../../server/index')
    await request(app).post('/api/mx4/run/home')
    await new Promise(r => setTimeout(r, 50))

    expect(runSectionById).toHaveBeenCalledWith('home')
    expect(runOrchestrator).not.toHaveBeenCalled()
  })

  it('POST /api/mx4/run/home with all_sections setting calls runOrchestrator', async () => {
    const { default: db } = await import('../../server/db/client')
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('mx4_home_rerun_mode', 'all_sections')").run()

    const { runOrchestrator, runSectionById } = await import('../../server/lib/ai/orchestrator') as any
    runOrchestrator.mockClear()
    runSectionById.mockClear()

    const { app } = await import('../../server/index')
    await request(app).post('/api/mx4/run/home')
    await new Promise(r => setTimeout(r, 50))

    expect(runOrchestrator).toHaveBeenCalled()
    expect(runSectionById).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose tests/server/mx4.test.ts
```

Expected: 3 new tests fail (`run/:section` 202, 404, home routing).

- [ ] **Step 3: Add the endpoint to `server/api/mx4.ts`**

Add the import at the top (update existing orchestrator import):

```ts
import { runOrchestrator, runSectionById, loadSystemPrompt } from '../lib/ai/orchestrator'
```

Add the new route immediately after the existing `mx4Router.post('/run', ...)` block:

```ts
const VALID_RUN_SECTIONS = ['recovery', 'sleep', 'training', 'home']

mx4Router.post('/run/:section', (req, res) => {
  const { section } = req.params
  if (!VALID_RUN_SECTIONS.includes(section)) {
    res.status(404).json({ error: `Unknown section: ${section}` })
    return
  }
  res.status(202).json({ ok: true })
  setImmediate(async () => {
    try {
      const homeRerunMode = getSetting('mx4_home_rerun_mode') ?? 'home_only'
      if (section === 'home' && homeRerunMode === 'all_sections') {
        await runOrchestrator()
      } else {
        await runSectionById(section)
      }
    } catch (err) {
      console.error(`[mx4] section run error (${section}):`, err)
    }
  })
})
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose tests/server/mx4.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Full server test suite**

```bash
cd /opt/bacta && npm run test:server
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add server/api/mx4.ts tests/server/mx4.test.ts
git commit -m "feat(mx4): add POST /run/:section per-section orchestrator endpoint"
```

---

### Task 3: Chat API — add `section` and `created_at` to all endpoints

**Files:**
- Modify: `server/api/mx4.ts`
- Modify: `tests/server/mx4chat.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/server/mx4chat.test.ts` — append these tests inside the `describe('MX-4 Chat API', ...)` block, after the existing tests:

```ts
it('GET /api/mx4/chat/:sessionId returns section and created_at per message', async () => {
  const { default: db } = await import('../../server/db/client')
  db.prepare(
    'INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)'
  ).run('sess-section-test', 'user', 'hello', 'recovery')

  const { app } = await import('../../server/index')
  const res = await request(app).get('/api/mx4/chat/sess-section-test')
  expect(res.status).toBe(200)
  expect(res.body).toHaveLength(1)
  expect(res.body[0].section).toBe('recovery')
  expect(res.body[0].created_at).toBeDefined()
})

it('GET /api/mx4/chat/:sessionId returns null section as undefined for legacy messages', async () => {
  const { default: db } = await import('../../server/db/client')
  db.prepare(
    'INSERT INTO mx4_chat_messages (session_id, role, content) VALUES (?, ?, ?)'
  ).run('sess-legacy-test', 'user', 'legacy message')

  const { app } = await import('../../server/index')
  const res = await request(app).get('/api/mx4/chat/sess-legacy-test')
  expect(res.status).toBe(200)
  expect(res.body[0].section).toBeUndefined()
  expect(res.body[0].created_at).toBeDefined()
})

it('POST /api/mx4/chat stores section on user and assistant messages', async () => {
  const { app } = await import('../../server/index')
  const { default: db } = await import('../../server/db/client')

  await request(app)
    .post('/api/mx4/chat')
    .send({ message: 'section test', sessionId: 'sess-section-write', section: 'sleep' })

  const rows = db.prepare(
    'SELECT role, section FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at'
  ).all('sess-section-write') as { role: string; section: string | null }[]

  expect(rows[0]).toEqual({ role: 'user', section: 'sleep' })
  expect(rows[1]).toEqual({ role: 'assistant', section: 'sleep' })
})

it('POST /api/mx4/chat/seed stores section on seeded message', async () => {
  const { app } = await import('../../server/index')
  await request(app)
    .post('/api/mx4/chat/seed')
    .send({ sessionId: 'seed-section-test', content: 'analysis body', section: 'training' })

  const { default: db } = await import('../../server/db/client')
  const row = db.prepare(
    'SELECT section FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get('seed-section-test') as { section: string | null } | undefined
  expect(row?.section).toBe('training')
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose tests/server/mx4chat.test.ts
```

Expected: the 4 new tests fail.

- [ ] **Step 3: Update chat API in `server/api/mx4.ts`**

**Update `GET /chat/:sessionId`** — change the SELECT and map:

```ts
mx4Router.get('/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const rows = db.prepare(
    `SELECT role, content, section, created_at FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at ASC`
  ).all(sessionId) as { role: string; content: string; section: string | null; created_at: string }[]
  res.json(rows.map(r => ({
    role: r.role,
    content: r.content,
    ...(r.section != null ? { section: r.section } : {}),
    created_at: r.created_at,
  })))
})
```

**Update `POST /chat`** — accept `section` from body and store it on both inserts:

```ts
mx4Router.post('/chat', async (req, res) => {
  const { message, sessionId, section } = req.body as { message?: string; sessionId?: string; section?: string }

  if (typeof message !== 'string' || !message.trim() || typeof sessionId !== 'string' || !sessionId) {
    res.status(400).json({ error: 'message and sessionId required' })
    return
  }

  db.prepare(
    'INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)'
  ).run(sessionId, 'user', message.trim(), section ?? null)

  // Compress if needed before building context
  try {
    await compressSessionIfNeeded(sessionId)
  } catch {
    // Non-fatal — proceed without compression
  }

  const history = loadChatHistory(sessionId)
  const wikiContext = readAllWikiPagesSync()
  const heartbeat = loadHeartbeat()
  const systemBase = loadSystemPrompt()
  const system = [
    systemBase,
    heartbeat ? `\n\n## Standing Orders\n${heartbeat}` : '',
    `\n\n## Wiki Knowledge\n${wikiContext}`,
  ].join('')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const result = streamText({
      model: getModel('chat'),
      system,
      messages: [...history, { role: 'user' as const, content: message.trim() }],
      tools: { queryDb, readVault, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage },
      stopWhen: stepCountIs(8),
    })

    let fullText = ''
    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      fullText += chunk
    }

    if (fullText) {
      db.prepare(
        'INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)'
      ).run(sessionId, 'assistant', fullText, section ?? null)
    } else {
      res.write(`data: ${JSON.stringify({ error: 'no response — check AI provider settings' })}\n\n`)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
  }

  res.write('data: [DONE]\n\n')
  res.end()
})
```

**Update `POST /chat/seed`** — accept `section` and store it:

```ts
mx4Router.post('/chat/seed', (req, res) => {
  const { sessionId, content, section } = req.body as { sessionId?: string; content?: string; section?: string }
  if (typeof sessionId !== 'string' || !sessionId.trim() || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'sessionId and content required' })
    return
  }
  db.prepare(
    'INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)'
  ).run(sessionId.trim(), 'assistant', content.trim(), section ?? null)
  res.json({ ok: true })
})
```

**Update `compressSessionIfNeeded`** — fix the INSERT to include `section = NULL`:

```ts
db.prepare('INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)').run(
  sessionId, 'assistant', compressed, null
)
```

- [ ] **Step 4: Run chat tests**

```bash
cd /opt/bacta && npm run test:server -- --reporter=verbose tests/server/mx4chat.test.ts
```

Expected: all tests pass including the 4 new ones. Note: the existing test `'GET returns stored messages'` checks `expect(res.body[0]).toEqual({ role: 'user', content: 'test question' })` — this will now FAIL because the response also includes `created_at`. Update that assertion:

```ts
it('GET /api/mx4/chat/:sessionId returns stored messages', async () => {
  const { default: db } = await import('../../server/db/client')
  db.prepare(
    'INSERT INTO mx4_chat_messages (session_id, role, content) VALUES (?, ?, ?)'
  ).run('sess-get-test', 'user', 'test question')

  const { app } = await import('../../server/index')
  const res = await request(app).get('/api/mx4/chat/sess-get-test')
  expect(res.status).toBe(200)
  expect(res.body).toHaveLength(1)
  expect(res.body[0].role).toBe('user')
  expect(res.body[0].content).toBe('test question')
  expect(res.body[0].created_at).toBeDefined()
})
```

Also update the `POST /api/mx4/chat saves user message...` test assertion:

```ts
expect(rows[0]).toMatchObject({ role: 'user', content: 'What is my HRV?' })
expect(rows[1]).toMatchObject({ role: 'assistant', content: 'Hello from MX-4.' })
```

- [ ] **Step 5: Full server suite**

```bash
cd /opt/bacta && npm run test:server
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add server/api/mx4.ts tests/server/mx4chat.test.ts
git commit -m "feat(mx4): add section and created_at to all chat API endpoints"
```

---

### Task 4: `useBriefing` — add `refresh()` function

**Files:**
- Modify: `client/src/hooks/useBriefing.ts`

- [ ] **Step 1: Update `useBriefing` to return `{ data, refresh }`**

Replace the entire file `client/src/hooks/useBriefing.ts`:

```ts
import { useState, useEffect } from 'react'
import type { BriefingResult } from '../lib/briefing'

export function useBriefing(section: string): { data: BriefingResult | null; refresh: () => void } {
  const [data, setData] = useState<BriefingResult | null>(null)

  function refresh() {
    fetch(`/api/insights/${section}`)
      .then(r => r.json())
      .then((d: BriefingResult) => setData(d))
      .catch(err => console.error(`[useBriefing:${section}]`, err))
  }

  useEffect(() => {
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  return { data, refresh }
}
```

- [ ] **Step 2: Type check to catch all broken call sites**

```bash
cd /opt/bacta && npx tsc --noEmit
```

Expected: errors on `RecoveryPage.tsx`, `SleepPage.tsx`, `TrainingPage.tsx`, `HomePage.tsx` — they all call `useBriefing(...)` and expect `BriefingResult | null` directly. These are fixed in Task 8.

- [ ] **Step 3: Run client tests**

```bash
cd /opt/bacta && npm run test:client
```

Expected: tests that render pages using `useBriefing` may fail if they don't mock the hook. Note any failures — they will be fixed in Task 8 when the pages are updated.

- [ ] **Step 4: Commit**

```bash
cd /opt/bacta && git add client/src/hooks/useBriefing.ts
git commit -m "feat(mx4): add refresh() to useBriefing hook"
```

---

### Task 5: `useChat` — section param, visual clear, created_at

**Files:**
- Modify: `client/src/hooks/useChat.ts`

- [ ] **Step 1: Replace `client/src/hooks/useChat.ts`**

```ts
import { useState, useEffect, useRef } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  section?: string
  created_at?: string
}

export function useChat(section?: string) {
  const sessionId = `chat-${new Date().toISOString().slice(0, 10)}`
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [hiddenBefore, setHiddenBefore] = useState<string | null>(null)
  const hiddenBeforeRef = useRef<string | null>(null)

  function loadMessages() {
    fetch(`/api/mx4/chat/${sessionId}`)
      .then(r => r.json())
      .then((msgs: ChatMessage[]) => {
        const cutoff = hiddenBeforeRef.current
        setMessages(cutoff
          ? msgs.filter(m => (m.created_at ?? '') > cutoff)
          : msgs)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadMessages()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  function clearVisualHistory() {
    const now = new Date().toISOString()
    hiddenBeforeRef.current = now
    setHiddenBefore(now)
    setMessages(prev => prev.filter(m => (m.created_at ?? '') > now))
  }

  async function submit(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || streaming) return

    if (!overrideText) setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, section }])
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', section }])

    try {
      const res = await fetch('/api/mx4/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, section }),
      })

      if (!res.ok || !res.body) throw new Error('stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed: string | { error: string } = JSON.parse(data)
            if (typeof parsed === 'string') {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  role: 'assistant',
                  content: next[next.length - 1].content + parsed,
                  section,
                }
                return next
              })
            } else if (typeof parsed === 'object' && parsed.error) {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  role: 'assistant',
                  content: 'MX-4 is offline. Configure an AI provider in Settings.',
                  section,
                }
                return next
              })
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: 'MX-4 is offline. Configure an AI provider in Settings.',
          section,
        }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  return { messages, input, setInput, streaming, submit, sessionId, loadMessages, clearVisualHistory, hiddenBefore }
}
```

- [ ] **Step 2: Run client tests**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose tests/client/components/AskSheet.test.tsx
```

Expected: existing AskSheet tests pass — `useChat()` with no arg still works (section is optional).

- [ ] **Step 3: Commit**

```bash
cd /opt/bacta && git add client/src/hooks/useChat.ts
git commit -m "feat(chat): add section param, clearVisualHistory, created_at to useChat"
```

---

### Task 6: `MX4Briefing` — REFRESH button with polling

**Files:**
- Modify: `client/src/components/MX4Card.tsx`
- Modify: `tests/client/components/MX4Card.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `tests/client/components/MX4Card.test.tsx` (append after existing tests):

```tsx
import { MX4Briefing } from '../../../client/src/components/MX4Card'
import type { BriefingResult } from '../../../client/src/lib/briefing'

const liveBriefing: BriefingResult = {
  tone: 'POSITIVE',
  headline: 'Systems nominal.',
  summary: 'Everything looks good today.',
  body: '## DIRECTIVE\nKeep it up.',
  recommendation: 'Train as planned.',
  flags: [],
}

describe('MX4Briefing', () => {
  it('renders FULL ANALYSIS button when liveData has summary', () => {
    render(
      <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={liveBriefing} />
    )
    expect(screen.getByText('FULL ANALYSIS ›')).toBeInTheDocument()
  })

  it('renders REFRESH button when section prop is provided', () => {
    render(
      <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={liveBriefing} section="home" />
    )
    expect(screen.getByText('REFRESH ›')).toBeInTheDocument()
  })

  it('does not render REFRESH button when section prop is absent', () => {
    render(
      <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={liveBriefing} />
    )
    expect(screen.queryByText('REFRESH ›')).not.toBeInTheDocument()
  })
})
```

Add required import at the top of the test file:
```tsx
import { BRIEFS } from '../../../client/src/lib/stubData'
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose tests/client/components/MX4Card.test.tsx
```

Expected: `'renders REFRESH button'` and `'does not render REFRESH button'` fail.

- [ ] **Step 3: Update `MX4Briefing` in `client/src/components/MX4Card.tsx`**

Update the `MX4BriefingProps` interface:

```ts
interface MX4BriefingProps {
  accent:      string
  brief:       Brief
  liveData?:   BriefingResult
  section?:    string
  onRefresh?:  () => void
}
```

Update the function signature:

```ts
export function MX4Briefing({ accent, brief, liveData, section, onRefresh }: MX4BriefingProps) {
```

Add state and handler inside `MX4Briefing` (after the existing `const { openAskSheet } = useAskSheet()` line):

```ts
const [refreshState, setRefreshState] = useState<'idle' | 'running'>('idle')

async function handleRefresh() {
  if (!section || refreshState === 'running') return
  setRefreshState('running')
  try {
    await fetch(`/api/mx4/run/${section}`, { method: 'POST' })
    const originalAt = liveData?.generated_at
    let attempts = 0
    while (attempts < 24) {
      await new Promise(r => setTimeout(r, 10_000))
      const res = await fetch(`/api/insights/${section}`)
      const d = await res.json()
      if (d.generated_at !== originalAt) {
        onRefresh?.()
        break
      }
      attempts++
    }
  } catch {
    // non-fatal
  } finally {
    setRefreshState('idle')
  }
}
```

Add the `useState` import — update the top of the file:

```ts
import { useState } from 'react'
```

In the card footer `{/* Footer chips */}` div, add the REFRESH button alongside FULL ANALYSIS:

```tsx
{section && (
  <button
    onClick={handleRefresh}
    disabled={refreshState === 'running'}
    style={{
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: refreshState === 'running' ? 'default' : 'pointer',
      fontFamily: FONT_MONO,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: refreshState === 'running' ? COLORS.textMuted : accent,
      flexShrink: 0,
    }}
  >
    {refreshState === 'running' ? 'RUNNING ›' : 'REFRESH ›'}
  </button>
)}
```

- [ ] **Step 4: Run MX4Card tests**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose tests/client/components/MX4Card.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Full client tests**

```bash
cd /opt/bacta && npm run test:client
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add client/src/components/MX4Card.tsx tests/client/components/MX4Card.test.tsx
git commit -m "feat(mx4): add REFRESH button with polling to MX4Briefing"
```

---

### Task 7: `AskSheet` — iOS fix, auto-grow, section colors, CLEAR VIEW

**Files:**
- Modify: `client/src/components/Sheet.tsx`
- Modify: `client/src/components/AskSheet.tsx`
- Modify: `tests/client/components/AskSheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Replace `tests/client/components/AskSheet.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { AskSheet } from '../../../client/src/components/AskSheet'

function renderAsk(open: boolean, onClose = vi.fn(), section = 'home') {
  return render(<AskSheet open={open} onClose={onClose} accent="#2bc4e8" section={section} />)
}

describe('AskSheet', () => {
  it('renders nothing when closed', () => {
    renderAsk(false)
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument()
  })

  it('renders MX-4 header when open', () => {
    renderAsk(true)
    expect(screen.getByText('MX-4')).toBeInTheDocument()
  })

  it('renders the greeting text', () => {
    renderAsk(true)
    expect(screen.getByText(/Standing by, Commander/)).toBeInTheDocument()
  })

  it('renders 4 suggested prompts', () => {
    renderAsk(true)
    expect(screen.getByText('How is my recovery trending?')).toBeInTheDocument()
    expect(screen.getByText("Plan today's training")).toBeInTheDocument()
    expect(screen.getByText('Why is my HRV up?')).toBeInTheDocument()
    expect(screen.getByText('Summarize my week')).toBeInTheDocument()
  })

  it('renders the input placeholder', () => {
    renderAsk(true)
    expect(screen.getByPlaceholderText('Message MX-4')).toBeInTheDocument()
  })

  it('textarea has font-size 16 for iOS zoom prevention', () => {
    renderAsk(true)
    const textarea = screen.getByPlaceholderText('Message MX-4')
    expect(textarea).toHaveStyle({ fontSize: '16px' })
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    renderAsk(true, onClose)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render CLEAR VIEW button when no messages', () => {
    renderAsk(true)
    expect(screen.queryByText('CLEAR VIEW ›')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose tests/client/components/AskSheet.test.tsx
```

Expected: `'textarea has font-size 16'` fails (currently 12.5). `'does not render CLEAR VIEW'` fails if button always renders.

- [ ] **Step 3: Add `actions` prop to `SheetHeader` in `client/src/components/Sheet.tsx`**

Update `SheetHeaderProps`:

```ts
interface SheetHeaderProps {
  accent:   string
  sigil:    ReactNode
  title:    string
  sub?:     string
  onClose:  () => void
  actions?: ReactNode
}
```

Update `SheetHeader` to render `actions` between the title div and close button:

```tsx
export function SheetHeader({ accent, sigil, title, sub, onClose, actions }: SheetHeaderProps) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 18px 12px' }}>
      {sigil}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.14em', color: accent }}>
          {title}
        </span>
        {sub && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
            {sub}
          </span>
        )}
      </div>
      {actions}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `1px solid ${COLORS.line}`,
          background: COLORS.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2.4" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `client/src/components/AskSheet.tsx`**

```tsx
import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { COLORS, FONT_MONO, FONT_UI, SECTION_ACCENTS, MX4_COLOR } from '../theme'
import type { SectionKey } from '../theme'
import { Sheet, SheetShell, SheetHeader } from './Sheet'
import { MX4Sigil } from './primitives/MX4Sigil'
import { hexA } from '../lib/hexA'
import { useChat } from '../hooks/useChat'

const SUGGESTED_PROMPTS = [
  'How is my recovery trending?',
  "Plan today's training",
  'Why is my HRV up?',
  'Summarize my week',
]

const WIKI_PROMPT = 'Review your wiki pages and update them based on our conversation so far. Write any new patterns or findings worth preserving.'

interface AskSheetProps {
  open:    boolean
  onClose: () => void
  accent:  string
  section: string
}

function msgAccent(section?: string): string {
  if (!section) return MX4_COLOR
  return SECTION_ACCENTS[section as SectionKey] ?? MX4_COLOR
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

export function AskSheet({ open, onClose, accent, section }: AskSheetProps) {
  const { messages, input, setInput, streaming, submit, loadMessages, clearVisualHistory } = useChat(section)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (open) {
      loadMessages()
      const t = setTimeout(() => textareaRef.current?.focus(), 400)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current)
  }, [input])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const showSuggested = messages.length === 0

  const clearViewButton = messages.length > 0 ? (
    <button
      onClick={clearVisualHistory}
      style={{
        background: 'none',
        border: 'none',
        padding: '4px 6px',
        cursor: 'pointer',
        fontFamily: FONT_MONO,
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: COLORS.textMuted,
        flexShrink: 0,
      }}
    >
      CLEAR VIEW ›
    </button>
  ) : undefined

  return (
    <Sheet open={open} onClose={onClose} maxHeight="88%">
      <SheetShell accent={accent}>
        <SheetHeader
          accent={accent}
          title="MX-4"
          sub="ASK ANYTHING · MEDICAL & PROTOCOL"
          sigil={<MX4Sigil color={accent} size={30} spin glow mood={streaming ? 'think' : 'transmit'} />}
          onClose={onClose}
          actions={clearViewButton}
        />

        {/* Scrollable message area */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            padding: '4px 18px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Static greeting */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}>
              <MX4Sigil color={accent} size={26} mood="pleased" />
            </span>
            <div
              style={{
                background: hexA(accent, 0.08),
                border: `1px solid ${hexA(accent, 0.22)}`,
                borderRadius: '4px 14px 14px 14px',
                padding: '11px 14px',
                maxWidth: '85%',
              }}
            >
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#eef4fb', fontFamily: FONT_UI }}>
                Standing by, Commander. Ask me about any system, or I can walk your latest readouts. What do you need?
              </p>
            </div>
          </div>

          {/* Conversation history */}
          {messages.map((msg, i) => {
            const color = msgAccent(msg.section)
            return msg.role === 'user' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    background: hexA(color, 0.15),
                    border: `1px solid ${hexA(color, 0.3)}`,
                    borderRadius: '14px 4px 14px 14px',
                    padding: '10px 14px',
                    maxWidth: '80%',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#eef4fb', fontFamily: FONT_UI }}>
                    {msg.content}
                  </p>
                </div>
              </div>
            ) : (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>
                  <MX4Sigil
                    color={color}
                    size={26}
                    mood={streaming && i === messages.length - 1 ? 'think' : 'pleased'}
                  />
                </span>
                <div
                  style={{
                    background: hexA(color, 0.08),
                    border: `1px solid ${hexA(color, 0.22)}`,
                    borderRadius: '4px 14px 14px 14px',
                    padding: '11px 14px',
                    maxWidth: '85%',
                  }}
                >
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p style={{ margin: '0 0 6px 0', fontSize: 14.5, lineHeight: 1.55, color: '#eef4fb', fontFamily: FONT_UI }}>
                          {children}
                        </p>
                      ),
                      strong: ({ children }) => (
                        <strong style={{ color, fontWeight: 600 }}>{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em style={{ color: COLORS.textSecondary, fontStyle: 'italic' }}>{children}</em>
                      ),
                      ul: ({ children }) => (
                        <ul style={{ margin: '0 0 6px 0', paddingLeft: 16 }}>{children}</ul>
                      ),
                      li: ({ children }) => (
                        <li style={{ fontFamily: FONT_UI, fontSize: 14, lineHeight: 1.5, color: '#eef4fb', marginBottom: 2 }}>{children}</li>
                      ),
                      h2: ({ children }) => (
                        <h2 style={{ margin: '10px 0 4px', fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color, textTransform: 'uppercase' as const }}>
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 style={{ margin: '8px 0 3px', fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em', color: COLORS.textSecondary, textTransform: 'uppercase' as const }}>
                          {children}
                        </h3>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {streaming && i === messages.length - 1 && (
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-block',
                        width: 6,
                        height: 14,
                        background: color,
                        marginLeft: 3,
                        verticalAlign: 'middle',
                        animation: 'mx4blink 1.1s step-end infinite',
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {/* Suggested prompts */}
          {showSuggested && (
            <>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  letterSpacing: '0.16em',
                  color: COLORS.textMuted,
                  marginTop: 4,
                }}
              >
                SUGGESTED
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 4 }}>
                {SUGGESTED_PROMPTS.map(prompt => (
                  <span
                    key={prompt}
                    onClick={() => submit(prompt)}
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: 12.5,
                      color: COLORS.textSecondary,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.line}`,
                      borderRadius: 18,
                      padding: '8px 13px',
                      cursor: 'pointer',
                    }}
                  >
                    {prompt}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', paddingBottom: 8 }}>
                <span
                  onClick={() => submit(WIKI_PROMPT)}
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
                  SYNC WIKI ›
                </span>
              </div>
            </>
          )}
        </div>

        {/* Input bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 9,
            padding: '12px 16px 28px',
            borderTop: `1px solid ${COLORS.line}`,
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message MX-4"
            style={{
              flex: 1,
              background: COLORS.surface,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 11,
              padding: '11px 13px',
              fontFamily: FONT_MONO,
              fontSize: 16,
              color: COLORS.text,
              letterSpacing: '0.02em',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.5,
              minHeight: 44,
              maxHeight: 120,
              overflowY: 'auto',
            }}
          />
          <button
            onClick={() => submit()}
            disabled={streaming || !input.trim()}
            aria-label="Send"
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 11,
              border: `1px solid ${hexA(accent, streaming || !input.trim() ? 0.2 : 0.5)}`,
              background: hexA(accent, streaming || !input.trim() ? 0.05 : 0.14),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: streaming || !input.trim() ? 'default' : 'pointer',
              padding: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" y1="18" x2="18" y2="6" />
              <polyline points="9,6 18,6 18,15" />
            </svg>
          </button>
        </div>
      </SheetShell>
    </Sheet>
  )
}
```

- [ ] **Step 5: Run AskSheet tests**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose tests/client/components/AskSheet.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Step 6: Full client tests**

```bash
cd /opt/bacta && npm run test:client
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd /opt/bacta && git add client/src/components/Sheet.tsx client/src/components/AskSheet.tsx tests/client/components/AskSheet.test.tsx
git commit -m "feat(chat): iOS zoom fix, auto-grow textarea, per-message section colors, CLEAR VIEW"
```

---

### Task 8: Wire everything — AppShell, section pages, SettingsPage

**Files:**
- Modify: `client/src/components/AppShell.tsx`
- Modify: `client/src/pages/RecoveryPage.tsx`
- Modify: `client/src/pages/SleepPage.tsx`
- Modify: `client/src/pages/TrainingPage.tsx`
- Modify: `client/src/pages/HomePage.tsx`
- Modify: `client/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Pass `section` to `AskSheet` in `AppShell`**

In `client/src/components/AppShell.tsx`, update the `<AskSheet>` render:

```tsx
<AskSheet
  open={askOpen}
  onClose={() => setAskOpen(false)}
  accent={accent}
  section={section}
/>
```

- [ ] **Step 2: Update `RecoveryPage.tsx`**

Find the `useBriefing` call and `MX4Briefing` render. Change:

```ts
const liveBriefing = useBriefing('recovery')
```

To:

```ts
const { data: liveBriefing, refresh: refreshBriefing } = useBriefing('recovery')
```

Update `<MX4Briefing>` — add `section` and `onRefresh`:

```tsx
<MX4Briefing accent={A} brief={BRIEFS.recovery} liveData={liveBriefing ?? undefined} section="recovery" onRefresh={refreshBriefing} />
```

- [ ] **Step 3: Update `SleepPage.tsx`**

Same pattern as RecoveryPage:

```ts
const { data: liveBriefing, refresh: refreshBriefing } = useBriefing('sleep')
```

```tsx
<MX4Briefing accent={A} brief={BRIEFS.sleep} liveData={liveBriefing ?? undefined} section="sleep" onRefresh={refreshBriefing} />
```

- [ ] **Step 4: Update `TrainingPage.tsx`**

```ts
const { data: liveBriefing, refresh: refreshBriefing } = useBriefing('training')
```

```tsx
<MX4Briefing accent={A} brief={BRIEFS.training} liveData={liveBriefing ?? undefined} section="training" onRefresh={refreshBriefing} />
```

- [ ] **Step 5: Update `HomePage.tsx`**

`useBriefing` is called in `HomeContent`. Update:

```ts
const { data: liveBriefing, refresh: refreshBriefing } = useBriefing('home')
```

Pass `refreshBriefing` down to `HomeOverview` and `HomeTrends` via a new `onRefresh` prop:

```ts
function HomeOverview({ onNavigate, liveData, onRefresh }: { onNavigate: (path: string) => void; liveData?: import('../lib/briefing').BriefingResult; onRefresh?: () => void }) {
```

```ts
function HomeTrends({ liveData, onRefresh }: { liveData?: import('../lib/briefing').BriefingResult; onRefresh?: () => void }) {
```

Update `<MX4Briefing>` in both `HomeOverview` and `HomeTrends`:

```tsx
<MX4Briefing accent={A} brief={BRIEFS.home} liveData={liveData} section="home" onRefresh={onRefresh} />
```

Update `HomeContent` to pass `onRefresh`:

```ts
function HomeContent({ onNavigate }: { onNavigate: (path: string) => void }) {
  const tab = useTab()
  const { data: liveBriefing, refresh: refreshBriefing } = useBriefing('home')
  return tab === 'overview'
    ? <HomeOverview onNavigate={onNavigate} liveData={liveBriefing ?? undefined} onRefresh={refreshBriefing} />
    : <HomeTrends liveData={liveBriefing ?? undefined} onRefresh={refreshBriefing} />
}
```

- [ ] **Step 6: Add home re-run mode toggle to `SettingsPage.tsx`**

Add derived constant near `nightlySyncOn` / `syncOnGarminOn`:

```ts
const homeRerunAll = settings['mx4_home_rerun_mode'] === 'all_sections'
```

In the MX-4 INTELLIGENCE card, the current last row (`rowStyleLast`) is "Compress chat after". Change it to `rowStyle` (adds bottom border), then add the new row after it using `rowStyleLast`:

Change the compression row's style from `rowStyleLast` to `rowStyle`, then add after it:

```tsx
{/* Home re-run mode toggle */}
<div style={rowStyleLast}>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={labelStyle}>Home re-run includes all sections</span>
      {savedBadge('mx4_home_rerun_mode')}
    </div>
    <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, letterSpacing: '0.08em' }}>
      When off, uses cached briefings
    </span>
  </div>
  <Toggle
    on={homeRerunAll}
    onChange={v => save('mx4_home_rerun_mode', v ? 'all_sections' : 'home_only')}
  />
</div>
```

- [ ] **Step 7: Type check everything**

```bash
cd /opt/bacta && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors.

- [ ] **Step 8: Full test suite**

```bash
cd /opt/bacta && npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
cd /opt/bacta && git add client/src/components/AppShell.tsx client/src/pages/RecoveryPage.tsx client/src/pages/SleepPage.tsx client/src/pages/TrainingPage.tsx client/src/pages/HomePage.tsx client/src/pages/SettingsPage.tsx
git commit -m "feat: wire section prop through AppShell, pages, and Settings home rerun toggle"
```
