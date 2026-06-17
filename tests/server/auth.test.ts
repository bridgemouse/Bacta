import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('App authentication', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('starts unconfigured and leaves the API open', async () => {
    const { app } = await import('../../server/index')
    const status = await request(app).get('/api/auth/status')
    expect(status.body.configured).toBe(false)
    expect(status.body.authed).toBe(false)
    // open before a PIN is set
    const open = await request(app).get('/api/settings')
    expect(open.status).toBe(200)
  })

  it('rejects a badly formatted PIN', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/auth/set-pin').send({ pin: '12' })
    expect(res.status).toBe(400)
  })

  it('first-time set-pin configures auth and logs the device in', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/auth/set-pin').send({ pin: '135790' })
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']?.[0]).toMatch(/bacta_session=/)
    const status = await request(app).get('/api/auth/status')
    expect(status.body.configured).toBe(true)
  })

  it('now blocks unauthenticated access to protected routes (401)', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(401)
  })

  it('rejects a wrong PIN and accepts the correct one, then allows access', async () => {
    const { app } = await import('../../server/index')
    const bad = await request(app).post('/api/auth/login').send({ pin: '000000' })
    expect(bad.status).toBe(401)

    const agent = request.agent(app)
    const ok = await agent.post('/api/auth/login').send({ pin: '135790' })
    expect(ok.status).toBe(200)
    const settings = await agent.get('/api/settings')
    expect(settings.status).toBe(200)
  })

  it('changing the PIN requires the current PIN', async () => {
    const { app } = await import('../../server/index')
    const noCurrent = await request(app).post('/api/auth/set-pin').send({ pin: '246810' })
    expect(noCurrent.status).toBe(401)
    const withCurrent = await request(app).post('/api/auth/set-pin').send({ pin: '246810', currentPin: '135790' })
    expect(withCurrent.status).toBe(200)
  })

  it('health stays open even when auth is configured', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
  })
})
