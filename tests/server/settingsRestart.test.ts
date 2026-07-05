import { describe, it, expect, vi } from 'vitest'

process.env.DB_PATH = ':memory:'

// Mock spawn so the test never actually restarts a service.
const spawnMock = vi.fn(() => ({ unref: vi.fn() }))
vi.mock('child_process', () => ({ spawn: spawnMock }))

describe('POST /api/settings/restart', () => {
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
})
