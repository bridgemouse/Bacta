import { Router } from 'express'
import db from '../db/client'

const bloodworkRouter = Router()

// GET /api/bloodwork — list all blood work entries
bloodworkRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM blood_work ORDER BY date DESC').all()
  res.json({ rows })
})

// POST /api/bloodwork — add a blood work entry
bloodworkRouter.post('/', (req, res) => {
  const { date, marker, value, unit, reference_range, source_file } = req.body as {
    date: string
    marker: string
    value?: number
    unit?: string
    reference_range?: string
    source_file?: string
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO blood_work (date, marker, value, unit, reference_range, source_file)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, marker) DO UPDATE SET
        value           = excluded.value,
        unit            = excluded.unit,
        reference_range = excluded.reference_range,
        source_file     = excluded.source_file
    `)
    stmt.run(date, marker, value ?? null, unit ?? null, reference_range ?? null, source_file ?? null)
    const row = db.prepare('SELECT * FROM blood_work WHERE date = ? AND marker = ?').get(date, marker)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[bloodwork] write failed:', err)
    res.status(400).json({ error: 'Could not save blood work entry' })
  }
})

export default bloodworkRouter
