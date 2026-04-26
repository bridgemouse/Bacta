import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import fs from 'fs'

process.env.DB_PATH = ':memory:'
process.env.POLL_SIGNAL_PATH = '/tmp/test_poll_signal'

describe('POST /api/poll/force', () => {
  afterEach(() => {
    if (fs.existsSync('/tmp/test_poll_signal')) {
      fs.rmSync('/tmp/test_poll_signal')
    }
  })

  it('creates the signal file and returns 202', async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/poll/force')
    expect(res.status).toBe(202)
    expect(fs.existsSync('/tmp/test_poll_signal')).toBe(true)
  })
})
