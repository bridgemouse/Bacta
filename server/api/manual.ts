import { Router } from 'express'
import db from '../db/client'

const manualRouter = Router()

// GET /api/manual/today — fetch today's manual input entry
manualRouter.get('/today', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const entry = db.prepare(
    'SELECT * FROM manual_inputs WHERE date = ?'
  ).get(today) ?? null
  res.json({ entry })
})

// POST /api/manual — upsert a manual input entry
manualRouter.post('/', (req, res) => {
  const { date, readiness, caffeine_mg, supplements } = req.body as {
    date: string
    readiness?: number
    caffeine_mg?: number
    supplements?: string[]
  }

  if (readiness !== undefined && (readiness < 1 || readiness > 5)) {
    res.status(400).json({ error: 'readiness must be between 1 and 5' })
    return
  }

  const supplementsJson = supplements ? JSON.stringify(supplements) : null

  try {
    const stmt = db.prepare(`
      INSERT INTO manual_inputs (date, readiness, caffeine_mg, supplements)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        readiness   = excluded.readiness,
        caffeine_mg = excluded.caffeine_mg,
        supplements = excluded.supplements
    `)
    stmt.run(date, readiness ?? null, caffeine_mg ?? null, supplementsJson)
    const row = db.prepare('SELECT * FROM manual_inputs WHERE date = ?').get(date)
    res.status(201).json(row)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error'
    res.status(400).json({ error: message })
  }
})

export default manualRouter
