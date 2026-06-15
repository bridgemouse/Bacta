import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Settings API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('GET /api/settings returns all default keys', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body.ai_provider).toBe('google')
    expect(res.body.mx4_briefing_model).toBe('gemini-2.5-flash')
    expect(res.body.mx4_chat_model).toBe('gemini-2.5-flash')
    expect(res.body.mx4_nightly_enabled).toBe('true')
    expect(res.body.mx4_nightly_time).toBe('04:00')
    expect(res.body.mx4_on_sync_enabled).toBe('true')
  })

  it('GET /api/settings includes mx4_chat_compression_threshold default', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body.mx4_chat_compression_threshold).toBe('20')
  })

  it('GET /api/settings masks a non-empty api key — only last 4 chars visible', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('ai_api_key', 'sk-abcdefgh1234')"
    ).run()
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body.ai_api_key).toBe('••••1234')
    expect(res.body.ai_api_key).not.toContain('abcdefgh')
  })

  it('GET /api/settings returns empty string for empty api key — not masked', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('ai_api_key', '')"
    ).run()
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.body.ai_api_key).toBe('')
  })

  it('PUT /api/settings/:key updates a value and GET reflects the change', async () => {
    const { app } = await import('../../server/index')
    const putRes = await request(app)
      .put('/api/settings/mx4_nightly_time')
      .send({ value: '05:30' })
    expect(putRes.status).toBe(200)
    expect(putRes.body.ok).toBe(true)
    const getRes = await request(app).get('/api/settings')
    expect(getRes.body.mx4_nightly_time).toBe('05:30')
  })

  it('PUT /api/settings/:key returns 400 when value is not a string', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .put('/api/settings/mx4_nightly_time')
      .send({ value: 123 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/string/)
  })

  it('PUT /api/settings/:key returns 400 when value is missing', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .put('/api/settings/mx4_nightly_time')
      .send({})
    expect(res.status).toBe(400)
  })
})
