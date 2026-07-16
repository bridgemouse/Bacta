CREATE TABLE IF NOT EXISTS health_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source      TEXT NOT NULL DEFAULT 'garmin',
  source_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric, source)
);

-- Reference food/ingredient data. Bulk-imported from USDA FoodData Central (SR Legacy +
-- Foundation Foods) and Open Food Facts, plus user-saved custom/ad-hoc foods (source='custom').
-- Macro values are per (default_qty, default_unit) — e.g. per 100g — mirroring how both
-- USDA and OFF publish their data, so import requires no unit conversion at write time.
CREATE TABLE IF NOT EXISTS foods (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,              -- 'usda' | 'openfoodfacts' | 'custom'
  source_id    TEXT,                       -- USDA fdcId or OFF barcode/code; NULL for custom foods
  name         TEXT NOT NULL,
  brand        TEXT,                       -- packaged/branded foods only; NULL for generic/whole foods
  default_qty  REAL NOT NULL DEFAULT 100,  -- the quantity the macro columns below refer to
  default_unit TEXT NOT NULL DEFAULT 'g',
  calories     REAL,
  protein_g    REAL,
  carbs_g      REAL,
  fat_g        REAL,
  fiber_g      REAL,
  source_json  TEXT,                       -- raw import payload — mirrors health_snapshots' source_json,
                                            -- lets a future micronutrient feature mine
                                            -- fields we don't surface yet without re-importing
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);

-- Logged diary entries. One row per food per meal per day — the same multi-row-per-day
-- shape as health_activities, for the same reason (EAV can't represent it).
-- Nutrient columns are a denormalized snapshot at log time (mirrors SparkyFitness's
-- food_entries design): editing or re-importing a `foods` row later must never silently
-- change what a past day's log says was eaten.
CREATE TABLE IF NOT EXISTS food_log_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,               -- ISO date this entry counts toward
  meal_type   TEXT NOT NULL,               -- 'breakfast' | 'lunch' | 'dinner' | 'snack' | free-form label
  logged_at   TEXT NOT NULL DEFAULT (datetime('now')),
  food_id     INTEGER REFERENCES foods(id),-- NULL for a fully ad-hoc entry (FR3)
  name        TEXT NOT NULL,               -- denormalized display name, always present
  quantity    REAL NOT NULL,
  unit        TEXT NOT NULL,
  calories    REAL,
  protein_g   REAL,
  carbs_g     REAL,
  fat_g       REAL,
  fiber_g     REAL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_food_log_entries_date ON food_log_entries(date);
-- Covers GET /log/recent's ORDER BY logged_at DESC, id DESC — without this, SQLite falls
-- back to a full-table scan + temp b-tree sort for every Log Entry sheet open (#147).
CREATE INDEX IF NOT EXISTS idx_food_log_entries_logged_at ON food_log_entries(logged_at DESC, id DESC);

-- Daily macro/calorie targets. Date-keyed (not a single mutable settings row) so target
-- changes over months stay visible in history — same reasoning as user_goals in SparkyFitness,
-- and the same "don't overwrite history" instinct behind health_snapshots being date-keyed.
-- "Current" targets = the row with the latest date <= the date being queried.
CREATE TABLE IF NOT EXISTS nutrition_targets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL UNIQUE,         -- date this target set takes effect from
  calories   REAL,
  protein_g  REAL,
  carbs_g    REAL,
  fat_g      REAL,
  fiber_g    REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Saved recipes. Ingredient composition is stored here so it can be inspected/re-derived
-- later; saving one also materializes a per-serving `foods` row (source='custom') so a
-- recipe logs exactly like any other saved food — no separate logging code path needed.
CREATE TABLE IF NOT EXISTS recipes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  servings   REAL NOT NULL,
  food_id    INTEGER NOT NULL REFERENCES foods(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per ingredient. Denormalized snapshot (mirrors food_log_entries) — a later edit
-- to a referenced food's macros must not silently change what a saved recipe says it used.
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id  INTEGER NOT NULL REFERENCES recipes(id),
  food_id    INTEGER REFERENCES foods(id),   -- NULL for an ad-hoc ingredient
  name       TEXT NOT NULL,
  quantity   REAL NOT NULL,
  unit       TEXT NOT NULL,
  calories   REAL,
  protein_g  REAL,
  carbs_g    REAL,
  fat_g      REAL,
  fiber_g    REAL
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

CREATE TABLE IF NOT EXISTS manual_inputs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL UNIQUE,
  readiness    INTEGER CHECK(readiness BETWEEN 1 AND 5),
  caffeine_mg  INTEGER,
  supplements  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS health_activities (
  activity_id           TEXT NOT NULL,
  source                TEXT NOT NULL DEFAULT 'garmin',
  date                  TEXT NOT NULL,
  start_time            TEXT NOT NULL,
  name                  TEXT NOT NULL,
  type_key              TEXT NOT NULL,
  distance_m            REAL,
  duration_s            REAL,
  calories              INTEGER,
  avg_hr                INTEGER,
  elevation_m           REAL,
  aerobic_te            REAL,
  anaerobic_te          REAL,
  recovery_time_h       REAL,
  zone1_s               INTEGER,
  zone2_s               INTEGER,
  zone3_s               INTEGER,
  zone4_s               INTEGER,
  zone5_s               INTEGER,
  run_cadence           INTEGER,
  run_stride_cm         REAL,
  run_vert_osc_cm       REAL,
  run_gct_ms            INTEGER,
  max_hr                INTEGER,
  min_hr                INTEGER,
  training_load         REAL,
  body_battery_diff     INTEGER,
  moving_duration_s     REAL,
  elapsed_duration_s    REAL,
  avg_speed_mps         REAL,
  max_speed_mps         REAL,
  training_effect_label TEXT,
  steps                 INTEGER,
  bmr_calories          INTEGER,
  moderate_intensity_min REAL,
  vigorous_intensity_min REAL,
  avg_power_w           INTEGER,
  normalized_power_w    INTEGER,
  active_sets           INTEGER,
  total_exercise_reps   INTEGER,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (activity_id, source)
);
CREATE INDEX IF NOT EXISTS idx_health_activities_date ON health_activities(date);

CREATE TABLE IF NOT EXISTS health_activity_legs (
  leg_id            INTEGER PRIMARY KEY,
  activity_id       TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'garmin',
  leg_index         INTEGER NOT NULL,
  type_key          TEXT NOT NULL,
  start_time        TEXT NOT NULL,
  duration_s        REAL,
  distance_m        REAL,
  calories          INTEGER,
  avg_hr            INTEGER,
  max_hr            INTEGER,
  aerobic_te        REAL,
  anaerobic_te      REAL,
  training_load     REAL,
  body_battery_diff INTEGER,
  zone1_s           INTEGER,
  zone2_s           INTEGER,
  zone3_s           INTEGER,
  zone4_s           INTEGER,
  zone5_s           INTEGER,
  run_cadence       INTEGER,
  run_stride_cm     REAL,
  run_vert_osc_cm   REAL,
  run_gct_ms        INTEGER,
  run_power_w       INTEGER,
  row_stroke_rate   INTEGER,
  row_power_w       INTEGER,
  row_strokes       INTEGER,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(activity_id, source, leg_index)
);
CREATE INDEX IF NOT EXISTS idx_health_activity_legs_activity ON health_activity_legs(activity_id);

CREATE TABLE IF NOT EXISTS blood_work (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,
  marker          TEXT NOT NULL,
  value           REAL,
  unit            TEXT,
  reference_range TEXT,
  source_file     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, marker)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mx4_briefings (
  section      TEXT PRIMARY KEY,
  content_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  model        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mx4_chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON mx4_chat_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS app_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT NOT NULL,
  level      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_app_logs_source_created ON app_logs(source, created_at);
