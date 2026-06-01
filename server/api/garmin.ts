import { Router } from 'express'
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
  // Activities
  'act_distance_m', 'act_duration_s', 'act_calories', 'act_avg_hr',
]

// GET /api/garmin/summary — today's key metrics as a flat object
garminRouter.get('/summary', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const rows = db.prepare(
    'SELECT metric, value FROM garmin_snapshots WHERE date = ?'
  ).all(today) as Array<{ metric: string; value: number }>

  const summary: Record<string, number> = {}
  for (const row of rows) {
    summary[row.metric] = row.value
  }
  res.json(summary)
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

  if (!row) {
    res.json({ metric, value: null, unit: null })
    return
  }

  res.json(row)
})

export default garminRouter
