import { describe, it, expect, vi, afterEach } from 'vitest'
import { EventEmitter } from 'events'

process.env.DB_PATH = ':memory:'

// Mock spawn so the test never actually restarts a service.
let lastChild: EventEmitter & { unref: ReturnType<typeof vi.fn> }
const spawnMock = vi.fn(() => {
  lastChild = Object.assign(new EventEmitter(), { unref: vi.fn() })
  return lastChild
})
vi.mock('child_process', () => ({ spawn: spawnMock }))

describe('POST /api/settings/restart', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('spawns systemctl restart bacta-api and returns 202', async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const request = (await import('supertest')).default
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/settings/restart')
    expect(res.status).toBe(202)
    expect(spawnMock).toHaveBeenCalled()
    expect(spawnMock.mock.calls[0][0]).toBe('sudo')
    expect(spawnMock.mock.calls[0][1]).toEqual(['systemctl', 'restart', 'bacta-api'])
  })

  it('does not crash the process when the spawned child emits an error (e.g. ENOENT)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const request = (await import('supertest')).default
    const { app } = await import('../../server/index')
    await request(app).post('/api/settings/restart')

    expect(() => lastChild.emit('error', new Error('spawn sudo ENOENT'))).not.toThrow()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[settings] failed to spawn restart:', expect.any(Error)
    )
  })

  it('logs a non-zero exit code from the restart command', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const request = (await import('supertest')).default
    const { app } = await import('../../server/index')
    await request(app).post('/api/settings/restart')

    lastChild.emit('exit', 1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[settings] restart command exited with code 1')
  })
})
