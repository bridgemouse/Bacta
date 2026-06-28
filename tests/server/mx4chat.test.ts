import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

vi.mock('../../server/lib/ai/orchestrator', () => ({
  runOrchestrator: vi.fn().mockResolvedValue(undefined),
  loadSystemPrompt: vi.fn().mockReturnValue('You are MX-4.'),
}))

vi.mock('../../server/lib/ai/wiki', () => ({
  readAllWikiPagesSync: vi.fn().mockReturnValue(''),
  loadHeartbeat: vi.fn().mockReturnValue(''),
  writeWikiPageSync: vi.fn().mockReturnValue({ tokenEstimate: 0 }),
  listWikiPagesSync: vi.fn().mockReturnValue([]),
  archiveWikiPageSync: vi.fn().mockReturnValue(undefined),
  estimateTokens: vi.fn().mockReturnValue(0),
}))

vi.mock('../../server/lib/ai/provider', () => ({
  getModel: vi.fn().mockReturnValue({ modelId: 'test-model' }),
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    streamText: vi.fn().mockImplementation(() => ({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'Hello ' }
        yield { type: 'text-delta', text: 'from MX-4.' }
      })(),
    })),
    generateText: vi.fn().mockResolvedValue({
      text: '[MX-4 ARCHIVE] Earlier conversation compressed.',
    }),
  }
})

describe('MX-4 Chat API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('GET /api/mx4/chat/:sessionId returns empty array for new session', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/mx4/chat/new-session-xyz')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

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

  it('POST /api/mx4/chat returns 400 if message is missing', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/mx4/chat').send({ sessionId: '2026-06-14' })
    expect(res.status).toBe(400)
  })

  it('POST /api/mx4/chat returns 400 if sessionId is missing', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/mx4/chat').send({ message: 'hello' })
    expect(res.status).toBe(400)
  })

  it('POST /api/mx4/chat saves user message and streams SSE response', async () => {
    const { app } = await import('../../server/index')
    const { default: db } = await import('../../server/db/client')

    const res = await request(app)
      .post('/api/mx4/chat')
      .send({ message: 'What is my HRV?', sessionId: 'sess-post-test' })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.text).toContain('[DONE]')

    const rows = db.prepare(
      'SELECT role, content FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at'
    ).all('sess-post-test') as { role: string; content: string }[]

    expect(rows[0]).toEqual({ role: 'user', content: 'What is my HRV?' })
    expect(rows[1]).toEqual({ role: 'assistant', content: 'Hello from MX-4.' })
  })

  it('POST /api/mx4/chat/seed inserts assistant message and returns ok', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .post('/api/mx4/chat/seed')
      .send({ sessionId: 'seed-test-session', content: '## FULL ANALYSIS\nDetailed briefing here.' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const { default: db } = await import('../../server/db/client')
    const row = db.prepare(
      'SELECT role, content FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get('seed-test-session') as { role: string; content: string } | undefined
    expect(row?.role).toBe('assistant')
    expect(row?.content).toContain('FULL ANALYSIS')
  })

  it('POST /api/mx4/chat/seed returns 400 when sessionId missing', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .post('/api/mx4/chat/seed')
      .send({ content: 'some content' })
    expect(res.status).toBe(400)
  })

  it('POST /api/mx4/chat/seed returns 400 when sessionId is empty string', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .post('/api/mx4/chat/seed')
      .send({ sessionId: '', content: 'some content' })
    expect(res.status).toBe(400)
  })

  it('POST /api/mx4/chat/seed returns 400 when content missing', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .post('/api/mx4/chat/seed')
      .send({ sessionId: 'some-session' })
    expect(res.status).toBe(400)
  })

  it('POST /api/mx4/chat/seed returns 400 when content is empty string', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .post('/api/mx4/chat/seed')
      .send({ sessionId: 'some-session', content: '' })
    expect(res.status).toBe(400)
  })

  it('POST /api/mx4/chat compresses session when message count exceeds threshold', async () => {
    const { default: db } = await import('../../server/db/client')
    const sessionId = 'compress-test-session'

    // Set threshold to 4
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('mx4_chat_compression_threshold', '4')").run()

    // Insert 6 messages (exceeds threshold of 4)
    for (let i = 0; i < 6; i++) {
      db.prepare('INSERT INTO mx4_chat_messages (session_id, role, content) VALUES (?, ?, ?)').run(
        sessionId, i % 2 === 0 ? 'user' : 'assistant', `message ${i}`
      )
    }

    const { app } = await import('../../server/index')
    await request(app)
      .post('/api/mx4/chat')
      .send({ sessionId, message: 'new message' })

    const rows = db.prepare(
      'SELECT content FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId) as { content: string }[]

    // Should have: 1 compressed + 4 recent + 1 new user + 1 new assistant = ≤ threshold + 3
    expect(rows.length).toBeLessThan(10)
    expect(rows.some(r => r.content.includes('[MX-4 ARCHIVE]'))).toBe(true)
  })

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

  it('GET /api/mx4/chat/:sessionId omits section field for null-section legacy messages', async () => {
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
})

describe('categorizeError', () => {
  let categorizeError: (e: unknown) => string

  beforeAll(async () => {
    const mod = await import('../../server/api/mx4')
    categorizeError = mod.categorizeError
  })

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

describe('toolLabel', () => {
  let toolLabel: (toolName: string, args: Record<string, unknown>) => string

  beforeAll(async () => {
    const mod = await import('../../server/api/mx4')
    toolLabel = mod.toolLabel
  })

  it('extracts metric from queryDb SQL', () => {
    expect(toolLabel('queryDb', { sql: "SELECT date, value FROM health_snapshots WHERE metric = 'hrv' ORDER BY date DESC LIMIT 30" }))
      .toBe('PULLING TELEMETRY ON hrv')
  })

  it('falls back for queryDb with no metric match', () => {
    expect(toolLabel('queryDb', { sql: 'SELECT * FROM health_activities' }))
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
