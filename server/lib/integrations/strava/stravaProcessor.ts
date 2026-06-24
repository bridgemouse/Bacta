import db from '../../../db/client'
import { StravaActivity } from './stravaService'

const TYPE_MAP: Record<string, string> = {
  Run:              'running',
  TrailRun:         'trail_running',
  Walk:             'walking',
  Hike:             'hiking',
  Ride:             'cycling',
  VirtualRide:      'cycling',
  MountainBikeRide: 'cycling',
  GravelRide:       'cycling',
  EBikeRide:        'cycling',
  WeightTraining:   'strength_training',
  Crossfit:         'strength_training',
  Swim:             'swimming',
  Workout:          'workout',
  Yoga:             'yoga',
  Rowing:           'rowing',
  Kayaking:         'kayaking',
  Soccer:           'sport',
  Tennis:           'sport',
  Golf:             'sport',
  Skiing:           'skiing',
  Snowboard:        'skiing',
  IceSkate:         'skating',
  InlineSkate:      'skating',
  Elliptical:       'cardio',
  StairStepper:     'cardio',
  Velomobile:       'cycling',
}

export function toTypeKey(sportType: string): string {
  return TYPE_MAP[sportType] ?? sportType.toLowerCase().replace(/\s+/g, '_')
}

export function processActivities(activities: StravaActivity[]): number {
  const insertActivity = db.prepare(`
    INSERT OR REPLACE INTO health_activities
      (activity_id, source, date, start_time, name, type_key,
       distance_m, duration_s, calories, avg_hr, elevation_m)
    VALUES (?, 'strava', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const upsertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source)
    SELECT date, 'distance_m', SUM(distance_m), 'm', 'strava'
    FROM health_activities
    WHERE source = 'strava' AND distance_m IS NOT NULL
    GROUP BY date
  `)

  let count = 0
  const run = db.transaction((acts: StravaActivity[]) => {
    for (const act of acts) {
      const date     = act.start_date_local.slice(0, 10)
      const calories = act.kilojoules != null ? Math.round(act.kilojoules * 0.239) : null
      const avgHr    = act.average_heartrate != null ? Math.round(act.average_heartrate) : null

      insertActivity.run(
        String(act.id), date, act.start_date_local, act.name,
        toTypeKey(act.sport_type),
        act.distance > 0             ? act.distance             : null,
        act.moving_time > 0          ? act.moving_time          : null,
        calories,
        avgHr,
        act.total_elevation_gain > 0 ? act.total_elevation_gain : null,
      )

      count++
    }
  })
  run(activities)
  upsertSnapshot.run()
  console.log(`[strava] processed ${count} activities`)
  return count
}
