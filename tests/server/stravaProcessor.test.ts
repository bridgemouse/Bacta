import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('stravaProcessor', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('toTypeKey maps known Strava sport types to Bacta type_key', async () => {
    const { toTypeKey } = await import('../../server/lib/integrations/strava/stravaProcessor')
    expect(toTypeKey('Run')).toBe('running')
    expect(toTypeKey('Ride')).toBe('cycling')
    expect(toTypeKey('WeightTraining')).toBe('strength_training')
    expect(toTypeKey('VirtualRide')).toBe('cycling')
    expect(toTypeKey('UnknownSport')).toBe('unknownsport')
  })

  it('processActivities writes rows to health_activities', async () => {
    const { processActivities } = await import('../../server/lib/integrations/strava/stravaProcessor')
    const { default: db } = await import('../../server/db/client')

    const activities = [
      { id: 1001, name: 'Morning Run', sport_type: 'Run', start_date_local: '2026-06-20T07:00:00', distance: 5000, moving_time: 1800, total_elevation_gain: 50, average_heartrate: 145, kilojoules: 600 },
      { id: 1002, name: 'Evening Ride', sport_type: 'Ride', start_date_local: '2026-06-21T18:00:00', distance: 20000, moving_time: 3600, total_elevation_gain: 200 },
    ]

    const count = processActivities(activities)
    expect(count).toBe(2)

    const rows = db.prepare("SELECT * FROM health_activities WHERE source = 'strava' ORDER BY activity_id").all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0].activity_id).toBe('1001')
    expect(rows[0].type_key).toBe('running')
    expect(rows[0].distance_m).toBe(5000)
    expect(rows[0].avg_hr).toBe(145)
    expect(rows[0].calories).toBe(143) // Math.round(600 * 0.239)
    expect(rows[1].type_key).toBe('cycling')
    expect(rows[1].calories).toBeNull()
  })

  it('processActivities writes daily distance rollup to health_snapshots (summed)', async () => {
    const { processActivities } = await import('../../server/lib/integrations/strava/stravaProcessor')
    const { default: db } = await import('../../server/db/client')

    processActivities([
      { id: 4001, name: 'Morning Run', sport_type: 'Run', start_date_local: '2026-06-25T06:00:00', distance: 8000, moving_time: 2700, total_elevation_gain: 80 },
      { id: 4002, name: 'Evening Run', sport_type: 'Run', start_date_local: '2026-06-25T18:00:00', distance: 5000, moving_time: 1800, total_elevation_gain: 30 },
    ])

    const snap = db.prepare("SELECT value FROM health_snapshots WHERE date = '2026-06-25' AND metric = 'distance_m' AND source = 'strava'").get() as { value: number } | undefined
    expect(snap?.value).toBe(13000) // 8000 + 5000
  })

  it('processActivities is idempotent — re-running same data does not duplicate rows', async () => {
    const { processActivities } = await import('../../server/lib/integrations/strava/stravaProcessor')
    const { default: db } = await import('../../server/db/client')

    const activity = [{ id: 3001, name: 'Run', sport_type: 'Run', start_date_local: '2026-06-23T07:00:00', distance: 5000, moving_time: 1800, total_elevation_gain: 0 }]
    processActivities(activity)
    processActivities(activity)

    const rows = db.prepare("SELECT COUNT(*) as n FROM health_activities WHERE activity_id = '3001'").get() as { n: number }
    expect(rows.n).toBe(1)
  })
})
