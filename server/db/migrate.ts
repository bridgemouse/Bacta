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

  // Drop the dead macrofactor_snapshots table (idempotent) — confirmed empty (0 rows),
  // zero blast radius (no route/hook/script reads or writes it). Nutrition is now built
  // on purpose-built foods/food_log_entries/nutrition_targets tables instead of EAV.
  const hasMacrofactorSnapshots = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='macrofactor_snapshots'"
  ).get()
  if (hasMacrofactorSnapshots) {
    db.exec('DROP TABLE macrofactor_snapshots')
    console.log('[db] dropped unused macrofactor_snapshots')
  }

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

  // Expand health_activities with additional per-activity fields (#41)
  const NEW_ACTIVITY_COLUMNS: Array<[string, string]> = [
    ['max_hr', 'INTEGER'],
    ['min_hr', 'INTEGER'],
    ['training_load', 'REAL'],
    ['body_battery_diff', 'INTEGER'],
    ['moving_duration_s', 'REAL'],
    ['elapsed_duration_s', 'REAL'],
    ['avg_speed_mps', 'REAL'],
    ['max_speed_mps', 'REAL'],
    ['training_effect_label', 'TEXT'],
    ['steps', 'INTEGER'],
    ['bmr_calories', 'INTEGER'],
    ['moderate_intensity_min', 'REAL'],
    ['vigorous_intensity_min', 'REAL'],
    ['avg_power_w', 'INTEGER'],
    ['normalized_power_w', 'INTEGER'],
    ['active_sets', 'INTEGER'],
    ['total_exercise_reps', 'INTEGER'],
  ]
  for (const [col, type] of NEW_ACTIVITY_COLUMNS) {
    try {
      db.exec(`ALTER TABLE health_activities ADD COLUMN ${col} ${type}`)
    } catch (e: unknown) {
      if (!(e instanceof Error) || !e.message.includes('duplicate column name')) throw e
      // column already exists, idempotent
    }
  }

  // Widen tracked nutrients to SparkyFitness parity (#140) — sub-macro fat components,
  // sodium/sugar/cholesterol/potassium, key vitamins/minerals, glycemic index, and open
  // JSON escape hatches for custom nutrients/allergens/traces. Applied uniformly across
  // all four nutrient-bearing tables (mirrors how the original 5 macro columns already
  // exist on all four), even though not every field is meaningful on every table —
  // uniformity keeps the API's per-table handling mechanical instead of table-special-cased.
  const NEW_NUTRIENT_COLUMNS: Array<[string, string]> = [
    ['sodium_mg', 'REAL'],
    ['sugar_g', 'REAL'],
    ['saturated_fat_g', 'REAL'],
    ['polyunsaturated_fat_g', 'REAL'],
    ['monounsaturated_fat_g', 'REAL'],
    ['trans_fat_g', 'REAL'],
    ['cholesterol_mg', 'REAL'],
    ['potassium_mg', 'REAL'],
    ['vitamin_a_mcg', 'REAL'],
    ['vitamin_c_mg', 'REAL'],
    ['calcium_mg', 'REAL'],
    ['iron_mg', 'REAL'],
    ['glycemic_index', 'TEXT'],
    ['custom_nutrients', 'TEXT'],
    ['allergens', 'TEXT'],
    ['traces', 'TEXT'],
  ]
  for (const table of ['foods', 'food_log_entries', 'nutrition_targets', 'recipe_ingredients']) {
    for (const [col, type] of NEW_NUTRIENT_COLUMNS) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`)
      } catch (e: unknown) {
        if (!(e instanceof Error) || !e.message.includes('duplicate column name')) throw e
        // column already exists, idempotent
      }
    }
  }

  initSettings()

  console.log('[db] migrations complete')
}
