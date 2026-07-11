import { Router } from 'express'
import db from '../db/client'

const nutritionRouter = Router()

// GET /api/nutrition/foods?q= — search reference foods by name (includes custom foods)
nutritionRouter.get('/foods', (req, res) => {
  const q = (req.query.q as string | undefined) ?? ''
  const rows = db.prepare(
    'SELECT * FROM foods WHERE name LIKE ? ORDER BY name'
  ).all(`%${q}%`)
  res.json({ foods: rows })
})

// POST /api/nutrition/foods — save a new custom/ad-hoc food for reuse
nutritionRouter.post('/foods', (req, res) => {
  const { name, brand, default_qty, default_unit, calories, protein_g, carbs_g, fat_g, fiber_g } = req.body as {
    name: string
    brand?: string
    default_qty?: number
    default_unit?: string
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    fiber_g?: number
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO foods (source, name, brand, default_qty, default_unit, calories, protein_g, carbs_g, fat_g, fiber_g)
      VALUES ('custom', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const info = stmt.run(
      name,
      brand ?? null,
      default_qty ?? 100,
      default_unit ?? 'g',
      calories ?? null,
      protein_g ?? null,
      carbs_g ?? null,
      fat_g ?? null,
      fiber_g ?? null,
    )
    const row = db.prepare('SELECT * FROM foods WHERE id = ?').get(info.lastInsertRowid)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[nutrition] custom food save failed:', err)
    res.status(400).json({ error: 'Could not save custom food' })
  }
})

export default nutritionRouter
