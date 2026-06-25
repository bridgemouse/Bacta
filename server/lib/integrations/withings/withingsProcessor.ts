import db from '../../../db/client'
import { WithingsMeasureGroup } from './withingsService'

const MEAS_TYPE: Record<number, { metric: string; unit: string }> = {
  1:  { metric: 'weight_kg',  unit: 'kg'  },
  11: { metric: 'resting_hr', unit: 'bpm' },
  54: { metric: 'spo2',       unit: '%'   },
}

export function processWithingsData(groups: WithingsMeasureGroup[]): number {
  let count = 0

  const upsertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source)
    VALUES (?, ?, ?, ?, 'withings')
  `)

  db.transaction(() => {
    for (const grp of groups) {
      const date = new Date(grp.date * 1000).toISOString().slice(0, 10)
      for (const m of grp.measures) {
        const def = MEAS_TYPE[m.type]
        if (!def) continue
        const value = Math.round(m.value * Math.pow(10, m.unit) * 1000) / 1000
        upsertSnapshot.run(date, def.metric, value, def.unit)
        count++
      }
    }
  })()

  return count
}
