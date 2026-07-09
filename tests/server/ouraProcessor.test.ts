import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('ouraProcessor', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('processOuraData writes sleep snapshots to health_snapshots', async () => {
    const { processOuraData } = await import('../../server/lib/integrations/oura/ouraProcessor')
    const { default: db }     = await import('../../server/db/client')

    const count = processOuraData({
      sleep: [{
        day: '2026-06-20', score: 78, average_hrv: 45, average_breath: 15.2,
        total_sleep_duration: 25200, deep_sleep_duration: 5400,
        light_sleep_duration: 10800, rem_sleep_duration: 9000, average_saturation: 97.5,
      }],
      readiness: [],
      activity:  [],
    })

    expect(count).toBe(8) // score + hrv + breath + total + deep + light + rem + spo2

    const snap = (key: string) =>
      (db.prepare("SELECT value FROM health_snapshots WHERE date='2026-06-20' AND metric=? AND source='oura'").get(key) as { value: number } | undefined)?.value

    expect(snap('sleep_score')).toBe(78)
    expect(snap('hrv')).toBe(45)
    expect(snap('resp_avg')).toBeCloseTo(15.2, 1)
    expect(snap('sleep_s')).toBe(25200)
    expect(snap('sleep_deep_s')).toBe(5400)
    expect(snap('sleep_light_s')).toBe(10800)
    expect(snap('sleep_rem_s')).toBe(9000)
    expect(snap('spo2_avg')).toBeCloseTo(97.5, 1)
  })

  it('processOuraData writes readiness snapshots', async () => {
    const { processOuraData } = await import('../../server/lib/integrations/oura/ouraProcessor')
    const { default: db }     = await import('../../server/db/client')

    processOuraData({
      sleep:     [],
      readiness: [{ day: '2026-06-21', score: 82, resting_heart_rate: 54 }],
      activity:  [],
    })

    const snap = (key: string) =>
      (db.prepare("SELECT value FROM health_snapshots WHERE date='2026-06-21' AND metric=? AND source='oura'").get(key) as { value: number } | undefined)?.value

    expect(snap('readiness_score')).toBe(82)
    expect(snap('resting_hr')).toBe(54)
  })

  it('processOuraData writes steps from activity', async () => {
    const { processOuraData } = await import('../../server/lib/integrations/oura/ouraProcessor')
    const { default: db }     = await import('../../server/db/client')

    processOuraData({ sleep: [], readiness: [], activity: [{ day: '2026-06-22', steps: 9500 }] })

    const snap = db.prepare("SELECT value FROM health_snapshots WHERE date='2026-06-22' AND metric='steps' AND source='oura'").get() as { value: number } | undefined
    expect(snap?.value).toBe(9500)
  })

  it('processOuraData skips null fields without writing', async () => {
    const { processOuraData } = await import('../../server/lib/integrations/oura/ouraProcessor')
    const { default: db }     = await import('../../server/db/client')

    const count = processOuraData({
      sleep: [{ day: '2026-06-23', score: null, average_hrv: null, average_breath: null, total_sleep_duration: null, deep_sleep_duration: null, light_sleep_duration: null, rem_sleep_duration: null, average_saturation: null }],
      readiness: [{ day: '2026-06-23', score: null, resting_heart_rate: null }],
      activity:  [{ day: '2026-06-23', steps: null }],
    })

    expect(count).toBe(0)
    const rows = db.prepare("SELECT * FROM health_snapshots WHERE date='2026-06-23' AND source='oura'").all()
    expect(rows).toHaveLength(0)
  })
})
