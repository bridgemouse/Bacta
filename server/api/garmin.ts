import { Router } from 'express'
import db from '../db/client'

const garminRouter = Router()

const VALID_METRICS = [
  'steps', 'hrv', 'body_battery', 'resting_hr',
  'sleep_duration', 'recovery_score', 'stress_score', 'vo2max',
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
