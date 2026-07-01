import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Logs API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { logEvent } = await import('../../server/lib/logger')

    logEvent('garmin', 'info', 'Sync triggered')
    logEvent('garmin', 'error', 'Sync failed (exit code 1)')
    logEvent('mx4', 'info', 'Nightly orchestrator run started')
  })

  it('GET /api/logs/sources returns known sources', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/logs/sources')
    expect(res.status).toBe(200)
    expect(res.body.sources).toContain('garmin')
    expect(res.body.sources).toContain('mx4')
  })

  it('GET /api/logs?source=garmin returns only garmin entries, newest first', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/logs?source=garmin')
    expect(res.status).toBe(200)
    expect(res.body.logs.length).toBe(2)
    expect(res.body.logs.every((l: { source: string }) => l.source === 'garmin')).toBe(true)
    expect(res.body.logs[0].message).toBe('Sync failed (exit code 1)')
  })

  it('GET /api/logs without a source returns entries from all sources', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/logs')
    expect(res.status).toBe(200)
    expect(res.body.logs.length).toBe(3)
  })

  it('GET /api/logs?source=unknown returns an empty array, not an error', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/logs?source=nonexistent')
    expect(res.status).toBe(200)
    expect(res.body.logs).toEqual([])
  })

  it('GET /api/logs respects a limit query param', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/logs?limit=1')
    expect(res.status).toBe(200)
    expect(res.body.logs.length).toBe(1)
  })

  it('GET /api/logs caps limit at 500', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/logs?limit=99999')
    expect(res.status).toBe(200)
    // Only 3 rows exist, but this confirms the request doesn't error on a huge limit
    expect(res.body.logs.length).toBe(3)
  })
})
