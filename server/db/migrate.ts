import db from './client'
import fs from 'fs'
import path from 'path'
import { initSettings } from '../lib/settings'
import { NUMERIC_NUTRIENT_KEYS, DESCRIPTIVE_NUTRIENT_KEYS } from '../lib/nutrition/nutrientKeys'

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
  for (const table of ['food_log_entries', 'nutrition_targets', 'recipe_ingredients']) {
    for (const [col, type] of NEW_NUTRIENT_COLUMNS) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`)
      } catch (e: unknown) {
        if (!(e instanceof Error) || !e.message.includes('duplicate column name')) throw e
        // column already exists, idempotent
      }
    }
  }

  // Food variants (multi-serving model) — see
  // docs/superpowers/specs/2026-07-15-nutrition-food-variants-design.md. foods loses
  // default_qty/default_unit + all nutrient columns (moved to food_variants);
  // food_log_entries/recipe_ingredients lose food_id, gain variant_id. As of 2026-07-20,
  // nothing real referenced any of this data (0 log entries, 0 recipes; foods' rows are
  // 100% reproducible from source files on disk) — this wipes and re-derives rather than
  // converting rows in place. Gated on foods still having default_qty so this whole block
  // is a no-op (and thus idempotent) once the swap has happened once.
  const foodsHasDefaultQty = db.prepare(
    "SELECT 1 FROM pragma_table_info('foods') WHERE name = 'default_qty'"
  ).get()
  if (foodsHasDefaultQty) {
    db.exec('DROP TABLE IF EXISTS food_variants')
    db.exec(`
      CREATE TABLE food_variants (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        food_id       INTEGER NOT NULL REFERENCES foods(id),
        label         TEXT NOT NULL,
        serving_qty   REAL NOT NULL,
        serving_unit  TEXT NOT NULL,
        gram_weight   REAL,
        is_default    INTEGER NOT NULL DEFAULT 0,
        source        TEXT NOT NULL,
        ${NUMERIC_NUTRIENT_KEYS.map(k => `${k} REAL`).join(',\n        ')},
        ${DESCRIPTIVE_NUTRIENT_KEYS.map(k => `${k} TEXT`).join(',\n        ')},
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec('CREATE INDEX IF NOT EXISTS idx_food_variants_food_id ON food_variants(food_id)')

    db.exec('DELETE FROM food_log_entries')
    db.exec('DELETE FROM recipe_ingredients')
    db.exec('DELETE FROM recipes')
    db.exec('DELETE FROM foods')

    db.exec('ALTER TABLE food_log_entries DROP COLUMN food_id')
    db.exec('ALTER TABLE food_log_entries ADD COLUMN variant_id INTEGER REFERENCES food_variants(id)')
    db.exec('ALTER TABLE recipe_ingredients DROP COLUMN food_id')
    db.exec('ALTER TABLE recipe_ingredients ADD COLUMN variant_id INTEGER REFERENCES food_variants(id)')

    // Rebuild foods without default_qty/default_unit/macro columns — SQLite can DROP
    // COLUMN one at a time but rebuilding via a new table is simpler for this many columns
    // at once, matching this file's existing rename-via-rebuild precedent above.
    db.exec(`
      CREATE TABLE foods_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        source       TEXT NOT NULL,
        source_id    TEXT,
        name         TEXT NOT NULL,
        brand        TEXT,
        source_json  TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(source, source_id)
      )
    `)
    db.exec('DROP TABLE foods')
    db.exec('ALTER TABLE foods_new RENAME TO foods')
    db.exec('CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name)')

    console.log('[db] migrated to food_variants schema — foods/food_log_entries/recipe_ingredients/recipes wiped (0 real rows existed); re-run scripts/nutrition/importFoods.ts to repopulate foods')
  }

  initSettings()

  console.log('[db] migrations complete')
}
