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

CREATE TABLE IF NOT EXISTS macrofactor_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric)
);

CREATE TABLE IF NOT EXISTS manual_inputs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL UNIQUE,
  readiness    INTEGER CHECK(readiness BETWEEN 1 AND 5),
  caffeine_mg  INTEGER,
  supplements  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS garmin_activities (
  activity_id      INTEGER PRIMARY KEY,
  date             TEXT NOT NULL,
  start_time       TEXT NOT NULL,
  name             TEXT NOT NULL,
  type_key         TEXT NOT NULL,
  distance_m       REAL,
  duration_s       REAL,
  calories         INTEGER,
  avg_hr           INTEGER,
  elevation_m      REAL,
  aerobic_te       REAL,
  anaerobic_te     REAL,
  recovery_time_h  REAL,
  zone1_s          INTEGER,
  zone2_s          INTEGER,
  zone3_s          INTEGER,
  zone4_s          INTEGER,
  zone5_s          INTEGER,
  run_cadence      INTEGER,
  run_stride_cm    REAL,
  run_vert_osc_cm  REAL,
  run_gct_ms       INTEGER,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_garmin_activities_date ON garmin_activities(date);

CREATE TABLE IF NOT EXISTS garmin_activity_legs (
  leg_id            INTEGER PRIMARY KEY,
  activity_id       INTEGER NOT NULL,
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
  UNIQUE(activity_id, leg_index)
);
CREATE INDEX IF NOT EXISTS idx_garmin_activity_legs_activity ON garmin_activity_legs(activity_id);

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
