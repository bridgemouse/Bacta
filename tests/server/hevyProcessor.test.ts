import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('hevyProcessor', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('processWorkouts writes rows to health_activities with type_key=strength_training', async () => {
    const { processWorkouts } = await import('../../server/lib/integrations/hevy/hevyProcessor')
    const { default: db } = await import('../../server/db/client')

    const workouts = [
      { id: 'hevy-001', title: 'Push Day', start_time: '2026-06-20T09:00:00Z', end_time: '2026-06-20T10:00:00Z', exercises: [] },
      { id: 'hevy-002', title: 'Pull Day', start_time: '2026-06-21T09:00:00Z', end_time: '2026-06-21T09:45:00Z', exercises: [] },
    ]

    const count = processWorkouts(workouts)
    expect(count).toBe(2)

    const rows = db.prepare("SELECT * FROM health_activities WHERE source = 'hevy' ORDER BY activity_id").all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0].activity_id).toBe('hevy-001')
    expect(rows[0].type_key).toBe('strength_training')
    expect(rows[0].duration_s).toBe(3600)
    expect(rows[1].duration_s).toBe(2700)
  })

  it('processWorkouts is idempotent', async () => {
    const { processWorkouts } = await import('../../server/lib/integrations/hevy/hevyProcessor')
    const { default: db } = await import('../../server/db/client')

    const w = [{ id: 'hevy-999', title: 'Test', start_time: '2026-06-23T08:00:00Z', end_time: '2026-06-23T09:00:00Z', exercises: [] }]
    processWorkouts(w)
    processWorkouts(w)

    const row = db.prepare("SELECT COUNT(*) as n FROM health_activities WHERE activity_id = 'hevy-999'").get() as { n: number }
    expect(row.n).toBe(1)
  })
})
