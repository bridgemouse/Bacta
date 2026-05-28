import { describe, it, expect } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Insights API', () => {
  it('GET /api/insights/:section returns mock JSON for a valid section', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/recovery')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('summary')
    expect(res.body).toHaveProperty('tone')
    expect(res.body).toHaveProperty('generated_at')
    expect(res.body).toHaveProperty('flags')
  })

  it('GET /api/insights/:section returns 404 for an unknown section', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/unknown')
    expect(res.status).toBe(404)
  })
})
