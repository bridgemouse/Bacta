import { describe, it, expect } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Insights API', () => {
  it('GET /api/insights/:section returns stub briefing shape for valid section with no DB data', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/recovery')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('tone')
    expect(res.body).toHaveProperty('headline')
    expect(res.body).toHaveProperty('body')
    expect(res.body).toHaveProperty('recommendation')
    expect(res.body).toHaveProperty('flags')
    expect(['POSITIVE', 'CAUTION', 'FLAG']).toContain(res.body.tone)
  })

  it('GET /api/insights/:section returns 404 for unknown section', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/unknown')
    expect(res.status).toBe(404)
  })

  it('GET /api/insights/:section returns DB row content when a briefing exists', async () => {
    const { default: db } = await import('../../server/db/client')
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const content = JSON.stringify({
      tone: 'CAUTION',
      headline: 'HRV declining.',
      body: 'Seven-day HRV trend is down 12%.',
      recommendation: 'Drop intensity today.',
      flags: ['HRV below 7-day average'],
    })
    db.prepare(
      'INSERT OR REPLACE INTO mx4_briefings (section, content_json, generated_at, model) VALUES (?, ?, ?, ?)'
    ).run('training', content, new Date().toISOString(), 'gemini-2.5-flash')

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/training')
    expect(res.status).toBe(200)
    expect(res.body.tone).toBe('CAUTION')
    expect(res.body.headline).toBe('HRV declining.')
    expect(res.body.flags).toHaveLength(1)
  })
})
