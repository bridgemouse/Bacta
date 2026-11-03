import { describe, it, expect } from 'vitest'
import request from 'supertest'
import pkg from '../../package.json'

process.env.DB_PATH = ':memory:'

describe('GET /api/version', () => {
  it('returns the server version and minimum supported app version', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/version')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ server: pkg.version, minApp: '0.1.0' })
  })

  it('needs no authentication, even with a bogus session cookie', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/version').set('Cookie', 'bacta_session=not-a-real-token')
    expect(res.status).toBe(200)
  })

  it('exposes only server and minApp', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/version')
    expect(Object.keys(res.body).sort()).toEqual(['minApp', 'server'])
  })
})
