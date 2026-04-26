import { Router } from 'express'
import db from '../db/client'

const router = Router()

const SUMMARY_METRICS = [
  'steps', 'hrv', 'body_battery', 'resting_hr',
  'sleep_duration', 'recovery_score', 'stress_score', 'vo2max'
]

router.get('/summary', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const rows = db.prepare(
    'SELECT metric, value, unit FROM garmin_snapshots WHERE date = ? AND metric IN (' +
    SUMMARY_METRICS.map(() => '?').join(',') + ')'
  ).all(today, ...SUMMARY_METRICS) as { metric: string; value: number; unit: string }[]

  const summary: Record<string, number> = {}
  for (const row of rows) summary[row.metric] = row.value

  res.json(summary)
})

router.get('/:metric', (req, res) => {
  const { metric } = req.params
  const { from, to } = req.query as { from?: string; to?: string }
  const today = new Date().toISOString().slice(0, 10)

  if (from && to) {
    const rows = db.prepare(
      'SELECT date, metric, value, unit FROM garmin_snapshots WHERE metric = ? AND date BETWEEN ? AND ? ORDER BY date ASC'
    ).all(metric, from, to)
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'no data' })
    }
    return res.json({ metric, rows })
  }

  const row = db.prepare(
    'SELECT date, metric, value, unit FROM garmin_snapshots WHERE metric = ? AND date = ?'
  ).get(metric, today)

  if (!row) return res.status(404).json({ error: 'no data' })
  res.json(row)
})

export default router
