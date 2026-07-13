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

  if (default_qty !== undefined && default_qty <= 0) {
    res.status(400).json({ error: 'default_qty must be greater than 0' })
    return
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

  for (const row of rows) {
    if (!meals[row.meal_type]) {
      meals[row.meal_type] = { entries: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } }
    }
    meals[row.meal_type].entries.push(row)
    for (const key of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const) {
      meals[row.meal_type].totals[key] += row[key] ?? 0
    }
  }

  // daily comes from the same logTotals() used by GET /summary, rather than a second
  // hand-duplicated summation — the two endpoints would otherwise be able to silently
  // disagree if one's null/edge-case handling changed without the other.
  res.json({ meals, daily: logTotals(date) })
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

    if (food_id !== undefined && food_id !== null) {
      const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(food_id) as FoodRow | undefined
      if (!food) {
        res.status(400).json({ error: 'food_id does not reference an existing food' })
        return
      }
      if (unit !== food.default_unit) {
        res.status(400).json({ error: `Unit mismatch — this food is logged in ${food.default_unit}` })
        return
      }
      if (food.default_qty <= 0) {
        // Defense in depth against pre-existing bad data — POST /foods rejects
        // default_qty <= 0 at write time, but a stale row would otherwise divide
        // by zero here and silently write Infinity/NaN into a REAL column.
        res.status(400).json({ error: 'Referenced food has an invalid default_qty' })
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

  // A food-linked entry's macros are a denormalized snapshot, not a live join — a
  // quantity or unit edit must rescale from the reference food, otherwise the stored
  // macros silently keep reflecting the old quantity/unit combination. Only macros NOT
  // explicitly overridden in this same request get rescaled — providing one corrected
  // macro must not freeze the other four at their now-stale values. Unit is validated
  // against the food's default_unit the same way POST does (no conversion in v1), since
  // an entry's unit must always match the food it's linked to, edit or not.
  if (existing.food_id != null) {
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(existing.food_id) as FoodRow | undefined
    if (food) {
      const finalUnit = (updates.unit ?? existing.unit) as string
      if (finalUnit !== food.default_unit) {
        res.status(400).json({ error: `Unit mismatch — this food is logged in ${food.default_unit}` })
        return
      }
      if (food.default_qty <= 0) {
        res.status(400).json({ error: 'Referenced food has an invalid default_qty' })
        return
      }
      if ('quantity' in updates || 'unit' in updates) {
        const finalQuantity = (updates.quantity ?? existing.quantity) as number
        const factor = finalQuantity / food.default_qty
        for (const key of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const) {
          if (!(key in updates)) {
            updates[key] = scale(food[key], factor)
          }
        }
      }
    }
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

interface RecipeIngredientInput {
  food_id?: number
  name: string
  quantity: number
  unit: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
}

function sumField(items: RecipeIngredientInput[], key: keyof RecipeIngredientInput): number {
  return items.reduce((s, i) => s + (Number(i[key]) || 0), 0)
}

// GET /api/nutrition/recipes — list saved recipes with their per-serving food's macros
nutritionRouter.get('/recipes', (req, res) => {
  const recipes = db.prepare(`
    SELECT r.id, r.name, r.servings, r.food_id, r.created_at,
      f.calories as per_serving_calories, f.protein_g as per_serving_protein_g,
      f.carbs_g as per_serving_carbs_g, f.fat_g as per_serving_fat_g, f.fiber_g as per_serving_fiber_g,
      (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) as ingredient_count
    FROM recipes r JOIN foods f ON f.id = r.food_id
    ORDER BY r.name
  `).all()
  res.json({ recipes })
})

// POST /api/nutrition/recipes — save a recipe: computes per-serving macros from ingredients,
// creates the materialized food + the recipe + its ingredient rows in one transaction (a
// recipe without its food, or vice versa, must never exist).
nutritionRouter.post('/recipes', (req, res) => {
  const { name, servings, ingredients } = req.body as {
    name: string
    servings: number
    ingredients: RecipeIngredientInput[]
  }

  if (!servings || servings <= 0) {
    res.status(400).json({ error: 'servings must be greater than 0' })
    return
  }
  if (!ingredients || ingredients.length === 0) {
    res.status(400).json({ error: 'A recipe needs at least one ingredient' })
    return
  }

  try {
    const kcalPerServing = Math.round(sumField(ingredients, 'calories') / servings)
    const proteinPerServing = Math.round((sumField(ingredients, 'protein_g') / servings) * 100) / 100
    const carbsPerServing = Math.round((sumField(ingredients, 'carbs_g') / servings) * 100) / 100
    const fatPerServing = Math.round((sumField(ingredients, 'fat_g') / servings) * 100) / 100
    const fiberPerServing = Math.round((sumField(ingredients, 'fiber_g') / servings) * 100) / 100

    const createRecipe = db.transaction(() => {
      const foodInfo = db.prepare(`
        INSERT INTO foods (source, name, default_qty, default_unit, calories, protein_g, carbs_g, fat_g, fiber_g)
        VALUES ('custom', ?, 1, 'serving', ?, ?, ?, ?, ?)
      `).run(name, kcalPerServing, proteinPerServing, carbsPerServing, fatPerServing, fiberPerServing)
      const foodId = foodInfo.lastInsertRowid

      const recipeInfo = db.prepare(
        'INSERT INTO recipes (name, servings, food_id) VALUES (?, ?, ?)'
      ).run(name, servings, foodId)
      const recipeId = recipeInfo.lastInsertRowid

      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (recipe_id, food_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const ing of ingredients) {
        insertIngredient.run(
          recipeId, ing.food_id ?? null, ing.name, ing.quantity, ing.unit,
          ing.calories ?? null, ing.protein_g ?? null, ing.carbs_g ?? null, ing.fat_g ?? null, ing.fiber_g ?? null,
        )
      }
      return { recipeId, foodId }
    })

    const { recipeId, foodId } = createRecipe()
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as object
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId)
    res.status(201).json({ ...recipe, food })
  } catch (err: unknown) {
    console.error('[nutrition] recipe save failed:', err)
    res.status(400).json({ error: 'Could not save recipe' })
  }
})

function isForeignKeyError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('FOREIGN KEY constraint failed')
}

// DELETE /api/nutrition/recipes/:id — deletes the recipe, its ingredients, and its
// materialized food as one unit. Blocked (400) if that food has already been logged
// elsewhere — food_log_entries keeps its own denormalized snapshot, but the food_id
// reference itself must stay valid, so the delete is refused rather than silently
// orphaning past log entries or leaving a half-deleted recipe.
nutritionRouter.delete('/recipes/:id', (req, res) => {
  const { id } = req.params
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as { food_id: number } | undefined
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  try {
    const deleteRecipe = db.transaction(() => {
      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id)
      db.prepare('DELETE FROM recipes WHERE id = ?').run(id)
      db.prepare('DELETE FROM foods WHERE id = ?').run(recipe.food_id)
    })
    deleteRecipe()
    res.json({ ok: true })
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      res.status(400).json({ error: 'Cannot delete — this recipe has already been logged' })
      return
    }
    console.error('[nutrition] recipe delete failed:', err)
    res.status(400).json({ error: 'Could not delete recipe' })
  }
})

// DELETE /api/nutrition/foods/:id — remove a saved food. Blocked (400) if the food has
// ever been logged or used as a recipe ingredient, for the same reason as recipe deletion
// above: those rows must keep a valid food_id reference.
nutritionRouter.delete('/foods/:id', (req, res) => {
  const { id } = req.params
  try {
    const info = db.prepare('DELETE FROM foods WHERE id = ?').run(id)
    if (info.changes === 0) {
      res.status(404).json({ error: 'Food not found' })
      return
    }
    res.json({ ok: true })
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      res.status(400).json({ error: 'Cannot delete — this food has been logged or used in a recipe' })
      return
    }
    console.error('[nutrition] food delete failed:', err)
    res.status(400).json({ error: 'Could not delete food' })
  }
})

// food_log_entries.date is the user's local calendar day (same convention as
// health_activities.date — see orchestrator.ts's toLocaleDateString('en-CA') use for
// same-day activity lookups). SQLite's date('now', ...) is always UTC regardless of
// process TZ, so computing the window boundary that way would put the trend a full day
// ahead of the user's actual "today" in the evening EST hours (past UTC midnight).
// Exported for direct unit testing without needing to fake the global clock/timers.
export function localDateString(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

// GET /api/nutrition/trend?days=N — N-day daily-total history, zero-filled for empty days
nutritionRouter.get('/trend', (req, res) => {
  const days = Math.min(Math.max(1, Number(req.query.days) || 7), 30)
  const now = new Date()
  const dayLabel = (i: number): string => localDateString(new Date(now.getTime() - i * 86400000))

  const rows = db.prepare(`
    SELECT date,
      COALESCE(SUM(calories), 0)  as calories,
      COALESCE(SUM(protein_g), 0) as protein_g,
      COALESCE(SUM(carbs_g), 0)   as carbs_g,
      COALESCE(SUM(fat_g), 0)     as fat_g,
      COALESCE(SUM(fiber_g), 0)   as fiber_g
    FROM food_log_entries
    WHERE date >= ?
    GROUP BY date
  `).all(dayLabel(days - 1)) as Array<{
    date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number
  }>

  const byDate = new Map(rows.map(r => [r.date, r]))
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const date = dayLabel(i)
    result.push(byDate.get(date) ?? { date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 })
  }

  res.json({ days: result })
})

export default nutritionRouter
