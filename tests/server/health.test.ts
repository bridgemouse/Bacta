import { describe, it, expect } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok' })
  })
})
