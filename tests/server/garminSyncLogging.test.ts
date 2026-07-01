import { describe, it, expect, vi, beforeAll } from 'vitest'
import { EventEmitter } from 'events'

process.env.DB_PATH = ':memory:'

let lastChild: EventEmitter
const spawnMock = vi.fn(() => {
  lastChild = new EventEmitter()
  return lastChild
})
vi.mock('child_process', () => ({ spawn: spawnMock }))

describe('POST /api/garmin/sync — logging', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('logs a garmin source entry when sync is triggered', async () => {
    const request = (await import('supertest')).default
    const { app } = await import('../../server/index')
    const { default: db } = await import('../../server/db/client')

    await request(app).post('/api/garmin/sync')

    const row = db.prepare(
      "SELECT level, message FROM app_logs WHERE source = 'garmin' ORDER BY id DESC LIMIT 1"
    ).get() as { level: string; message: string } | undefined
    expect(row).toBeDefined()
    expect(row!.level).toBe('info')

    // Close out this run so the next test starts from a non-running state.
    lastChild!.emit('close', 0)
  })

  it('logs an error entry when the poller exits with a nonzero code', async () => {
    const request = (await import('supertest')).default
    const { app } = await import('../../server/index')
    const { default: db } = await import('../../server/db/client')

    await request(app).post('/api/garmin/sync')
    lastChild!.emit('close', 1)

    const row = db.prepare(
      "SELECT level, message FROM app_logs WHERE source = 'garmin' ORDER BY id DESC LIMIT 1"
    ).get() as { level: string; message: string } | undefined
    expect(row!.level).toBe('error')
  })
})
