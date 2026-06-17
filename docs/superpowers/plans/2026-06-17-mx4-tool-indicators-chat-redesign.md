# MX-4 Tool Indicators & Chat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface real-time tool activity in the Ask MX-4 chat sheet and redesign assistant messages to full-width (no bubble), matching Claude Desktop's visual model.

**Architecture:** Server switches from `textStream` to `fullStream` in the chat SSE endpoint, emitting `{"tool":"LABEL"}` events before text. Client hook parses these and tracks the last 3 labels in state. AskSheet renders them as droid-comms status lines above content, and drops the bubble container from assistant messages.

**Tech Stack:** Express SSE, Vercel AI SDK (`streamText` + `fullStream`), React 19, TypeScript, inline styles only.

## Global Constraints

- Inline styles only — no CSS files, no Tailwind, no CSS modules
- Dark UI always — no light mode additions
- Numbers/labels: `fontFamily: "'JetBrains Mono', ui-monospace, monospace"` (`FONT_MONO`)
- Colors: always from `theme.ts` — never hardcode hex values; use `hexA()` for alpha
- No new files, no new components — edit existing files only
- Branch: `mx4-tweaks` (already checked out)

---

### Task 1: Server — `toolLabel` function + `fullStream` SSE emission

**Files:**
- Modify: `server/api/mx4.ts`
- Test: `server/tests/mx4.test.ts`

**Interfaces:**
- Produces: SSE events of shape `{"tool":"PULLING TELEMETRY ON hrv"}` emitted before text chunks; existing text chunk format (`"chunk string"`) unchanged

- [ ] **Step 1: Write the failing test for `toolLabel`**

Add to `server/tests/mx4.test.ts` — find the existing mx4 test file first:

```bash
grep -n "toolLabel\|describe.*mx4\|describe.*chat" server/tests/mx4.test.ts | head -20
```

Add these tests in the appropriate describe block (or a new `describe('toolLabel')` block):

```typescript
import { toolLabel } from '../api/mx4'

describe('toolLabel', () => {
  it('extracts metric from queryDb SQL', () => {
    expect(toolLabel('queryDb', { sql: "SELECT date, value FROM garmin_snapshots WHERE metric = 'hrv' ORDER BY date DESC LIMIT 30" }))
      .toBe('PULLING TELEMETRY ON hrv')
  })

  it('falls back for queryDb with no metric match', () => {
    expect(toolLabel('queryDb', { sql: 'SELECT * FROM garmin_activities' }))
      .toBe('PULLING TELEMETRY')
  })

  it('includes query for research', () => {
    expect(toolLabel('research', { query: 'HRV and slow-wave sleep correlation' }))
      .toBe('SWEEPING ARCHIVES FOR HRV and slow-wave sleep correlation')
  })

  it('truncates long research query to 50 chars', () => {
    const q = 'a'.repeat(60)
    const label = toolLabel('research', { query: q })
    expect(label).toBe(`SWEEPING ARCHIVES FOR ${'a'.repeat(50)}`)
  })

  it('returns static label for readAllWikiPages', () => {
    expect(toolLabel('readAllWikiPages', {})).toBe('CONSULTING LOADED MATRICES')
  })

  it('includes name for writeWikiPage', () => {
    expect(toolLabel('writeWikiPage', { name: 'hrv-baseline' })).toBe('ENCODING hrv-baseline TO MATRIX')
  })

  it('includes name for archiveWikiPage', () => {
    expect(toolLabel('archiveWikiPage', { name: 'sleep-arch' })).toBe('ARCHIVING sleep-arch FROM MATRIX')
  })

  it('returns static label for listWikiPages', () => {
    expect(toolLabel('listWikiPages', {})).toBe('SURVEYING LOADED MATRICES')
  })

  it('includes query for search_wiki', () => {
    expect(toolLabel('search_wiki', { query: 'training goals' })).toBe('SWEEPING EXTERNAL MATRIX FOR training goals')
  })

  it('includes path for read_wiki_page', () => {
    expect(toolLabel('read_wiki_page', { path: 'health-fitness/running.md' }))
      .toBe('PULLING health-fitness/running.md FROM EXTERNAL MATRIX')
  })

  it('returns static label for get_wiki_index', () => {
    expect(toolLabel('get_wiki_index', {})).toBe('ORIENTING ON EXTERNAL MATRIX')
  })

  it('returns static label for list_wiki_pages', () => {
    expect(toolLabel('list_wiki_pages', {})).toBe('SURVEYING EXTERNAL MATRIX')
  })

  it('returns fallback for unknown tool', () => {
    expect(toolLabel('someNewTool', {})).toBe('ACCESSING SOMENEWTOOL')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:server 2>&1 | grep -A3 "toolLabel"
```

Expected: FAIL — `toolLabel` is not exported

- [ ] **Step 3: Add `toolLabel` export and switch to `fullStream`**

In `server/api/mx4.ts`, add `toolLabel` as an exported function (so tests can import it) and update the chat SSE loop. Find the current `textStream` loop — it looks like:

```typescript
let fullText = ''
for await (const chunk of result.textStream) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  fullText += chunk
}
```

Replace the entire `streamText` call and loop with:

```typescript
export function toolLabel(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'queryDb': {
      const sql = String(args.sql ?? '')
      const match = sql.match(/metric\s*=\s*'([^']+)'/i)
      return match ? `PULLING TELEMETRY ON ${match[1]}` : 'PULLING TELEMETRY'
    }
    case 'research': {
      const q = String(args.query ?? '').slice(0, 50).trim()
      return q ? `SWEEPING ARCHIVES FOR ${q}` : 'SWEEPING ARCHIVES'
    }
    case 'readAllWikiPages':
      return 'CONSULTING LOADED MATRICES'
    case 'writeWikiPage': {
      const name = String(args.name ?? '')
      return name ? `ENCODING ${name} TO MATRIX` : 'ENCODING TO MATRIX'
    }
    case 'archiveWikiPage': {
      const name = String(args.name ?? '')
      return name ? `ARCHIVING ${name} FROM MATRIX` : 'ARCHIVING FROM MATRIX'
    }
    case 'listWikiPages':
      return 'SURVEYING LOADED MATRICES'
    case 'search_wiki': {
      const q = String(args.query ?? '').slice(0, 50).trim()
      return q ? `SWEEPING EXTERNAL MATRIX FOR ${q}` : 'SWEEPING EXTERNAL MATRIX'
    }
    case 'read_wiki_page': {
      const path = String(args.path ?? '')
      return path ? `PULLING ${path} FROM EXTERNAL MATRIX` : 'PULLING FROM EXTERNAL MATRIX'
    }
    case 'get_wiki_index':
      return 'ORIENTING ON EXTERNAL MATRIX'
    case 'list_wiki_pages':
      return 'SURVEYING EXTERNAL MATRIX'
    default:
      return `ACCESSING ${toolName.toUpperCase()}`
  }
}
```

Place this function before the route handlers (e.g. after the imports).

Then find the `streamText` call inside `mx4Router.post('/chat', ...)` and replace:

```typescript
    const result = streamText({
      model: getModel('chat'),
      system,
      messages: [...history, { role: 'user' as const, content: message.trim() }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: { queryDb, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage, research, ...await getVaultTools() } as any,
      stopWhen: stepCountIs(8),
    })

    let fullText = ''
    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      fullText += chunk
    }
```

With:

```typescript
    const result = streamText({
      model: getModel('chat'),
      system,
      messages: [...history, { role: 'user' as const, content: message.trim() }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: { queryDb, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage, research, ...await getVaultTools() } as any,
      stopWhen: stepCountIs(8),
    })

    let fullText = ''
    for await (const part of result.fullStream) {
      if (part.type === 'tool-call') {
        const label = toolLabel(part.toolName, part.args as Record<string, unknown>)
        res.write(`data: ${JSON.stringify({ tool: label })}\n\n`)
      } else if (part.type === 'text-delta') {
        res.write(`data: ${JSON.stringify(part.textDelta)}\n\n`)
        fullText += part.textDelta
      }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:server 2>&1 | grep -A5 "toolLabel"
```

Expected: all `toolLabel` tests PASS

- [ ] **Step 5: Run full server test suite**

```bash
npm run test:server
```

Expected: all tests pass (134 tests)

- [ ] **Step 6: Type-check server**

```bash
npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add server/api/mx4.ts server/tests/mx4.test.ts
git commit -m "feat(mx4): emit tool-call events over SSE with SW-themed droid labels"
```

---

### Task 2: Client hook — parse tool events, expose `toolCalls`

**Files:**
- Modify: `client/src/hooks/useChat.ts`
- Test: `client/src/tests/hooks/useChat.test.ts` (or wherever the existing hook tests live)

**Interfaces:**
- Consumes: SSE events — existing `"string"` text chunks + new `{"tool":"LABEL"}` objects
- Produces: `toolCalls: string[]` added to hook return (alongside existing `messages`, `streaming`, etc.)

- [ ] **Step 1: Find existing useChat tests**

```bash
find client/src -name "*.test.*" | xargs grep -l "useChat" 2>/dev/null
```

Open the test file and identify the test structure.

- [ ] **Step 2: Write failing tests for tool event parsing**

Add to the existing useChat test file:

```typescript
it('populates toolCalls from tool SSE events', async () => {
  // Mock fetch to return a stream with tool events then text
  const events = [
    'data: {"tool":"PULLING TELEMETRY ON hrv"}\n\n',
    'data: {"tool":"CONSULTING LOADED MATRICES"}\n\n',
    'data: "Some response text"\n\n',
    'data: [DONE]\n\n',
  ]
  // Use the project's existing fetch mock pattern to simulate SSE
  // (follow whatever pattern the existing useChat tests use for mocking fetch)
  
  const { result } = renderHook(() => useChat())
  
  await act(async () => {
    await result.current.submit('test message')
  })
  
  // toolCalls should be cleared once text arrived
  expect(result.current.toolCalls).toEqual([])
})

it('keeps only last 3 tool calls', async () => {
  // Stream 4 tool events with no text yet
  const events = [
    'data: {"tool":"PULLING TELEMETRY ON hrv"}\n\n',
    'data: {"tool":"SWEEPING ARCHIVES FOR something"}\n\n',
    'data: {"tool":"CONSULTING LOADED MATRICES"}\n\n',
    'data: {"tool":"ORIENTING ON EXTERNAL MATRIX"}\n\n',
    'data: [DONE]\n\n',
  ]
  // mock fetch with these events
  
  const { result } = renderHook(() => useChat())
  
  await act(async () => {
    await result.current.submit('test')
  })
  
  // Only last 3 should be present (first one dropped)
  expect(result.current.toolCalls).toHaveLength(3)
  expect(result.current.toolCalls[0]).toBe('SWEEPING ARCHIVES FOR something')
  expect(result.current.toolCalls[2]).toBe('ORIENTING ON EXTERNAL MATRIX')
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test:client 2>&1 | grep -A5 "toolCalls"
```

Expected: FAIL — `toolCalls` not in hook return

- [ ] **Step 4: Implement the changes in `useChat.ts`**

Add `toolCalls` state and `hasTextRef` ref, update the SSE parsing loop, update the submit function, and add to the return object.

Replace the current hook content with:

```typescript
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
  const [toolCalls, setToolCalls] = useState<string[]>([])
  const [hiddenBefore, setHiddenBefore] = useState<string | null>(null)
  const hiddenBeforeRef = useRef<string | null>(null)
  const hasTextRef = useRef(false)

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
    hasTextRef.current = false
    setToolCalls([])
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
            const parsed: string | { error: string } | { tool: string } = JSON.parse(data)
            if (typeof parsed === 'string') {
              if (!hasTextRef.current) {
                hasTextRef.current = true
                setToolCalls([])
              }
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  role: 'assistant',
                  content: next[next.length - 1].content + parsed,
                  section,
                }
                return next
              })
            } else if (typeof parsed === 'object' && 'tool' in parsed) {
              setToolCalls(prev => [...prev.slice(-2), parsed.tool])
            } else if (typeof parsed === 'object' && 'error' in parsed) {
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
      setToolCalls([])
    }
  }

  return { messages, input, setInput, streaming, toolCalls, submit, sessionId, loadMessages, clearVisualHistory, hiddenBefore }
}
```

Note: `setToolCalls([])` in the `finally` block ensures indicators clear after the stream ends regardless of whether text arrived.

- [ ] **Step 5: Run tests**

```bash
npm run test:client 2>&1 | grep -E "PASS|FAIL|toolCalls"
```

Expected: toolCalls tests PASS

- [ ] **Step 6: Run full client test suite**

```bash
npm run test:client
```

Expected: all 165 tests pass

- [ ] **Step 7: Type-check client**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add client/src/hooks/useChat.ts client/src/tests/hooks/useChat.test.ts
git commit -m "feat(mx4): add toolCalls state to useChat — parses tool SSE events, keeps last 3"
```

---

### Task 3: AskSheet — full-width assistant layout + tool indicators

**Files:**
- Modify: `client/src/components/AskSheet.tsx`
- Test: visual verification via Playwright

**Interfaces:**
- Consumes: `toolCalls: string[]` from `useChat` (Task 2)

- [ ] **Step 1: Add `toolCalls` to the hook destructure**

In `AskSheet.tsx`, find:

```typescript
const { messages, input, setInput, streaming, submit, loadMessages, clearVisualHistory } = useChat(section)
```

Replace with:

```typescript
const { messages, input, setInput, streaming, toolCalls, submit, loadMessages, clearVisualHistory } = useChat(section)
```

- [ ] **Step 2: Replace the assistant message rendering block**

Find the assistant message branch inside the `messages.map(...)` — the `else` branch that currently renders a bubble. It starts with:

```typescript
) : (
  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    <span style={{ flexShrink: 0, marginTop: 2 }}>
      <MX4Sigil
```

Replace the entire assistant branch (the `) : (` block through its closing `</div>`) with:

```typescript
) : (
  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    <span style={{ flexShrink: 0, marginTop: 4 }}>
      <MX4Sigil
        color={color}
        size={22}
        mood={streaming && i === messages.length - 1 ? 'think' : 'pleased'}
      />
    </span>
    <div
      style={{
        flex: 1,
        borderLeft: `2px solid ${hexA(color, 0.25)}`,
        paddingLeft: 12,
        minWidth: 0,
      }}
    >
      {streaming && i === messages.length - 1 && toolCalls.length > 0 && (
        <div style={{ marginBottom: msg.content ? 10 : 0 }}>
          {toolCalls.map((label, ti) => {
            const isActive = ti === toolCalls.length - 1
            return (
              <div
                key={ti}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  color: isActive ? hexA(color, 0.75) : COLORS.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap' as const,
                  textOverflow: 'ellipsis',
                  marginBottom: 3,
                }}
              >
                {isActive ? (
                  <span
                    aria-hidden
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                      display: 'inline-block',
                      animation: 'mx4blink 1.1s step-end infinite',
                    }}
                  />
                ) : (
                  <span style={{ width: 5, flexShrink: 0, color: COLORS.textMuted }}>·</span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
              </div>
            )
          })}
        </div>
      )}
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p style={{ margin: '0 0 6px 0', fontSize: 13, lineHeight: 1.6, color: COLORS.text, fontFamily: FONT_MONO }}>
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
            <li style={{ fontFamily: FONT_MONO, fontSize: 13, lineHeight: 1.6, color: COLORS.text, marginBottom: 2 }}>{children}</li>
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
```

- [ ] **Step 3: Run client tests**

```bash
npm run test:client
```

Expected: all 165 tests pass (AskSheet snapshot tests may need updating — if they fail with "snapshot mismatch", run `npm run test:client -- -u` to update snapshots, review the diff, then re-run to confirm pass)

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Visual verification**

```bash
npm run dev:client &
npm run dev:server &
```

Navigate to `http://localhost:5173`, open Ask MX-4, send a message that requires tool use (e.g. "What is my HRV trend this week?"). Verify:
- Tool labels appear as mono uppercase lines with blinking dot on active
- Max 3 visible at once
- Each truncates to one line
- Labels clear when text starts
- MX-4 response is full-width, no bubble, left accent line visible
- User message still shows as right-aligned bubble
- Sigil shows `think` mood during streaming
- Blinking cursor appears after content while streaming

- [ ] **Step 6: Kill dev servers and commit**

```bash
kill %1 %2 2>/dev/null; git add client/src/components/AskSheet.tsx
git commit -m "feat(mx4): full-width assistant messages + tool activity indicators"
```

---

### Task 5: Meaningful error messages — server categorization + client passthrough

**Files:**
- Modify: `server/api/mx4.ts`
- Modify: `client/src/hooks/useChat.ts`
- Test: `server/tests/mx4.test.ts`, existing useChat tests

**Problem:** Every mid-stream failure — "no API key", "rate limited", "provider timeout", "connection dropped" — shows the same "MX-4 is offline. Configure an AI provider in Settings." message. This is actively misleading when the provider IS configured but hit a transient error. The user described getting this error during tool-intensive tasks, then sending a follow-up and getting the real answer — indicating the issue was a connection drop, not a missing provider.

**Interfaces:**
- Consumes: existing `{"error":"..."}` SSE event shape — no protocol change, just better strings
- Produces: human-readable, actionable error message in the assistant bubble

- [ ] **Step 1: Write failing tests for server error categorization**

Add to `server/tests/mx4.test.ts` — import and test a new exported `categorizeError` function:

```typescript
import { categorizeError } from '../api/mx4'

describe('categorizeError', () => {
  it('detects unconfigured provider', () => {
    expect(categorizeError(new Error('No AI provider configured')))
      .toBe('No AI provider configured. Check Settings → Intelligence.')
  })

  it('detects missing API key', () => {
    expect(categorizeError(new Error('Invalid API key provided')))
      .toBe('No AI provider configured. Check Settings → Intelligence.')
  })

  it('detects rate limit', () => {
    expect(categorizeError(new Error('Rate limit exceeded: 429')))
      .toBe('Rate limit reached — try again in a moment.')
  })

  it('detects quota exceeded', () => {
    expect(categorizeError(new Error('quota exceeded for this model')))
      .toBe('Rate limit reached — try again in a moment.')
  })

  it('detects timeout', () => {
    expect(categorizeError(new Error('Request timed out after 30s')))
      .toBe('MX-4 timed out during analysis. Try a shorter query.')
  })

  it('returns generic message for unknown errors', () => {
    expect(categorizeError(new Error('something unexpected')))
      .toBe('MX-4 encountered an error. Try again.')
  })

  it('handles non-Error objects', () => {
    expect(categorizeError('string error'))
      .toBe('MX-4 encountered an error. Try again.')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm run test:server 2>&1 | grep -A3 "categorizeError"
```

Expected: FAIL — `categorizeError` not exported

- [ ] **Step 3: Add `categorizeError` to server and use it in the catch block**

In `server/api/mx4.ts`, add this exported function alongside `toolLabel`:

```typescript
export function categorizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : ''
  if (/api.key|not configured|no provider|invalid.key|unauthorized/i.test(msg)) {
    return 'No AI provider configured. Check Settings → Intelligence.'
  }
  if (/rate.limit|429|quota|too many requests/i.test(msg)) {
    return 'Rate limit reached — try again in a moment.'
  }
  if (/timeout|timed out/i.test(msg)) {
    return 'MX-4 timed out during analysis. Try a shorter query.'
  }
  return 'MX-4 encountered an error. Try again.'
}
```

Then update the catch block in `mx4Router.post('/chat', ...)`:

```typescript
  } catch (e: unknown) {
    console.error('[mx4] chat stream error:', e)
    res.write(`data: ${JSON.stringify({ error: categorizeError(e) })}\n\n`)
  }
```

- [ ] **Step 4: Run server tests**

```bash
npm run test:server
```

Expected: all tests pass including new `categorizeError` tests

- [ ] **Step 5: Update client to use server error string instead of hardcoded fallback**

In `client/src/hooks/useChat.ts`, the SSE error branch currently ignores `parsed.error` and hardcodes the message. Update it to pass the server's string through:

Find:
```typescript
            } else if (typeof parsed === 'object' && 'error' in parsed) {
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
```

Replace with:
```typescript
            } else if (typeof parsed === 'object' && 'error' in parsed) {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  role: 'assistant',
                  content: (parsed as { error: string }).error,
                  section,
                }
                return next
              })
            }
```

Also update the outer `catch` block (fetch/connection failure — distinct from a server-sent error event) to give an accurate message for the "connection dropped during tool use" case:

Find:
```typescript
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
    }
```

Replace with:
```typescript
    } catch {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: 'Connection lost during analysis. MX-4 may have completed — try sending another message.',
          section,
        }
        return next
      })
    }
```

This message is accurate for the exact bug the user described: connection drops during long tool chains, but the model actually finished — sending another message works because the session history has the result.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all 299 tests pass

- [ ] **Step 7: Type-check both**

```bash
npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add server/api/mx4.ts server/tests/mx4.test.ts client/src/hooks/useChat.ts
git commit -m "fix(mx4): meaningful error messages — categorize server errors, pass through to client"
```

---

### Task 4: Final verification + PR

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all 299 tests pass (134 server + 165 client)

- [ ] **Step 2: Type-check both**

```bash
npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors on either

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin mx4-tweaks
gh pr create --title "feat(mx4): tool activity indicators + full-width chat" --body "$(cat <<'EOF'
## Summary
- MX-4 now surfaces real-time tool activity during the silent tool-use phase: up to 3 Star Wars-themed droid-comms status lines stack in the message area before text arrives
- Labels are dynamic where possible (metric name from SQL, query text for research/vault sweeps, page name for wiki writes)
- Assistant messages drop the chat bubble and go full-width with a left accent line — matches Claude Desktop's visual model, gives MX-4 better markdown formatting space
- User messages unchanged

## Test plan
- [ ] Send a message requiring tool use (e.g. "What is my HRV this week?") and verify tool labels appear with blinking dot
- [ ] Verify labels clear when text starts flowing
- [ ] Verify max 3 labels visible (send a prompt that triggers 4+ tools)
- [ ] Verify label truncation on long research queries
- [ ] Verify full-width layout with left accent line
- [ ] Verify user message bubble unchanged
- [ ] All 299 tests passing (may be higher with new tests from Tasks 1 and 5)
- [ ] Error messages are specific: rate limit, timeout, no provider, and connection drop each show a distinct message
- [ ] The generic "MX-4 is offline. Configure an AI provider in Settings." string no longer appears anywhere in the codebase

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
