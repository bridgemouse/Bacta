// tests/server/azi3.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

const SIGNAL_PATH = path.join(process.cwd(), 'data', 'test_azi3_signal')
process.env.AZI3_SIGNAL_PATH = SIGNAL_PATH

describe('AZI-3 API', () => {
  afterEach(() => {
    if (fs.existsSync(SIGNAL_PATH)) fs.rmSync(SIGNAL_PATH)
  })

  it('POST /api/azi3/run writes signal file and returns 202 with ok:true', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/azi3/run')
    expect(res.status).toBe(202)
    expect(res.body.ok).toBe(true)
    expect(fs.existsSync(SIGNAL_PATH)).toBe(true)
  })

  it('POST /api/azi3/run signal file contains a timestamp string', async () => {
    const { app } = await import('../../server/index')
    await request(app).post('/api/azi3/run')
    const content = fs.readFileSync(SIGNAL_PATH, 'utf-8')
    expect(new Date(content).getTime()).toBeGreaterThan(0)
  })
})
