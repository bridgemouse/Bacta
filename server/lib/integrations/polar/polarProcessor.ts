import db from '../../../db/client'
import { PolarData } from './polarService'

function parseDuration(dur: string): number {
  const m = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0')
}

const SPORT_MAP: Record<string, string> = {
  RUNNING:              'running',
  TRAIL_RUNNING:        'trail_running',
  CYCLING:              'cycling',
  MOUNTAIN_BIKING:      'cycling',
  SWIMMING:             'swimming',
  STRENGTH_TRAINING:    'strength_training',
  WALKING:              'walking',
  HIKING:               'hiking',
  CROSS_COUNTRY_SKIING: 'cross_country_skiing',
  OTHER:                'workout',
}

function toTypeKey(sport: string): string {
  return SPORT_MAP[sport] ?? 'workout'
}

export function processPolarData(data: PolarData): number {
  let count = 0

  const upsertActivity = db.prepare(`
    INSERT OR REPLACE INTO health_activities
      (activity_id, date, start_time, name, type_key, duration_s, distance_m, calories, avg_hr, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'polar')
  `)

  const upsertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source)
    VALUES (?, ?, ?, ?, 'polar')
  `)

  db.transaction(() => {
    for (const ex of data.exercises) {
      const date = ex.start_time.slice(0, 10)
      const name = ex.sport.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      upsertActivity.run(
        ex.id, date, ex.start_time, name, toTypeKey(ex.sport),
        parseDuration(ex.duration),
        ex.distance ?? null,
        ex.calories ?? null,
        ex.heart_rate?.average ?? null,
      )
      count++
    }

    for (const night of data.nights) {
      const s = night.sleep_summary
      const rows: [string, number | null, string][] = [
        ['sleep_duration_s', s.total_sleep_time,   's'],
        ['deep_sleep_s',     s.deep_sleep_time,    's'],
        ['light_sleep_s',    s.light_sleep_time,   's'],
        ['rem_sleep_s',      s.rem_time,           's'],
        ['sleep_score',      s.sleep_score,        'score'],
        ['respiration',      s.breathing_rate_avg, 'rpm'],
      ]
      for (const [metric, value, unit] of rows) {
        if (value == null) continue
        upsertSnapshot.run(night.date, metric, value, unit)
        count++
      }
    }

    for (const r of data.recharges) {
      if (r.heart_rate_avg != null) {
        upsertSnapshot.run(r.date, 'resting_hr', r.heart_rate_avg, 'bpm')
        count++
      }
      if (r.heart_rate_variability_sdnn != null) {
        upsertSnapshot.run(r.date, 'hrv', r.heart_rate_variability_sdnn, 'ms')
        count++
      }
    }
  })()

  return count
}
