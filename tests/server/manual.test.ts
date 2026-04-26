import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Manual Input API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('GET /api/manual/today returns null when no entry', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/manual/today')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ entry: null })
  })

  it('POST /api/manual creates a new entry', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/manual').send({
      date: new Date().toISOString().slice(0, 10),
      readiness: 4,
      caffeine_mg: 200,
      supplements: ['creatine', 'vitamin_d']
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ readiness: 4, caffeine_mg: 200 })
  })

  it('POST /api/manual rejects readiness out of range', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/manual').send({
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // tomorrow to avoid conflict
      readiness: 6
    })
    expect(res.status).toBe(400)
  })

  it('GET /api/manual/today returns created entry', async () => {
    const { app } = await import('../../server/index')
    const { default: db } = await import('../../server/db/client')
    const today = new Date().toISOString().slice(0, 10)
    // Ensure today's entry exists (created in second test above)
    const res = await request(app).get('/api/manual/today')
    expect(res.status).toBe(200)
    expect(res.body.entry.readiness).toBe(4)
    expect(JSON.parse(res.body.entry.supplements)).toContain('creatine')
  })
})
