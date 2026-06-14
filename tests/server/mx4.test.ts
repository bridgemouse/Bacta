import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

// Mock the orchestrator so /run doesn't make real AI calls in tests
vi.mock('../../server/lib/ai/orchestrator', () => ({
  runOrchestrator: vi.fn().mockResolvedValue(undefined),
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
    // Should return almost immediately (fire-and-forget), not block
    expect(elapsed).toBeLessThan(500)
  })
})
