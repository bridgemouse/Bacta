process.env.DB_PATH = ':memory:'

import { describe, it, expect, beforeAll } from 'vitest'
import { migrate } from '../../server/db/migrate'

describe('withingsProcessor', () => {
  beforeAll(() => { migrate() })

  it('writes weight_kg from meastype 1', async () => {
    const db = (await import('../../server/db/client')).default
    const { processWithingsData } = await import('../../server/lib/integrations/withings/withingsProcessor')

    processWithingsData([{ date: 1704844800, measures: [{ value: 70750, type: 1, unit: -3 }] }])
    const row = db.prepare(
      "SELECT value FROM health_snapshots WHERE metric = 'weight_kg' AND source = 'withings'"
    ).get() as { value: number } | undefined
    expect(row).toBeDefined()
    expect(row!.value).toBeCloseTo(70.75, 2)
  })

  it('writes resting_hr from meastype 11', async () => {
    const db = (await import('../../server/db/client')).default
    const { processWithingsData } = await import('../../server/lib/integrations/withings/withingsProcessor')

    processWithingsData([{ date: 1704931200, measures: [{ value: 58, type: 11, unit: 0 }] }])
    const row = db.prepare(
      "SELECT value FROM health_snapshots WHERE metric = 'resting_hr' AND source = 'withings'"
    ).get() as { value: number } | undefined
    expect(row).toBeDefined()
    expect(row!.value).toBe(58)
  })

  it('writes spo2 from meastype 54', async () => {
    const db = (await import('../../server/db/client')).default
    const { processWithingsData } = await import('../../server/lib/integrations/withings/withingsProcessor')

    processWithingsData([{ date: 1705017600, measures: [{ value: 9800, type: 54, unit: -2 }] }])
    const row = db.prepare(
      "SELECT value FROM health_snapshots WHERE metric = 'spo2_avg' AND source = 'withings'"
    ).get() as { value: number } | undefined
    expect(row).toBeDefined()
    expect(row!.value).toBeCloseTo(98.0, 1)
  })

  it('skips unknown meastype', async () => {
    const db = (await import('../../server/db/client')).default
    const { processWithingsData } = await import('../../server/lib/integrations/withings/withingsProcessor')

    const count = processWithingsData([{ date: 1705104000, measures: [{ value: 999, type: 99, unit: 0 }] }])
    expect(count).toBe(0)
  })
})
