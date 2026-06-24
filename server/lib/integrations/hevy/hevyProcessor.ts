import db from '../../../db/client'
import { HevyWorkout } from './hevyService'

export function processWorkouts(workouts: HevyWorkout[]): number {
  const insertActivity = db.prepare(`
    INSERT OR REPLACE INTO health_activities
      (activity_id, source, date, start_time, name, type_key, duration_s)
    VALUES (?, 'hevy', ?, ?, ?, 'strength_training', ?)
  `)

  let count = 0
  const run = db.transaction((ws: HevyWorkout[]) => {
    for (const w of ws) {
      const date      = w.start_time.slice(0, 10)
      const durationS = w.end_time && w.start_time
        ? Math.round((new Date(w.end_time).getTime() - new Date(w.start_time).getTime()) / 1000)
        : null
      insertActivity.run(w.id, date, w.start_time, w.title || 'Strength Training', durationS)
      count++
    }
  })
  run(workouts)
  console.log(`[hevy] processed ${count} workouts`)
  return count
}
