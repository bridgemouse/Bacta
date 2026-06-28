import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('whoopProcessor', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('toTypeKey maps Whoop sport IDs to Bacta type_key', async () => {
    const { toTypeKey } = await import('../../server/lib/integrations/whoop/whoopProcessor')
    expect(toTypeKey(1)).toBe('running')
    expect(toTypeKey(2)).toBe('cycling')
    expect(toTypeKey(40)).toBe('swimming')
    expect(toTypeKey(999)).toBe('workout') // fallback
  })

  it('processWhoopData writes recovery snapshots', async () => {
    const { processWhoopData } = await import('../../server/lib/integrations/whoop/whoopProcessor')
    const { default: db }      = await import('../../server/db/client')

    processWhoopData({
      recovery: [{ created_at: '2026-06-20T10:00:00.000Z', score_state: 'SCORED', score: { recovery_score: 75, resting_heart_rate: 56, hrv_rmssd_milli: 42.5 } }],
      sleep:    [],
      workouts: [],
    })

    const snap = (key: string) =>
      (db.prepare("SELECT value FROM health_snapshots WHERE date='2026-06-20' AND metric=? AND source='whoop'").get(key) as { value: number } | undefined)?.value

    expect(snap('readiness_score')).toBe(75)
    expect(snap('resting_hr')).toBe(56)
    expect(snap('hrv')).toBeCloseTo(42.5, 1)
  })

  it('processWhoopData writes sleep stage snapshots, skips naps', async () => {
    const { processWhoopData } = await import('../../server/lib/integrations/whoop/whoopProcessor')
    const { default: db }      = await import('../../server/db/client')

    const stages = { total_in_bed_time_milli: 28800000, total_awake_time_milli: 1800000, total_light_sleep_time_milli: 9000000, total_slow_wave_sleep_time_milli: 5400000, total_rem_sleep_time_milli: 10800000 }
    processWhoopData({
      recovery: [],
      sleep: [
        { start: '2026-06-21T00:00:00.000Z', end: '2026-06-21T07:30:00.000Z', nap: false, score_state: 'SCORED', score: { stage_summary: stages, respiratory_rate: 15 } },
        { start: '2026-06-21T13:00:00.000Z', end: '2026-06-21T13:30:00.000Z', nap: true,  score_state: 'SCORED', score: { stage_summary: stages, respiratory_rate: 14 } },
      ],
      workouts: [],
    })

    const rows = db.prepare("SELECT metric FROM health_snapshots WHERE date='2026-06-21' AND source='whoop'").all() as { metric: string }[]
    const metrics = rows.map(r => r.metric)
    expect(metrics).toContain('sleep_duration_s')
    expect(metrics).toContain('deep_sleep_s')
    expect(metrics).toContain('light_sleep_s')
    expect(metrics).toContain('rem_sleep_s')
    // Nap was skipped — only one set of sleep rows
    const sleepRows = db.prepare("SELECT COUNT(*) as n FROM health_snapshots WHERE date='2026-06-21' AND metric='sleep_duration_s' AND source='whoop'").get() as { n: number }
    expect(sleepRows.n).toBe(1)
  })

  it('processWhoopData writes workouts to health_activities', async () => {
    const { processWhoopData } = await import('../../server/lib/integrations/whoop/whoopProcessor')
    const { default: db }      = await import('../../server/db/client')

    processWhoopData({
      recovery: [],
      sleep:    [],
      workouts: [{
        id: 'workout-uuid-1', start: '2026-06-22T07:00:00.000Z', end: '2026-06-22T08:00:00.000Z',
        sport_id: 1, score_state: 'SCORED',
        score: { average_heart_rate: 148, kilojoule: 1200, distance_meter: 8000 },
      }],
    })

    const row = db.prepare("SELECT * FROM health_activities WHERE activity_id = 'workout-uuid-1'").get() as Record<string, unknown> | undefined
    expect(row).toBeDefined()
    expect(row?.type_key).toBe('running')
    expect(row?.duration_s).toBe(3600)
    expect(row?.avg_hr).toBe(148)
    expect(row?.calories).toBe(287) // Math.round(1200 * 0.239)
    expect(row?.distance_m).toBe(8000)
  })
})
