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
