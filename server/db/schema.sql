CREATE TABLE IF NOT EXISTS garmin_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric)
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
  activity_id  INTEGER PRIMARY KEY,
  date         TEXT NOT NULL,
  start_time   TEXT NOT NULL,
  name         TEXT NOT NULL,
  type_key     TEXT NOT NULL,
  distance_m   REAL,
  duration_s   REAL,
  calories     INTEGER,
  avg_hr       INTEGER,
  elevation_m  REAL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_garmin_activities_date ON garmin_activities(date);

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
