import db from '../../../db/client'
import { OuraData } from './ouraService'

export function processOuraData(data: OuraData): number {
  const upsert = db.prepare(
    `INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source) VALUES (?, ?, ?, ?, 'oura')`
  )

  let count = 0
  const run = db.transaction(() => {
    for (const s of data.sleep) {
      if (s.score != null)                { upsert.run(s.day, 'sleep_score',      s.score,                'score'); count++ }
      if (s.average_hrv != null)          { upsert.run(s.day, 'hrv',              s.average_hrv,          'ms');    count++ }
      if (s.average_breath != null)       { upsert.run(s.day, 'resp_avg',        s.average_breath,       'brpm'); count++ }
      if (s.total_sleep_duration != null) { upsert.run(s.day, 'sleep_s',         s.total_sleep_duration, 's');     count++ }
      if (s.deep_sleep_duration != null)  { upsert.run(s.day, 'sleep_deep_s',    s.deep_sleep_duration,  's');     count++ }
      if (s.light_sleep_duration != null) { upsert.run(s.day, 'sleep_light_s',   s.light_sleep_duration, 's');     count++ }
      if (s.rem_sleep_duration != null)   { upsert.run(s.day, 'sleep_rem_s',     s.rem_sleep_duration,   's');     count++ }
      if (s.average_saturation != null)   { upsert.run(s.day, 'spo2_avg',        s.average_saturation,   '%');     count++ }
    }
    for (const r of data.readiness) {
      if (r.score != null)              { upsert.run(r.day, 'readiness_score', r.score,              'score'); count++ }
      if (r.resting_heart_rate != null) { upsert.run(r.day, 'resting_hr',     r.resting_heart_rate, 'bpm');   count++ }
    }
    for (const a of data.activity) {
      if (a.steps != null) { upsert.run(a.day, 'steps', a.steps, 'steps'); count++ }
    }
  })
  run()
  console.log(`[oura] processed ${count} snapshots`)
  return count
}
