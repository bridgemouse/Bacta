import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Content-Security-Policy', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('permits WebAssembly compilation via wasm-unsafe-eval (needed for the #141 barcode decoder), without granting broad unsafe-eval', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/nutrition/foods')
    const csp = res.headers['content-security-policy']
    expect(csp).toBeDefined()
    expect(csp).toContain("'wasm-unsafe-eval'")
    expect(csp).not.toContain("'unsafe-eval'")
  })
})
