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

  it('GET /api/insights/:section falls back to the stub when the stored briefing JSON is valid but missing a required key (#198)', async () => {
    const { default: db } = await import('../../server/db/client')
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    // Valid JSON, but "flags" is missing entirely — not the empty-array-omitted case,
    // a genuinely wrong shape the client's MX4Briefing would render as `undefined`.
    const malformed = JSON.stringify({
      tone: 'CAUTION',
      headline: 'HRV declining.',
      body: 'Seven-day HRV trend is down 12%.',
      recommendation: 'Drop intensity today.',
    })
    db.prepare(
      'INSERT OR REPLACE INTO mx4_briefings (section, content_json, generated_at, model) VALUES (?, ?, ?, ?)'
    ).run('sleep', malformed, new Date().toISOString(), 'gemini-2.5-flash')

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/sleep')
    expect(res.status).toBe(200)
    // Must be the stub fallback, not the malformed DB row passed straight through
    expect(res.body.headline).toBe('Sleep score 82. Architecture review pending.')
    expect(res.body.flags).toEqual([])
  })

  it('GET /api/insights/:section falls back to the stub when a required field has the wrong type (#198)', async () => {
    const { default: db } = await import('../../server/db/client')
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const malformed = JSON.stringify({
      tone: 'CAUTION',
      headline: 'HRV declining.',
      body: 'Seven-day HRV trend is down 12%.',
      recommendation: 'Drop intensity today.',
      flags: 'not-an-array', // wrong type
    })
    db.prepare(
      'INSERT OR REPLACE INTO mx4_briefings (section, content_json, generated_at, model) VALUES (?, ?, ?, ?)'
    ).run('nutrition', malformed, new Date().toISOString(), 'gemini-2.5-flash')

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/nutrition')
    expect(res.status).toBe(200)
    expect(res.body.headline).toBe('Nutrition channel online. Architecture review pending.')
  })
})
