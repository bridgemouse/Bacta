import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import path from 'path'

process.env.DB_PATH = ':memory:'

const INSIGHTS_DIR = path.join(process.cwd(), 'insights')

describe('Insights API', () => {
  beforeAll(() => {
    fs.mkdirSync(INSIGHTS_DIR, { recursive: true })
    fs.writeFileSync(path.join(INSIGHTS_DIR, 'recovery.html'), '<div>AZI-3 recovery card</div>')
  })

  afterAll(() => {
    // Only remove the test file — leave the directory (it has a .gitkeep and may be used by the server)
    const testFile = path.join(INSIGHTS_DIR, 'recovery.html')
    if (fs.existsSync(testFile)) fs.rmSync(testFile)
  })

  it('GET /api/insights lists available sections', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights')
    expect(res.status).toBe(200)
    expect(res.body.sections).toContain('recovery')
  })

  it('GET /api/insights/recovery returns HTML content', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/recovery')
    expect(res.status).toBe(200)
    expect(res.text).toContain('AZI-3 recovery card')
  })

  it('GET /api/insights/missing returns 404', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/missing')
    expect(res.status).toBe(404)
  })
})
