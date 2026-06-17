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
})
