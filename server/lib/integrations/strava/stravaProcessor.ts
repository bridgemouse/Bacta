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

const insertActivity = db.prepare(`
  INSERT OR REPLACE INTO health_activities
    (activity_id, source, date, start_time, name, type_key,
     distance_m, duration_s, calories, avg_hr, elevation_m)
  VALUES (?, 'strava', ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertSnapshot = db.prepare(`
  INSERT OR REPLACE INTO health_snapshots (date, metric, value, unit, source)
  VALUES (?, 'distance_m', ?, 'm', 'strava')
`)

export function processActivities(activities: StravaActivity[]): number {
  let count = 0
  const run = db.transaction((acts: StravaActivity[]) => {
    for (const act of acts) {
      const date     = act.start_date_local.slice(0, 10)
      const calories = act.kilojoules != null ? Math.round(act.kilojoules * 0.239) : null
      const avgHr    = act.average_heartrate != null ? Math.round(act.average_heartrate) : null

      insertActivity.run(
        String(act.id), date, act.start_date_local, act.name,
        toTypeKey(act.sport_type),
        act.distance   || null,
        act.moving_time || null,
        calories,
        avgHr,
        act.total_elevation_gain || null,
      )

      if (act.distance > 0) insertSnapshot.run(date, act.distance)
      count++
    }
  })
  run(activities)
  console.log(`[strava] processed ${count} activities`)
  return count
}
