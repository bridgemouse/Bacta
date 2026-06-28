import db from '../../../db/client'
import { WhoopData } from './whoopService'

const SPORT_MAP: Record<number, string> = {
  0:  'workout',
  1:  'running',
  2:  'cycling',
  18: 'rowing',
  28: 'cycling',
  32: 'climbing',
  36: 'skiing',
  37: 'sport',
  40: 'swimming',
  41: 'sport',
  50: 'yoga',
}

export function toTypeKey(sportId: number): string {
  return SPORT_MAP[sportId] ?? 'workout'
}

export function processWhoopData(data: WhoopData): number {
  const upsertSnapshot = db.prepare(
    `INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source) VALUES (?, ?, ?, ?, 'whoop')`
  )
  const upsertActivity = db.prepare(`
    INSERT OR REPLACE INTO health_activities
      (activity_id, source, date, start_time, name, type_key, distance_m, duration_s, calories, avg_hr, elevation_m)
    VALUES (?, 'whoop', ?, ?, ?, ?, ?, ?, ?, ?, null)
  `)

  let count = 0
  const run = db.transaction(() => {
    for (const r of data.recovery) {
      if (r.score_state !== 'SCORED' || !r.score) continue
      const day = r.created_at.slice(0, 10)
      upsertSnapshot.run(day, 'readiness_score', r.score.recovery_score,     'score'); count++
      upsertSnapshot.run(day, 'resting_hr',       r.score.resting_heart_rate, 'bpm');   count++
      upsertSnapshot.run(day, 'hrv',              r.score.hrv_rmssd_milli,    'ms');    count++
    }
    for (const s of data.sleep) {
      if (s.nap || s.score_state !== 'SCORED' || !s.score) continue
      const day    = s.end.slice(0, 10)
      const ss     = s.score.stage_summary
      const totalS = Math.round((ss.total_in_bed_time_milli - ss.total_awake_time_milli) / 1000)
      upsertSnapshot.run(day, 'sleep_duration_s', totalS,                                                       's'); count++
      upsertSnapshot.run(day, 'deep_sleep_s',     Math.round(ss.total_slow_wave_sleep_time_milli / 1000), 's'); count++
      upsertSnapshot.run(day, 'light_sleep_s',    Math.round(ss.total_light_sleep_time_milli / 1000),    's'); count++
      upsertSnapshot.run(day, 'rem_sleep_s',      Math.round(ss.total_rem_sleep_time_milli / 1000),      's'); count++
    }
    for (const w of data.workouts) {
      if (w.score_state !== 'SCORED' || !w.score) continue
      const day       = w.start.slice(0, 10)
      const durationS = Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 1000)
      const calories  = w.score.kilojoule > 0 ? Math.round(w.score.kilojoule * 0.239) : null
      const distanceM = w.score.distance_meter != null && w.score.distance_meter > 0 ? w.score.distance_meter : null
      const typeKey   = toTypeKey(w.sport_id)
      upsertActivity.run(w.id, day, w.start, `Whoop ${typeKey}`, typeKey, distanceM, durationS > 0 ? durationS : null, calories, w.score.average_heart_rate > 0 ? Math.round(w.score.average_heart_rate) : null)
      count++
    }
  })
  run()
  console.log(`[whoop] processed ${count} records`)
  return count
}
