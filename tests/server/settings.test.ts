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

  it('GET /api/settings/custom-skills returns seeded SYNC WIKI skill', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings/custom-skills')
    expect(res.status).toBe(200)
    expect(res.body.skills).toHaveLength(1)
    expect(res.body.skills[0].label).toBe('SYNC WIKI')
    expect(res.body.skills[0].prompt).toContain('wiki pages')
  })

  it('GET /api/settings/custom-skills returns updated skills after PUT', async () => {
    const { app } = await import('../../server/index')
    const updated = [
      { label: 'SYNC WIKI', prompt: 'Review your wiki pages and update them based on our conversation so far. Write any new patterns or findings worth preserving.' },
      { label: 'WEEKLY REVIEW', prompt: 'Give me a full weekly review of all systems.' },
    ]
    await request(app)
      .put('/api/settings/mx4_custom_skills')
      .send({ value: JSON.stringify(updated) })
    const res = await request(app).get('/api/settings/custom-skills')
    expect(res.body.skills).toHaveLength(2)
    expect(res.body.skills[1].label).toBe('WEEKLY REVIEW')
  })

  it('GET /api/settings/custom-skills returns empty array when setting is invalid JSON', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('mx4_custom_skills', 'not-json')").run()
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings/custom-skills')
    expect(res.status).toBe(200)
    expect(res.body.skills).toEqual([])
  })

  it('POST /api/settings/test-vault-connection returns ok:false when vault is unreachable', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/settings/test-vault-connection')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toBeDefined()
  })

  it('PUT /api/settings/vault_url resets vault client without error', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).put('/api/settings/vault_url').send({ value: 'http://localhost:9999' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('PUT rejects an unknown setting key (no arbitrary key writes)', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).put('/api/settings/evil_key').send({ value: 'x' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/unknown/)
  })

  it('PUT rejects an auth_* secret key', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).put('/api/settings/auth_pin_hash').send({ value: 'x' })
    expect(res.status).toBe(400)
  })

  it('PUT rejects an invalid provider enum', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).put('/api/settings/ai_provider').send({ value: 'skynet' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid/)
  })

  it('PUT rejects a malformed nightly time', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).put('/api/settings/mx4_nightly_time').send({ value: '25:99' })
    expect(res.status).toBe(400)
  })

  it('GET never exposes auth_* keys even if present in the DB', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('auth_pin_hash', 'deadbeef')").run()
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.body.auth_pin_hash).toBeUndefined()
  })

  it('encrypts provider client_secret at write time', async () => {
    process.env.BACTA_ENCRYPTION_KEY = 'a'.repeat(64)
    const { app } = await import('../../server/index')
    const { default: db } = await import('../../server/db/client')
    // Clear the auth_pin_hash written by the previous test so auth stays open
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('auth_pin_hash', '')").run()

    // Write plaintext client_secret via API
    await request(app)
      .put('/api/settings/strava_client_secret')
      .send({ value: 'my-secret-value' })

    // Stored value should be encrypted JSON (not plaintext)
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'strava_client_secret'").get() as { value: string }
    expect(() => JSON.parse(row.value)).not.toThrow()
    const parsed = JSON.parse(row.value)
    expect(parsed).toHaveProperty('e')
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('tag')
    expect(row.value).not.toContain('my-secret-value')
  })
})
