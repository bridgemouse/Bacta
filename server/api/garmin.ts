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
  // Body battery
  'body_battery_max', 'body_battery_min',
  // SpO2 / respiration
  'spo2_avg', 'spo2_min', 'resp_avg', 'resp_max',
  // Training / readiness
  'recovery_score', 'training_status_n', 'training_load', 'training_load_min', 'training_load_max',
  // HRV
  'hrv_baseline_low', 'hrv_baseline_high',
  // Sleep extras
  'sleep_hr', 'sleep_stress',
  // Body battery
  'body_battery_current', 'body_battery_wake',
  // Fitness metrics
  'vo2max', 'fitness_age', 'endurance_score', 'hill_score',
  // Body composition / weight
  'weight_kg', 'bmi', 'body_fat_pct', 'muscle_mass_kg',
  // Blood pressure
  'bp_systolic', 'bp_diastolic',
  // Intensity
  'intensity_mod_min', 'intensity_vig_min',
  // Activities (legacy EAV — kept for backwards compat)
  'act_distance_m', 'act_duration_s', 'act_calories', 'act_avg_hr',
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
            distance_m, duration_s, calories, avg_hr, elevation_m
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

  const today = new Date().toISOString().slice(0, 10)
  const row = db.prepare(
    'SELECT date, metric, value, unit FROM garmin_snapshots WHERE metric = ? AND date = ?'
  ).get(metric, today) as { date: string; metric: string; value: number; unit: string } | undefined

  res.json(row ?? { metric, value: null, unit: null })
})

export default garminRouter
