import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'
process.env.BACTA_ENCRYPTION_KEY = 'a'.repeat(64)
process.env.BACTA_INTERNAL_TOKEN = 'test-internal-token'

describe('Integrations API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('GET /api/integrations/status returns all providers as not connected', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/status')
    expect(res.status).toBe(200)
    expect(res.body.strava).toEqual({ connected: false, lastSync: null })
    expect(res.body.hevy).toEqual({ connected: false, lastSync: null })
    expect(res.body.polar).toEqual({ connected: false, lastSync: null })
    expect(res.body.oura).toEqual({ connected: false, lastSync: null })
    expect(res.body.whoop).toEqual({ connected: false, lastSync: null })
    expect(res.body.withings).toEqual({ connected: false, lastSync: null })
  })

  it('GET /api/integrations/strava/authorize returns 400 when client_id not set', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/strava/authorize')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/client_id/)
  })

  it('GET /api/integrations/strava/authorize returns { url } when configured', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('strava_client_id', 'cid123')").run()
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('base_url', 'http://bacta.home')").run()

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/strava/authorize')
    expect(res.status).toBe(200)
    expect(res.body.url).toContain('www.strava.com/oauth/authorize')
    expect(res.body.url).toContain('cid123')
  })

  it('GET /api/integrations/hevy/authorize returns 400 (Hevy has no OAuth)', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/hevy/authorize')
    expect(res.status).toBe(400)
  })

  it('GET /api/integrations/strava/callback returns 400 on state mismatch', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .get('/api/integrations/strava/callback')
      .query({ code: 'some-code', state: 'wrong-state' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/state/i)
  })

  it('POST /api/integrations/strava/disconnect clears tokens and sets enabled=false', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('strava_enabled', 'true')").run()
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('strava_tokens', 'encrypted-stuff')").run()

    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/integrations/strava/disconnect')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const enabled = db.prepare("SELECT value FROM app_settings WHERE key = 'strava_enabled'").get() as { value: string }
    const tokens  = db.prepare("SELECT value FROM app_settings WHERE key = 'strava_tokens'").get()  as { value: string }
    expect(enabled.value).toBe('false')
    expect(tokens.value).toBe('')
  })

  it('POST /api/integrations/strava/sync returns 401 without auth', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/integrations/strava/sync')
    expect(res.status).toBe(401)
  })

  it('POST /api/integrations/strava/sync returns 400 when provider not connected', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .post('/api/integrations/strava/sync')
      .set('Authorization', 'Bearer test-internal-token')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not connected/)
  })

  it('GET /api/integrations/unknown-provider/authorize returns 400', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/notaprovider/authorize')
    expect(res.status).toBe(400)
  })

  it('GET /api/integrations/oura/authorize returns 400 when client_id not set', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/oura/authorize')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/client_id/)
  })

  it('GET /api/integrations/oura/authorize returns { url } when configured', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('oura_client_id', 'ouri123')").run()
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('base_url', 'http://bacta.home')").run()

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/oura/authorize')
    expect(res.status).toBe(200)
    expect(res.body.url).toContain('cloud.ouraring.com/oauth/authorize')
    expect(res.body.url).toContain('ouri123')
  })

  it('GET /api/integrations/whoop/authorize returns 400 when client_id not set', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/integrations/whoop/authorize')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/client_id/)
  })

  it('POST /api/integrations/oura/sync returns 400 when provider not connected', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app)
      .post('/api/integrations/oura/sync')
      .set('Authorization', 'Bearer test-internal-token')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not connected/)
  })
})
