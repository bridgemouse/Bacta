import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Garmin API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { default: db } = await import('../../server/db/client')
    const today = new Date().toISOString().slice(0, 10)
    // Seed test data
    const insert = db.prepare(
      'INSERT INTO garmin_snapshots (date, metric, value, unit) VALUES (?, ?, ?, ?)'
    )
    insert.run(today, 'steps', 9241, 'steps')
    insert.run(today, 'hrv', 48, 'ms')
    insert.run(today, 'body_battery', 74, 'score')
    insert.run(today, 'resting_hr', 52, 'bpm')
    insert.run(today, 'sleep_duration', 442, 'minutes')
    insert.run(today, 'recovery_score', 82, 'score')
    insert.run(today, 'stress_score', 28, 'score')
    insert.run(today, 'vo2max', 51.2, 'ml/kg/min')
    // Seed yesterday's steps for date-range test
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    insert.run(yesterday, 'steps', 8100, 'steps')
  })

  it('GET /api/garmin/summary returns today key metrics', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/summary')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      steps: 9241,
      hrv: 48,
      body_battery: 74,
      resting_hr: 52,
      sleep_duration: 442,
      recovery_score: 82,
      stress_score: 28,
      vo2max: 51.2
    })
  })

  it('GET /api/garmin/:metric returns value for metric', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/steps')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ metric: 'steps', value: 9241, unit: 'steps' })
  })

  it('GET /api/garmin/:metric with date range returns multiple rows', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    const { app } = await import('../../server/index')
    const res = await request(app)
      .get('/api/garmin/steps')
      .query({ from: yesterday, to: today })
    expect(res.status).toBe(200)
    expect(res.body.rows).toHaveLength(2)
  })

  it('GET /api/garmin/:metric returns 400 for unknown metric', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/unicorn')
    expect(res.status).toBe(400)
  })
})
