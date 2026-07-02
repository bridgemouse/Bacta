import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'
// The production static-file-serving block (server/index.ts) is gated on
// NODE_ENV === 'production' — must be set before server/index is imported.
process.env.NODE_ENV = 'production'

describe('production static serving', () => {
  let app: import('express').Express

  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    ;({ app } = await import('../../server/index'))
  })

  it('serves index.html for / with Cache-Control: no-store, not express.static\'s own caching', async () => {
    // Regression: express.static(clientDir) with its default `index: true`
    // serves index.html directly for GET / before the explicit no-store
    // catch-all route ever runs, so the app shell (and its reference to a
    // JS bundle hash) could get cached by a browser/PWA and never see a
    // new deploy. Cache-Control must be exactly 'no-store'.
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('serves index.html with no-store for a client-side route too (SPA fallback)', async () => {
    const res = await request(app).get('/recovery')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.headers['cache-control']).toBe('no-store')
  })
})
