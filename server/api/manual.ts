import { Router } from 'express'
import db from '../db/client'

const router = Router()

router.get('/today', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const entry = db.prepare(
    'SELECT * FROM manual_inputs WHERE date = ?'
  ).get(today) ?? null
  res.json({ entry })
})

router.post('/', (req, res) => {
  const { date, readiness, caffeine_mg, supplements } = req.body

  if (readiness !== undefined && (readiness < 1 || readiness > 5)) {
    return res.status(400).json({ error: 'readiness must be 1–5' })
  }

  try {
    const result = db.prepare(`
      INSERT INTO manual_inputs (date, readiness, caffeine_mg, supplements)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        readiness = excluded.readiness,
        caffeine_mg = excluded.caffeine_mg,
        supplements = excluded.supplements
    `).run(
      date ?? new Date().toISOString().slice(0, 10),
      readiness ?? null,
      caffeine_mg ?? null,
      supplements ? JSON.stringify(supplements) : null
    )
    const entry = db.prepare('SELECT * FROM manual_inputs WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(entry)
  } catch (err) {
    res.status(500).json({ error: 'db error' })
  }
})

export default router
