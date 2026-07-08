import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'

process.env.DB_PATH = ':memory:'

// Mock spawn so the test never launches the real Garmin poller.
const spawnMock = vi.fn(() => {
  const child = new EventEmitter() as any
  setImmediate(() => child.emit('close', 0))
  return child
})
vi.mock('child_process', () => ({ spawn: spawnMock }))

describe('POST /api/poll/force', () => {
  it('spawns the Garmin poller and returns 202', async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const request = (await import('supertest')).default
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/poll/force')
    expect(res.status).toBe(202)
    expect(spawnMock).toHaveBeenCalled()
    expect(spawnMock.mock.calls[0][0]).toBe('python3')
    expect(String(spawnMock.mock.calls[0][1])).toContain('garmin_poller.py')
  })

  it('logs an error entry when the spawned poller exits with a nonzero code', async () => {
    const request = (await import('supertest')).default
    const { app } = await import('../../server/index')
    const { default: db } = await import('../../server/db/client')

    spawnMock.mockImplementationOnce(() => {
      const child = new EventEmitter() as any
      setImmediate(() => child.emit('close', 1))
      return child
    })

    await request(app).post('/api/poll/force')
    await new Promise(resolve => setImmediate(resolve))

    const row = db.prepare(
      "SELECT level, message FROM app_logs WHERE source = 'garmin' ORDER BY id DESC LIMIT 1"
    ).get() as { level: string; message: string } | undefined
    expect(row).toBeDefined()
    expect(row!.level).toBe('error')
  })

  it('logs an error entry when the poller fails to spawn', async () => {
    const request = (await import('supertest')).default
    const { app } = await import('../../server/index')
    const { default: db } = await import('../../server/db/client')

    spawnMock.mockImplementationOnce(() => {
      const child = new EventEmitter() as any
      setImmediate(() => child.emit('error', new Error('ENOENT python3')))
      return child
    })

    await request(app).post('/api/poll/force')
    await new Promise(resolve => setImmediate(resolve))

    const row = db.prepare(
      "SELECT level, message FROM app_logs WHERE source = 'garmin' ORDER BY id DESC LIMIT 1"
    ).get() as { level: string; message: string } | undefined
    expect(row).toBeDefined()
    expect(row!.level).toBe('error')
  })
})
