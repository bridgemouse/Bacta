import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

vi.mock('../../server/lib/ai/orchestrator', () => ({
  runOrchestrator: vi.fn().mockResolvedValue(undefined),
  runSectionById: vi.fn().mockResolvedValue(undefined),
  loadSystemPrompt: vi.fn().mockReturnValue('You are MX-4.'),
}))

describe('GET /api/mx4/run/:section/status', () => {
  it('returns error: null when no run has failed', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/mx4/run/recovery/status')
    expect(res.status).toBe(200)
    expect(res.body.error).toBeNull()
  })

  it('reports a categorized error after a failed run', async () => {
    const { runSectionById } = await import('../../server/lib/ai/orchestrator') as any
    runSectionById.mockRejectedValueOnce(new Error('No API key configured'))

    const { app } = await import('../../server/index')
    await request(app).post('/api/mx4/run/sleep')
    await new Promise(r => setTimeout(r, 50))

    const res = await request(app).get('/api/mx4/run/sleep/status')
    expect(res.status).toBe(200)
    expect(res.body.error).toBe('No AI provider configured. Check Settings → Intelligence.')
  })

  it('logs a failed section refresh to app_logs, matching the nightly orchestrator run\'s logging (#182)', async () => {
    const { runSectionById } = await import('../../server/lib/ai/orchestrator') as any
    runSectionById.mockRejectedValueOnce(new Error('Provider rate limit exceeded'))

    const { app } = await import('../../server/index')
    await request(app).post('/api/mx4/run/recovery')
    await new Promise(r => setTimeout(r, 50))

    const { default: db } = await import('../../server/db/client')
    const rows = db.prepare(
      "SELECT source, level, message FROM app_logs WHERE source = 'mx4' ORDER BY id DESC LIMIT 5"
    ).all() as { source: string; level: string; message: string }[]

    expect(rows.some(r => r.level === 'error' && r.message.includes('recovery') && r.message.includes('Provider rate limit exceeded'))).toBe(true)
  })

  it('clears the error once a subsequent run is triggered', async () => {
    const { runSectionById } = await import('../../server/lib/ai/orchestrator') as any
    runSectionById.mockRejectedValueOnce(new Error('No API key configured'))

    const { app } = await import('../../server/index')
    await request(app).post('/api/mx4/run/training')
    await new Promise(r => setTimeout(r, 50))

    let res = await request(app).get('/api/mx4/run/training/status')
    expect(res.body.error).not.toBeNull()

    runSectionById.mockResolvedValueOnce(undefined)
    await request(app).post('/api/mx4/run/training')

    res = await request(app).get('/api/mx4/run/training/status')
    expect(res.body.error).toBeNull()
  })
})
