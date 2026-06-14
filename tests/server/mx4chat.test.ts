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
    streamText: vi.fn().mockReturnValue({
      textStream: (async function* () {
        yield 'Hello '
        yield 'from MX-4.'
      })(),
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
    expect(res.body[0]).toEqual({ role: 'user', content: 'test question' })
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
})
