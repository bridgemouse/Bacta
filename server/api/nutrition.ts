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

interface FoodRow {
  id: number
  name: string
  default_qty: number
  default_unit: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
}

function scale(value: number | null, factor: number): number | null {
  return value === null ? null : Math.round(value * factor * 100) / 100
}

// GET /api/nutrition/log?date= — a day's logged entries grouped by meal, with totals
nutritionRouter.get('/log', (req, res) => {
  const date = req.query.date as string
  const rows = db.prepare(
    'SELECT * FROM food_log_entries WHERE date = ? ORDER BY logged_at'
  ).all(date) as Array<{
    id: number
    meal_type: string
    calories: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
    fiber_g: number | null
  }>

  const meals: Record<string, { entries: typeof rows; totals: Record<string, number> }> = {}
  const daily = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }

  for (const row of rows) {
    if (!meals[row.meal_type]) {
      meals[row.meal_type] = { entries: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } }
    }
    meals[row.meal_type].entries.push(row)
    for (const key of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const) {
      const value = row[key] ?? 0
      meals[row.meal_type].totals[key] += value
      daily[key] += value
    }
  }

  res.json({ meals, daily })
})

// POST /api/nutrition/log — log a new entry, either against a reference food (scaled) or fully ad-hoc
nutritionRouter.post('/log', (req, res) => {
  const { date, meal_type, food_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g } = req.body as {
    date: string
    meal_type: string
    food_id?: number
    name?: string
    quantity: number
    unit: string
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    fiber_g?: number
  }

  try {
    let entry: {
      name: string
      calories: number | null
      protein_g: number | null
      carbs_g: number | null
      fat_g: number | null
      fiber_g: number | null
    }

    if (food_id !== undefined) {
      const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(food_id) as FoodRow | undefined
      if (!food) {
        res.status(400).json({ error: 'food_id does not reference an existing food' })
        return
      }
      if (unit !== food.default_unit) {
        res.status(400).json({ error: `Unit mismatch — this food is logged in ${food.default_unit}` })
        return
      }
      const factor = quantity / food.default_qty
      entry = {
        name: food.name,
        calories: scale(food.calories, factor),
        protein_g: scale(food.protein_g, factor),
        carbs_g: scale(food.carbs_g, factor),
        fat_g: scale(food.fat_g, factor),
        fiber_g: scale(food.fiber_g, factor),
      }
    } else {
      entry = {
        name: name ?? '',
        calories: calories ?? null,
        protein_g: protein_g ?? null,
        carbs_g: carbs_g ?? null,
        fat_g: fat_g ?? null,
        fiber_g: fiber_g ?? null,
      }
    }

    const stmt = db.prepare(`
      INSERT INTO food_log_entries (date, meal_type, food_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const info = stmt.run(
      date, meal_type, food_id ?? null, entry.name, quantity, unit,
      entry.calories, entry.protein_g, entry.carbs_g, entry.fat_g, entry.fiber_g,
    )
    const row = db.prepare('SELECT * FROM food_log_entries WHERE id = ?').get(info.lastInsertRowid)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[nutrition] log entry save failed:', err)
    res.status(400).json({ error: 'Could not save log entry' })
  }
})

// PUT /api/nutrition/log/:id — edit a logged entry
nutritionRouter.put('/log/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM food_log_entries WHERE id = ?').get(id) as
    Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ error: 'Log entry not found' })
    return
  }

  const editable = ['date', 'meal_type', 'name', 'quantity', 'unit', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const
  const updates: Record<string, unknown> = {}
  for (const key of editable) {
    if (key in req.body) updates[key] = req.body[key]
  }

  const merged = { ...existing, ...updates }
  db.prepare(`
    UPDATE food_log_entries SET
      date = ?, meal_type = ?, name = ?, quantity = ?, unit = ?,
      calories = ?, protein_g = ?, carbs_g = ?, fat_g = ?, fiber_g = ?
    WHERE id = ?
  `).run(
    merged.date, merged.meal_type, merged.name, merged.quantity, merged.unit,
    merged.calories, merged.protein_g, merged.carbs_g, merged.fat_g, merged.fiber_g, id,
  )

  const row = db.prepare('SELECT * FROM food_log_entries WHERE id = ?').get(id)
  res.json(row)
})

// DELETE /api/nutrition/log/:id — delete a logged entry
nutritionRouter.delete('/log/:id', (req, res) => {
  const { id } = req.params
  const info = db.prepare('DELETE FROM food_log_entries WHERE id = ?').run(id)
  if (info.changes === 0) {
    res.status(404).json({ error: 'Log entry not found' })
    return
  }
  res.json({ ok: true })
})

interface TargetRow {
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
}

function resolveTarget(date: string): (TargetRow & { date: string }) | null {
  return (db.prepare(
    'SELECT * FROM nutrition_targets WHERE date <= ? ORDER BY date DESC LIMIT 1'
  ).get(date) as (TargetRow & { date: string }) | undefined) ?? null
}

function logTotals(date: string): TargetRow {
  const rows = db.prepare(
    'SELECT calories, protein_g, carbs_g, fat_g, fiber_g FROM food_log_entries WHERE date = ?'
  ).all(date) as TargetRow[]

  const totals: TargetRow = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  for (const row of rows) {
    for (const key of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const) {
      totals[key] = (totals[key] ?? 0) + (row[key] ?? 0)
    }
  }
  return totals
}

// GET /api/nutrition/targets?date= — the effective target set for a date
nutritionRouter.get('/targets', (req, res) => {
  const date = req.query.date as string
  const target = resolveTarget(date)
  res.json(target)
})

// POST /api/nutrition/targets — upsert a target set effective from a given date
nutritionRouter.post('/targets', (req, res) => {
  const { date, calories, protein_g, carbs_g, fat_g, fiber_g } = req.body as {
    date: string
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    fiber_g?: number
  }

  try {
    db.prepare(`
      INSERT INTO nutrition_targets (date, calories, protein_g, carbs_g, fat_g, fiber_g)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        calories  = excluded.calories,
        protein_g = excluded.protein_g,
        carbs_g   = excluded.carbs_g,
        fat_g     = excluded.fat_g,
        fiber_g   = excluded.fiber_g
    `).run(date, calories ?? null, protein_g ?? null, carbs_g ?? null, fat_g ?? null, fiber_g ?? null)
    const row = db.prepare('SELECT * FROM nutrition_targets WHERE date = ?').get(date)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[nutrition] target upsert failed:', err)
    res.status(400).json({ error: 'Could not save nutrition targets' })
  }
})

// GET /api/nutrition/summary?date= — target-vs-actual for one day
nutritionRouter.get('/summary', (req, res) => {
  const date = req.query.date as string
  const target = resolveTarget(date)
  const actual = logTotals(date)

  const remaining: TargetRow = { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null }
  for (const key of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const) {
    remaining[key] = target?.[key] != null && actual[key] != null
      ? Math.round((target[key]! - actual[key]!) * 100) / 100
      : null
  }

  res.json({ target, actual, remaining })
})

export default nutritionRouter
