import { Router } from 'express'
import { spawn } from 'child_process'
import path from 'path'
import db from '../db/client'

const garminRouter = Router()

const VALID_METRICS = [
  // Daily stats
  'steps', 'resting_hr', 'stress_avg', 'stress_max',
  'calories_total', 'calories_active', 'distance_m',
  'floors_up', 'floors_down',
  // Sleep
  'sleep_s', 'sleep_deep_s', 'sleep_light_s', 'sleep_rem_s', 'sleep_awake_s',
  'sleep_score', 'sleep_spo2', 'sleep_resp',
  // HRV
  'hrv', 'hrv_week_avg',
  // Body battery (charged/drained = delta amounts; wake/current = level readings)
  'body_battery_charged', 'body_battery_drained',
  // SpO2 / respiration
  'spo2_avg', 'spo2_min', 'resp_avg', 'resp_max',
  // Training / readiness
  'recovery_score', 'recovery_time_h', 'training_status_n', 'training_load', 'training_load_min', 'training_load_max',
  // HRV
  'hrv_baseline_low', 'hrv_baseline_high',
  // Sleep extras
  'sleep_hr', 'sleep_stress',
  // Body battery
  'body_battery_current', 'body_battery_wake',
  // Fitness metrics
  'vo2max', 'fitness_age', 'fitness_age_achievable', 'endurance_score', 'hill_score',
  // Body composition / weight
  'weight_kg', 'bmi', 'body_fat_pct', 'muscle_mass_kg',
  // Blood pressure
  'bp_systolic', 'bp_diastolic',
  // Intensity
  'intensity_mod_min', 'intensity_vig_min',
  // Daily goals
  'steps_goal', 'floors_goal',
  // HR zones
  'hrzone_1_min', 'hrzone_2_min', 'hrzone_3_min', 'hrzone_4_min', 'hrzone_5_min',
]

// In-memory sync state — resets on server restart, which is fine
type SyncStatus = 'idle' | 'running' | 'done' | 'error'
let syncStatus: SyncStatus = 'idle'
let syncStartedAt: number | null = null

// GET /api/garmin/summary — latest available value per metric
garminRouter.get('/summary', (_req, res) => {
  const rows = db.prepare(
    `SELECT metric, value FROM garmin_snapshots gs
     WHERE date = (SELECT MAX(date) FROM garmin_snapshots WHERE metric = gs.metric)`
  ).all() as Array<{ metric: string; value: number }>

  const summary: Record<string, number> = {}
  for (const row of rows) summary[row.metric] = row.value
  res.json(summary)
})

// GET /api/garmin/activities — last N days, newest first
garminRouter.get('/activities', (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 30)
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const rows = db.prepare(
    `SELECT activity_id, date, start_time, name, type_key,
            distance_m, duration_s, calories, avg_hr, elevation_m,
            aerobic_te, anaerobic_te, recovery_time_h,
            zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
            run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms
     FROM garmin_activities WHERE date >= ? ORDER BY start_time DESC`
  ).all(since)
  res.json({ activities: rows })
})

// GET /api/garmin/sync/status — current sync state
garminRouter.get('/sync/status', (_req, res) => {
  const elapsed = syncStartedAt != null ? Math.round((Date.now() - syncStartedAt) / 1000) : null
  res.json({ status: syncStatus, elapsed })
})

// POST /api/garmin/sync — spawn poller, track completion
garminRouter.post('/sync', (_req, res) => {
  if (syncStatus === 'running') {
    res.status(202).json({ ok: true, status: 'running' })
    return
  }
  const script = path.join(process.cwd(), 'scripts', 'garmin_poller.py')
  syncStatus = 'running'
  syncStartedAt = Date.now()
  const child = spawn('python3', [script], { stdio: 'ignore' })
  child.on('close', (code) => {
    syncStatus = code === 0 ? 'done' : 'error'
    // Auto-reset to idle after 90s so the button returns to ready state
    setTimeout(() => { syncStatus = 'idle'; syncStartedAt = null }, 90_000)
  })
  res.status(202).json({ ok: true, status: 'running' })
})

// GET /api/garmin/weekly-volume?weeks=6
garminRouter.get('/weekly-volume', (req, res) => {
  const weeks = Math.min(Math.max(1, Number(req.query.weeks) || 6), 26)
  const rows = db.prepare(
    `SELECT strftime('%Y-%W', date) AS week,
            ROUND(SUM(duration_s) / 3600.0, 2) AS hours
     FROM garmin_activities
     GROUP BY week
     ORDER BY MIN(date) DESC
     LIMIT ?`
  ).all(weeks) as Array<{ week: string; hours: number }>
  res.json({ weeks: rows.reverse() })
})

// GET /api/garmin/weekly-intensity — sum mod+vig intensity mins since Monday (Garmin's week boundary)
garminRouter.get('/weekly-intensity', (_req, res) => {
  const row = db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN metric = 'intensity_mod_min' THEN value ELSE 0 END), 0) AS moderate,
       COALESCE(SUM(CASE WHEN metric = 'intensity_vig_min' THEN value ELSE 0 END), 0) AS vigorous
     FROM garmin_snapshots
     WHERE metric IN ('intensity_mod_min', 'intensity_vig_min')
       AND date >= date('now', '-' || CAST((CAST(strftime('%w', 'now') AS INTEGER) + 6) % 7 AS TEXT) || ' days')`
  ).get() as { moderate: number; vigorous: number }
  res.json({ moderate: row.moderate, vigorous: row.vigorous })
})

// GET /api/garmin/weekly-avg-hr?weeks=6
garminRouter.get('/weekly-avg-hr', (req, res) => {
  const weeks = Math.min(Math.max(1, Number(req.query.weeks) || 6), 26)
  const rows = db.prepare(
    `SELECT strftime('%Y-%W', date) AS week,
            CAST(ROUND(AVG(avg_hr), 0) AS INTEGER) AS avg_hr
     FROM garmin_activities
     WHERE avg_hr IS NOT NULL AND avg_hr > 0
     GROUP BY week
     ORDER BY MIN(date) DESC
     LIMIT ?`
  ).all(weeks) as Array<{ week: string; avg_hr: number }>
  res.json({ weeks: rows.reverse() })
})

// GET /api/garmin/sleep-hypno — 24-block hypnogram resampled from latest sleep_score source_json
garminRouter.get('/sleep-hypno', (_req, res) => {
  const EMPTY = { hypno: [], startLocal: null, endLocal: null }
  try {
    const row = db.prepare(
      `SELECT source_json FROM garmin_snapshots WHERE metric = 'sleep_score' ORDER BY date DESC LIMIT 1`
    ).get() as { source_json: string } | undefined

    if (!row) { res.json(EMPTY); return }

    const obj = JSON.parse(row.source_json)
    const dto = obj.dailySleepDTO
    const startMs: number = dto.sleepStartTimestampGMT
    const endMs: number = dto.sleepEndTimestampGMT
    const startLocal: string | null = dto.sleepStartTimestampLocal ?? null
    const endLocal: string | null = dto.sleepEndTimestampLocal ?? null
    const levels: Array<{ startGMT: string; endGMT: string; activityLevel: number }> = obj.sleepLevels

    if (!startMs || !endMs || !Array.isArray(levels)) { res.json(EMPTY); return }

    const blockMs = (endMs - startMs) / 24
    const hypno: number[] = []
    for (let i = 0; i < 24; i++) {
      const midMs = startMs + (i + 0.5) * blockMs
      const seg = levels.find(s =>
        new Date(s.startGMT).getTime() <= midMs && midMs < new Date(s.endGMT).getTime()
      )
      const garminLevel = seg !== undefined ? seg.activityLevel : 3
      hypno.push(3 - garminLevel)
    }

    res.json({ hypno, startLocal, endLocal })
  } catch {
    res.json(EMPTY)
  }
})

// GET /api/garmin/activities/:id/legs — legs for a multisport activity
garminRouter.get('/activities/:id/legs', (req, res) => {
  const activityId = Number(req.params.id)
  if (!Number.isFinite(activityId)) {
    res.status(400).json({ error: 'Invalid activity ID' })
    return
  }
  const legs = db.prepare(
    `SELECT leg_id, activity_id, leg_index, type_key, start_time,
            duration_s, distance_m, calories, avg_hr, max_hr,
            aerobic_te, anaerobic_te, training_load, body_battery_diff,
            zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
            run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, run_power_w,
            row_stroke_rate, row_power_w, row_strokes
     FROM garmin_activity_legs WHERE activity_id = ? ORDER BY leg_index`
  ).all(activityId)
  res.json({ legs })
})

// GET /api/garmin/:metric — single metric, optional date range
garminRouter.get('/:metric', (req, res) => {
  const { metric } = req.params
  const { from, to } = req.query

  if (!VALID_METRICS.includes(metric)) {
    res.status(400).json({ error: `Unknown metric: ${metric}` })
    return
  }

  if (from && to) {
    const rows = db.prepare(
      'SELECT date, metric, value, unit FROM garmin_snapshots WHERE metric = ? AND date BETWEEN ? AND ? ORDER BY date'
    ).all(metric, from as string, to as string)
    res.json({ rows })
    return
  }

  // Latest available value for this metric — per-metric MAX(date), robust to
  // timezone (user is EST) and to metrics that arrive at different times.
  const row = db.prepare(
    'SELECT date, metric, value, unit FROM garmin_snapshots WHERE metric = ? ORDER BY date DESC LIMIT 1'
  ).get(metric) as { date: string; metric: string; value: number; unit: string } | undefined

  res.json(row ?? { metric, value: null, unit: null })
})

export default garminRouter
