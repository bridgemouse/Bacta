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
      'INSERT INTO health_snapshots (date, metric, value, unit) VALUES (?, ?, ?, ?)'
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

describe('Activities endpoint — expand fields', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { default: db } = await import('../../server/db/client')
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT OR REPLACE INTO health_activities
       (activity_id, source, date, start_time, name, type_key, duration_s, avg_hr,
        aerobic_te, anaerobic_te, recovery_time_h,
        zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
        run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      '9999', 'garmin', today, `${today} 07:00:00`, 'Test Run', 'running',
      3600, 148,
      3.8, 1.2, 24,
      120, 900, 600, 120, 60,
      172, 115.5, 8.4, 245
    )
  })

  it('GET /api/garmin/activities returns new expand fields', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/activities').query({ days: 7 })
    expect(res.status).toBe(200)
    const acts = res.body.activities as any[]
    const testAct = acts.find((a: any) => String(a.activity_id) === '9999')
    expect(testAct).toBeDefined()
    expect(testAct.aerobic_te).toBe(3.8)
    expect(testAct.anaerobic_te).toBe(1.2)
    expect(testAct.recovery_time_h).toBe(24)
    expect(testAct.zone1_s).toBe(120)
    expect(testAct.zone2_s).toBe(900)
    expect(testAct.zone3_s).toBe(600)
    expect(testAct.zone4_s).toBe(120)
    expect(testAct.zone5_s).toBe(60)
    expect(testAct.run_cadence).toBe(172)
    expect(testAct.run_stride_cm).toBe(115.5)
    expect(testAct.run_vert_osc_cm).toBe(8.4)
    expect(testAct.run_gct_ms).toBe(245)
  })
})

describe('sleep-hypno endpoint', () => {
  it('returns empty on no data', async () => {
    // fresh in-memory DB has no sleep_score row
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/sleep-hypno')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ hypno: [], startLocal: null, endLocal: null })
  })

  it('returns 24-element hypno array on valid source_json', async () => {
    const { default: db } = await import('../../server/db/client')
    const startMs = new Date('2026-06-12T23:14:00Z').getTime()
    const endMs = new Date('2026-06-13T07:22:00Z').getTime()
    const midMs = (startMs + endMs) / 2
    // Garmin's real GMT format: no timezone suffix, meant to be read as UTC
    const midStr = new Date(midMs).toISOString().slice(0, -1)
    const sourceJson = JSON.stringify({
      dailySleepDTO: {
        sleepStartTimestampGMT: startMs,
        sleepEndTimestampGMT: endMs,
        sleepStartTimestampLocal: '2026-06-12T23:14:00',
        sleepEndTimestampLocal: '2026-06-13T07:22:00',
      },
      sleepLevels: [
        { startGMT: new Date(startMs).toISOString().slice(0, -1), endGMT: new Date(midMs).toISOString().slice(0, -1), activityLevel: 0 },
        { startGMT: midStr, endGMT: new Date(endMs).toISOString().slice(0, -1), activityLevel: 2 },
      ],
    })
    db.prepare(
      `INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source_json) VALUES (?, ?, ?, ?, ?)`
    ).run('2026-06-13', 'sleep_score', 82, 'score', sourceJson)

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/sleep-hypno')
    expect(res.status).toBe(200)
    expect(res.body.hypno).toHaveLength(24)
    expect(res.body.startLocal).toBe('2026-06-12T23:14:00')
    expect(res.body.endLocal).toBe('2026-06-13T07:22:00')
    for (const v of res.body.hypno) {
      expect([0, 1, 2, 3]).toContain(v)
    }
  })

  it('handles parse failure gracefully', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare(
      `INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source_json) VALUES (?, ?, ?, ?, ?)`
    ).run('2026-06-14', 'sleep_score', 0, 'score', 'not valid json {{{')

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/sleep-hypno')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ hypno: [], startLocal: null, endLocal: null })
  })

  it('matches sleep-level segments as UTC regardless of server timezone', async () => {
    // Real bug: Garmin's sleepLevels[].startGMT/endGMT strings have no
    // timezone suffix. On a server whose local TZ isn't UTC, `new
    // Date(str)` parses them as LOCAL time, shifting every segment boundary
    // by the server's UTC offset. A single segment spanning the whole
    // night should therefore match every one of the 24 resampled buckets —
    // including the first, which is the one that broke under the old
    // (non-UTC-aware) parsing.
    const originalTz = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      const { default: db } = await import('../../server/db/client')
      const startMs = Date.UTC(2026, 5, 30, 2, 16, 50)
      const endMs = Date.UTC(2026, 5, 30, 9, 53, 50)
      const sourceJson = JSON.stringify({
        dailySleepDTO: {
          sleepStartTimestampGMT: startMs,
          sleepEndTimestampGMT: endMs,
          sleepStartTimestampLocal: startMs - 4 * 3600 * 1000,
          sleepEndTimestampLocal: endMs - 4 * 3600 * 1000,
        },
        sleepLevels: [
          { startGMT: '2026-06-30T02:16:50.0', endGMT: '2026-06-30T09:53:50.0', activityLevel: 0 },
        ],
      })
      db.prepare(
        `INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source_json) VALUES (?, ?, ?, ?, ?)`
      ).run('2026-06-30', 'sleep_score', 90, 'score', sourceJson)

      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/garmin/sleep-hypno')
      expect(res.status).toBe(200)
      expect(res.body.hypno[0]).toBe(3)
    } finally {
      process.env.TZ = originalTz
    }
  })
})

describe('Phase B endpoints', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { default: db } = await import('../../server/db/client')
    const insertAct = db.prepare(
      `INSERT OR IGNORE INTO health_activities (activity_id, source, date, start_time, name, type_key, duration_s, avg_hr)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const dates = ['2026-05-26', '2026-05-27', '2026-06-02', '2026-06-03']
    dates.forEach((d, i) => {
      insertAct.run(String(9000 + i), 'garmin', d, `${d}T07:00:00`, 'Run', 'running', 3600, 140 + i)
    })
  })

  it('GET /api/garmin/weekly-volume returns weeks array', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/weekly-volume').query({ weeks: 6 })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.weeks)).toBe(true)
    expect(res.body.weeks[0]).toMatchObject({ week: expect.any(String), hours: expect.any(Number) })
  })

  it('GET /api/garmin/weekly-avg-hr returns weeks array', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/weekly-avg-hr').query({ weeks: 6 })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.weeks)).toBe(true)
    expect(res.body.weeks[0]).toMatchObject({ week: expect.any(String), avg_hr: expect.any(Number) })
  })
})

describe('sources endpoint', () => {
  it('GET /api/garmin/sources returns metric-to-source map', async () => {
    const { default: db } = await import('../../server/db/client')
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source)
       VALUES (?, 'readiness_score', 82, 'score', 'oura')`
    ).run(today)
    db.prepare(
      `INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source)
       VALUES (?, 'hrv', 47, 'ms', 'garmin')`
    ).run(today)

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/sources')
    expect(res.status).toBe(200)
    expect(res.body.readiness_score).toBe('oura')
    expect(res.body.hrv).toBe('garmin')
  })
})
