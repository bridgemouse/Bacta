process.env.DB_PATH = ':memory:'

import { describe, it, expect, beforeAll } from 'vitest'
import { migrate } from '../../server/db/migrate'

describe('polarProcessor', () => {
  beforeAll(() => { migrate() })

  it('writes exercise to health_activities', async () => {
    const db = (await import('../../server/db/client')).default
    const { processPolarData } = await import('../../server/lib/integrations/polar/polarProcessor')

    const count = processPolarData({
      exercises: [{ id: 'ex1', start_time: '2024-01-10T07:00:00.000Z', duration: 'PT1H0M0S',
        sport: 'RUNNING', distance: 10000.0, heart_rate: { average: 145 }, calories: 500 }],
      nights: [],
      recharges: [],
    })
    expect(count).toBe(1)
    const row = db.prepare("SELECT * FROM health_activities WHERE activity_id = 'ex1'").get() as Record<string, unknown>
    expect(row.type_key).toBe('running')
    expect(row.duration_s).toBe(3600)
    expect(row.source).toBe('polar')
  })

  it('writes sleep snapshots from nights', async () => {
    const db = (await import('../../server/db/client')).default
    const { processPolarData } = await import('../../server/lib/integrations/polar/polarProcessor')

    processPolarData({
      exercises: [],
      nights: [{ date: '2024-01-11', sleep_summary: {
        total_sleep_time: 25200, deep_sleep_time: 7200, light_sleep_time: 14400,
        rem_time: 3600, sleep_score: 82, breathing_rate_avg: 14.2,
        heart_rate: { average: 52 },
      }}],
      recharges: [],
    })
    const rows = db.prepare(
      "SELECT metric, value FROM health_snapshots WHERE date = '2024-01-11' AND source = 'polar'"
    ).all() as { metric: string; value: number }[]
    const map = Object.fromEntries(rows.map(r => [r.metric, r.value]))
    expect(map.sleep_s).toBe(25200)
    expect(map.sleep_deep_s).toBe(7200)
    expect(map.sleep_light_s).toBe(14400)
    expect(map.sleep_rem_s).toBe(3600)
    expect(map.resp_avg).toBeCloseTo(14.2, 1)
    expect(map.sleep_score).toBe(82)
  })

  it('writes resting_hr and hrv from nightly-recharge', async () => {
    const db = (await import('../../server/db/client')).default
    const { processPolarData } = await import('../../server/lib/integrations/polar/polarProcessor')

    processPolarData({
      exercises: [],
      nights: [],
      recharges: [{ date: '2024-01-12', heart_rate_avg: 48, heart_rate_variability_sdnn: 55.0 }],
    })
    const rows = db.prepare(
      "SELECT metric, value FROM health_snapshots WHERE date = '2024-01-12' AND source = 'polar'"
    ).all() as { metric: string; value: number }[]
    const map = Object.fromEntries(rows.map(r => [r.metric, r.value]))
    expect(map.resting_hr).toBe(48)
    expect(map.hrv).toBe(55.0)
  })

  it('skips null/missing fields in nights', async () => {
    const db = (await import('../../server/db/client')).default
    const { processPolarData } = await import('../../server/lib/integrations/polar/polarProcessor')

    processPolarData({
      exercises: [],
      nights: [{ date: '2024-01-13', sleep_summary: {
        total_sleep_time: null, deep_sleep_time: null, light_sleep_time: null,
        rem_time: null, sleep_score: null, breathing_rate_avg: null,
        heart_rate: null,
      }}],
      recharges: [],
    })
    const rows = db.prepare(
      "SELECT metric FROM health_snapshots WHERE date = '2024-01-13' AND source = 'polar'"
    ).all()
    expect(rows).toHaveLength(0)
  })
})
