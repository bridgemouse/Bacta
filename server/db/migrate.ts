import db from './client'
import fs from 'fs'
import path from 'path'
import { initSettings } from '../lib/settings'

// NEW_ACTIVITY_COLS: columns are now part of health_activities schema from the start
// (legacy ALTER TABLE loop removed — garmin_activities no longer exists post-migration)

export function migrate() {
  const schema = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf-8'
  )
  db.exec(schema)

  // Rename garmin_snapshots → health_snapshots (idempotent)
  const hasOldSnapshots = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='garmin_snapshots'"
  ).get()
  if (hasOldSnapshots) {
    db.exec(`
      INSERT OR IGNORE INTO health_snapshots
        (id, date, metric, value, unit, source_json, created_at)
      SELECT id, date, metric, value, unit, source_json, created_at
      FROM garmin_snapshots
    `)
    db.exec('DROP TABLE garmin_snapshots')
    console.log('[db] migrated garmin_snapshots → health_snapshots')
  }

  // Rename garmin_activities → health_activities (idempotent)
  const hasOldActivities = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='garmin_activities'"
  ).get()
  if (hasOldActivities) {
    db.exec(`
      INSERT OR IGNORE INTO health_activities
        (activity_id, date, start_time, name, type_key, distance_m, duration_s,
         calories, avg_hr, elevation_m, aerobic_te, anaerobic_te, recovery_time_h,
         zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
         run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, created_at)
      SELECT
        CAST(activity_id AS TEXT), date, start_time, name, type_key, distance_m, duration_s,
        calories, avg_hr, elevation_m, aerobic_te, anaerobic_te, recovery_time_h,
        zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
        run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, created_at
      FROM garmin_activities
    `)
    db.exec('DROP TABLE garmin_activities')
    console.log('[db] migrated garmin_activities → health_activities')
  }

  // Rename garmin_activity_legs → health_activity_legs (idempotent)
  const hasOldLegs = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='garmin_activity_legs'"
  ).get()
  if (hasOldLegs) {
    db.exec(`
      INSERT OR IGNORE INTO health_activity_legs
        (leg_id, activity_id, leg_index, type_key, start_time, duration_s, distance_m,
         calories, avg_hr, max_hr, aerobic_te, anaerobic_te, training_load,
         body_battery_diff, zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
         run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, run_power_w,
         row_stroke_rate, row_power_w, row_strokes, created_at)
      SELECT
        leg_id, CAST(activity_id AS TEXT), leg_index, type_key, start_time, duration_s,
        distance_m, calories, avg_hr, max_hr, aerobic_te, anaerobic_te, training_load,
        body_battery_diff, zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
        run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, run_power_w,
        row_stroke_rate, row_power_w, row_strokes, created_at
      FROM garmin_activity_legs
    `)
    db.exec('DROP TABLE garmin_activity_legs')
    console.log('[db] migrated garmin_activity_legs → health_activity_legs')
  }

  // Add section column to mx4_chat_messages — tracks which section a message belongs to
  try {
    db.exec('ALTER TABLE mx4_chat_messages ADD COLUMN section TEXT')
  } catch (e: unknown) {
    if (!(e instanceof Error) || !e.message.includes('duplicate column name')) throw e
    // column already exists, idempotent
  }

  initSettings()

  console.log('[db] migrations complete')
}
