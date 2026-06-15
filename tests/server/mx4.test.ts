import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

// Mock the orchestrator so /run doesn't make real AI calls in tests
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
    // Should return almost immediately (fire-and-forget), not block
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
