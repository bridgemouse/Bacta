import { Router, type Response } from 'express'
import db from '../db/client'
import { estimateMealFromPhoto } from '../lib/ai/mealPhoto'
import { NUMERIC_NUTRIENT_KEYS, JSON_NUTRIENT_KEYS, DESCRIPTIVE_NUTRIENT_KEYS, type NumericNutrientKey, type NumericRow } from '../lib/nutrition/nutrientKeys'
import { logEvent } from '../lib/logger'

const nutritionRouter = Router()

function parseJsonField(value: unknown): unknown {
  return value === undefined || value === null ? null : JSON.stringify(value)
}

function errorDetail(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

// POST /api/nutrition/scan/meal-photo — still-image meal recognition (#141). Returns a
// proposed macro estimate only; NEVER writes to food_log_entries itself. The client must
// show the estimate for the user to review/edit and log through the normal POST /log
// flow, same as any other ad-hoc entry — satisfies "never auto-logged without confirmation."
nutritionRouter.post('/scan/meal-photo', async (req, res) => {
  const { image, mediaType } = req.body as { image?: string; mediaType?: string }
  if (!image || !mediaType) {
    res.status(400).json({ error: 'image and mediaType are required' })
    return
  }
  const result = await estimateMealFromPhoto(image, mediaType)
  if ('error' in result) {
    res.status(400).json({ error: result.error })
    return
  }
  res.json(result)
})

interface VariantInput extends NumericRow {
  label: string
  serving_qty: number
  serving_unit: string
  gram_weight?: number | null
  glycemic_index?: string
  custom_nutrients?: unknown
  allergens?: unknown
  traces?: unknown
}

interface FoodBody {
  name: string
  brand?: string
  variant: VariantInput
}

const variantCols = [...NUMERIC_NUTRIENT_KEYS, ...DESCRIPTIVE_NUTRIENT_KEYS] as const

function insertVariant(foodId: number, v: VariantInput, isDefault: boolean, source: string): number | bigint {
  const info = db.prepare(`
    INSERT INTO food_variants (
      food_id, label, serving_qty, serving_unit, gram_weight, is_default, source,
      ${variantCols.join(', ')}
    )
    VALUES (
      @food_id, @label, @serving_qty, @serving_unit, @gram_weight, @is_default, @source,
      ${variantCols.map(k => '@' + k).join(', ')}
    )
  `).run({
    food_id: foodId, label: v.label, serving_qty: v.serving_qty, serving_unit: v.serving_unit,
    gram_weight: v.gram_weight ?? null, is_default: isDefault ? 1 : 0, source,
    ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, v[k] ?? null])),
    glycemic_index: v.glycemic_index ?? null,
    custom_nutrients: parseJsonField(v.custom_nutrients),
    allergens: parseJsonField(v.allergens),
    traces: parseJsonField(v.traces),
  })
  return info.lastInsertRowid
}

function foodWithVariants(foodId: number): unknown {
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId)
  if (!food) return null
  const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ? ORDER BY is_default DESC, id').all(foodId)
  return { ...(food as object), variants }
}

function isForeignKeyError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('FOREIGN KEY constraint failed')
}

// GET /api/nutrition/foods/barcode/:code — look up a food by barcode (#141). Registered
// before the generic GET /foods so it isn't shadowed.
nutritionRouter.get('/foods/barcode/:code', (req, res) => {
  const { code } = req.params
  const food = db.prepare(
    "SELECT * FROM foods WHERE source_id = ? AND source = 'openfoodfacts'"
  ).get(code) as { id: number } | undefined
  if (!food) {
    res.status(404).json({ error: 'No food matches this barcode' })
    return
  }
  res.json(foodWithVariants(food.id))
})

// GET /api/nutrition/foods?q= — search reference foods by name, each with its variants nested
nutritionRouter.get('/foods', (req, res) => {
  const q = (req.query.q as string | undefined) ?? ''
  const foods = db.prepare('SELECT * FROM foods WHERE name LIKE ? ORDER BY name').all(`%${q}%`) as Array<{ id: number }>
  const withVariants = foods.map(f => foodWithVariants(f.id))
  res.json({ foods: withVariants })
})

// POST /api/nutrition/foods — save a new custom/ad-hoc food + its first (default) variant,
// in one transaction (a food with zero variants is an invalid state — see schema.sql).
nutritionRouter.post('/foods', (req, res) => {
  const body = req.body as FoodBody
  const { name, brand, variant } = body

  if (!variant || !(variant.serving_qty > 0)) {
    res.status(400).json({ error: 'variant.serving_qty must be greater than 0' })
    return
  }

  try {
    const createFood = db.transaction(() => {
      const foodInfo = db.prepare('INSERT INTO foods (source, name, brand) VALUES (\'custom\', ?, ?)').run(name, brand ?? null)
      insertVariant(foodInfo.lastInsertRowid as number, variant, true, 'custom')
      return foodInfo.lastInsertRowid as number
    })
    const foodId = createFood()
    res.status(201).json(foodWithVariants(foodId))
  } catch (err: unknown) {
    console.error('[nutrition] custom food save failed:', err)
    logEvent('nutrition', 'error', 'custom food save failed: ' + errorDetail(err))
    res.status(400).json({ error: 'Could not save custom food' })
  }
})

// POST /api/nutrition/foods/:id/variants — add another serving size to an existing food
// (USDA-sourced or custom). Never marks the new variant is_default.
nutritionRouter.post('/foods/:id/variants', (req, res) => {
  const { id } = req.params
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(id) as { id: number; source: string } | undefined
  if (!food) {
    res.status(404).json({ error: 'Food not found' })
    return
  }
  const variant = req.body as VariantInput
  if (!(variant.serving_qty > 0)) {
    res.status(400).json({ error: 'serving_qty must be greater than 0' })
    return
  }
  try {
    const variantId = insertVariant(food.id, variant, false, food.source)
    const row = db.prepare('SELECT * FROM food_variants WHERE id = ?').get(variantId)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[nutrition] add variant failed:', err)
    logEvent('nutrition', 'error', 'add variant failed: ' + errorDetail(err))
    res.status(400).json({ error: 'Could not add variant' })
  }
})

// GET /api/nutrition/foods/:id/variants — a food's variant list, for the Edit Entry
// sheet's "switch serving" dropdown (it only has the linked variant's id, not the food's
// full list of servings).
nutritionRouter.get('/foods/:id/variants', (req, res) => {
  const { id } = req.params
  const food = db.prepare('SELECT id FROM foods WHERE id = ?').get(id)
  if (!food) {
    res.status(404).json({ error: 'Food not found' })
    return
  }
  const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ? ORDER BY is_default DESC, id').all(id)
  res.json({ variants })
})

// DELETE /api/nutrition/food_variants/:id — remove a serving size. Blocked (400) if it's
// the food's last remaining variant (a food must always have at least one — see
// schema.sql's comment on food_variants) or if food_log_entries/recipe_ingredients rows
// still reference it.
nutritionRouter.delete('/food_variants/:id', (req, res) => {
  const { id } = req.params
  const variant = db.prepare('SELECT * FROM food_variants WHERE id = ?').get(id) as { food_id: number } | undefined
  if (!variant) {
    res.status(404).json({ error: 'Variant not found' })
    return
  }
  const remaining = db.prepare('SELECT COUNT(*) as n FROM food_variants WHERE food_id = ?').get(variant.food_id) as { n: number }
  if (remaining.n <= 1) {
    res.status(400).json({ error: 'A food must have at least one serving — delete the food itself instead' })
    return
  }
  try {
    db.prepare('DELETE FROM food_variants WHERE id = ?').run(id)
    res.json({ ok: true })
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      res.status(400).json({ error: 'Cannot delete — this variant has been logged or used in a recipe' })
      return
    }
    console.error('[nutrition] variant delete failed:', err)
    logEvent('nutrition', 'error', 'variant delete failed: ' + errorDetail(err))
    res.status(400).json({ error: 'Could not delete variant' })
  }
})

// DELETE /api/nutrition/foods/:id — remove a saved food and all its variants. Blocked
// (400) if any variant has ever been logged or used as a recipe ingredient.
nutritionRouter.delete('/foods/:id', (req, res) => {
  const { id } = req.params
  try {
    const deleteFood = db.transaction(() => {
      db.prepare('DELETE FROM food_variants WHERE food_id = ?').run(id)
      return db.prepare('DELETE FROM foods WHERE id = ?').run(id)
    })
    const info = deleteFood()
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
    logEvent('nutrition', 'error', 'food delete failed: ' + errorDetail(err))
    res.status(400).json({ error: 'Could not delete food' })
  }
})

function scale(value: number | null, factor: number): number | null {
  return value === null ? null : Math.round(value * factor * 100) / 100
}

function roundKcal(value: number): number {
  return Math.round(value)
}

function roundMacro(value: number): number {
  return Math.round(value * 100) / 100
}

// GET /api/nutrition/log?date= — a day's logged entries grouped by meal, with totals
nutritionRouter.get('/log', (req, res) => {
  const date = req.query.date as string
  const rows = db.prepare(
    'SELECT fle.*, fv.food_id as food_id, fv.label as variant_label FROM food_log_entries fle LEFT JOIN food_variants fv ON fv.id = fle.variant_id WHERE fle.date = ? ORDER BY fle.logged_at'
  ).all(date) as Array<{ id: number; meal_type: string; food_id: number | null; variant_label: string | null } & NumericRow>

  const emptyTotals = (): Record<string, number> => Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, 0]))
  const meals: Record<string, { entries: typeof rows; totals: Record<string, number> }> = {}

  for (const row of rows) {
    if (!meals[row.meal_type]) {
      meals[row.meal_type] = { entries: [], totals: emptyTotals() }
    }
    meals[row.meal_type].entries.push(row)
    for (const key of NUMERIC_NUTRIENT_KEYS) {
      meals[row.meal_type].totals[key] += row[key] ?? 0
    }
  }

  // daily comes from the same logTotals() used by GET /summary, rather than a second
  // hand-duplicated summation — the two endpoints would otherwise be able to silently
  // disagree if one's null/edge-case handling changed without the other.
  res.json({ meals, daily: logTotals(date) })
})

// GET /api/nutrition/log/recent?limit=N — most recent distinct (name+unit) log entries,
// newest first, for the Log Entry sheet's RECENT list. Dedup keeps only each name+unit
// combination's most recent row — a corrected quantity/macro re-log should surface its
// latest state, not a stale older log of the same food.
nutritionRouter.get('/log/recent', (req, res) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 4), 20)
  const rows = db.prepare(
    'SELECT fle.*, fv.food_id as food_id FROM food_log_entries fle LEFT JOIN food_variants fv ON fv.id = fle.variant_id ORDER BY fle.logged_at DESC, fle.id DESC LIMIT 200'
  ).all() as Array<{ name: string; unit: string; food_id: number | null }>

  const seen = new Set<string>()
  const entries: typeof rows = []
  for (const row of rows) {
    const key = `${row.name}::${row.unit}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push(row)
    if (entries.length >= limit) break
  }
  res.json({ entries })
})

interface LogEntryBody extends NumericRow {
  date: string
  meal_type: string
  variant_id?: number
  name?: string
  quantity: number
  unit?: string
  glycemic_index?: string
  custom_nutrients?: unknown
  allergens?: unknown
  traces?: unknown
}

interface VariantRow extends NumericRow {
  id: number
  food_id: number
  label: string
  serving_unit: string
  glycemic_index: string | null
  custom_nutrients: string | null
  allergens: string | null
  traces: string | null
}

// POST /api/nutrition/log — log a new entry, either against a variant (quantity = count
// of that variant's serving) or fully ad-hoc.
nutritionRouter.post('/log', (req, res) => {
  const body = req.body as LogEntryBody
  const { date, meal_type, variant_id, name, quantity } = body

  if (!(quantity > 0)) {
    res.status(400).json({ error: 'quantity must be greater than 0' })
    return
  }

  try {
    let unit: string
    let entry: { name: string } & NumericRow & { glycemic_index: string | null; custom_nutrients: unknown; allergens: unknown; traces: unknown }

    if (variant_id !== undefined && variant_id !== null) {
      const variant = db.prepare('SELECT fv.*, f.name as food_name FROM food_variants fv JOIN foods f ON f.id = fv.food_id WHERE fv.id = ?')
        .get(variant_id) as (VariantRow & { food_name: string }) | undefined
      if (!variant) {
        res.status(400).json({ error: 'variant_id does not reference an existing variant' })
        return
      }
      unit = variant.serving_unit
      entry = {
        name: variant.food_name,
        ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, scale(variant[k] ?? null, quantity)])),
        glycemic_index: variant.glycemic_index ?? null,
        custom_nutrients: variant.custom_nutrients ?? null,
        allergens: variant.allergens ?? null,
        traces: variant.traces ?? null,
      }
    } else {
      unit = body.unit ?? ''
      entry = {
        name: name ?? '',
        ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, body[k] ?? null])),
        glycemic_index: body.glycemic_index ?? null,
        custom_nutrients: parseJsonField(body.custom_nutrients),
        allergens: parseJsonField(body.allergens),
        traces: parseJsonField(body.traces),
      }
    }

    const stmt = db.prepare(`
      INSERT INTO food_log_entries (
        date, meal_type, variant_id, name, quantity, unit,
        ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
      )
      VALUES (
        @date, @meal_type, @variant_id, @name, @quantity, @unit,
        ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')}, @glycemic_index, @custom_nutrients, @allergens, @traces
      )
    `)
    const info = stmt.run({ date, meal_type, variant_id: variant_id ?? null, quantity, unit, ...entry })
    const row = db.prepare('SELECT * FROM food_log_entries WHERE id = ?').get(info.lastInsertRowid)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[nutrition] log entry save failed:', err)
    logEvent('nutrition', 'error', 'log entry save failed: ' + errorDetail(err))
    res.status(400).json({ error: 'Could not save log entry' })
  }
})

// PUT /api/nutrition/log/:id — edit a logged entry. Rescales from the entry's OWN prior
// quantity/macros (not a live variant re-read) for the same reason as before PUT already
// did this: the referenced variant can itself have changed since this entry was logged.
nutritionRouter.put('/log/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM food_log_entries WHERE id = ?').get(id) as
    Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ error: 'Log entry not found' })
    return
  }

  const editable = ['date', 'meal_type', 'name', 'quantity', 'unit', ...NUMERIC_NUTRIENT_KEYS, ...DESCRIPTIVE_NUTRIENT_KEYS] as const
  const updates: Record<string, unknown> = {}
  for (const key of editable) {
    if (key in req.body) {
      updates[key] = (JSON_NUTRIENT_KEYS as readonly string[]).includes(key) ? parseJsonField(req.body[key]) : req.body[key]
    }
  }

  // Switching to a different serving of the same food (Edit Entry sheet's variant
  // dropdown) — re-derive unit/name/macros from the NEW variant's own base values times
  // the final quantity, the same way POST /log does for a brand-new entry. A quantity-only
  // change (variant_id unchanged) still rescales from the entry's OWN prior macros below,
  // since the referenced variant can itself have changed since this entry was logged.
  const variantIdProvided = 'variant_id' in req.body
  const newVariantId = variantIdProvided ? (req.body.variant_id as number | null) : undefined
  const switchingVariant = variantIdProvided && newVariantId !== existing.variant_id

  if (switchingVariant && newVariantId != null) {
    const variant = db.prepare('SELECT fv.*, f.name as food_name FROM food_variants fv JOIN foods f ON f.id = fv.food_id WHERE fv.id = ?')
      .get(newVariantId) as (VariantRow & { food_name: string }) | undefined
    if (!variant) {
      res.status(400).json({ error: 'variant_id does not reference an existing variant' })
      return
    }
    const finalQuantity = (updates.quantity as number | undefined) ?? (existing.quantity as number)
    if (!(finalQuantity > 0)) {
      res.status(400).json({ error: 'quantity must be greater than 0' })
      return
    }
    updates.variant_id = newVariantId
    if (!('name' in updates)) updates.name = variant.food_name
    if (!('unit' in updates)) updates.unit = variant.serving_unit
    for (const key of NUMERIC_NUTRIENT_KEYS) {
      if (!(key in updates)) updates[key] = scale(variant[key] ?? null, finalQuantity)
    }
    for (const key of DESCRIPTIVE_NUTRIENT_KEYS) {
      if (!(key in updates)) updates[key] = variant[key] ?? null
    }
  } else if (switchingVariant) {
    updates.variant_id = null
  }

  if (!switchingVariant && existing.variant_id != null && 'quantity' in updates) {
    const finalQuantity = updates.quantity as number
    if (finalQuantity <= 0) {
      res.status(400).json({ error: 'quantity must be greater than 0' })
      return
    }
    const existingQuantity = existing.quantity as number
    if (existingQuantity <= 0) {
      res.status(400).json({ error: 'Log entry has an invalid stored quantity' })
      return
    }
    const factor = finalQuantity / existingQuantity
    for (const key of NUMERIC_NUTRIENT_KEYS) {
      if (!(key in updates)) {
        updates[key] = scale((existing[key] as number | null) ?? null, factor)
      }
    }
  }

  const merged = { ...existing, ...updates }
  db.prepare(`
    UPDATE food_log_entries SET
      date = @date, meal_type = @meal_type, name = @name, quantity = @quantity, unit = @unit, variant_id = @variant_id,
      ${NUMERIC_NUTRIENT_KEYS.map(k => `${k} = @${k}`).join(', ')},
      glycemic_index = @glycemic_index, custom_nutrients = @custom_nutrients, allergens = @allergens, traces = @traces
    WHERE id = @id
  `).run({ ...merged, id })

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

type TargetRow = NumericRow

function resolveTarget(date: string): (TargetRow & { date: string }) | null {
  return (db.prepare(
    'SELECT * FROM nutrition_targets WHERE date <= ? ORDER BY date DESC LIMIT 1'
  ).get(date) as (TargetRow & { date: string }) | undefined) ?? null
}

function logTotals(date: string): TargetRow {
  const rows = db.prepare(
    `SELECT ${NUMERIC_NUTRIENT_KEYS.join(', ')} FROM food_log_entries WHERE date = ?`
  ).all(date) as TargetRow[]

  const totals: TargetRow = Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, 0]))
  for (const row of rows) {
    for (const key of NUMERIC_NUTRIENT_KEYS) {
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

// POST /api/nutrition/targets — upsert a target set effective from a given date. Only
// the numeric fields participate — glycemic_index/custom_nutrients/allergens/traces
// describe a food, not a daily target, so the targets API never reads/writes them (the
// schema columns exist for uniformity across the 4 nutrient tables, per #140, but stay
// unused here).
nutritionRouter.post('/targets', (req, res) => {
  const body = req.body as { date: string } & NumericRow
  const { date } = body

  try {
    db.prepare(`
      INSERT INTO nutrition_targets (date, ${NUMERIC_NUTRIENT_KEYS.join(', ')})
      VALUES (@date, ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')})
      ON CONFLICT(date) DO UPDATE SET
        ${NUMERIC_NUTRIENT_KEYS.map(k => `${k} = excluded.${k}`).join(',\n        ')}
    `).run({ date, ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, body[k] ?? null])) })
    const row = db.prepare('SELECT * FROM nutrition_targets WHERE date = ?').get(date)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[nutrition] target upsert failed:', err)
    logEvent('nutrition', 'error', 'target upsert failed: ' + errorDetail(err))
    res.status(400).json({ error: 'Could not save nutrition targets' })
  }
})

// GET /api/nutrition/summary?date= — target-vs-actual for one day
nutritionRouter.get('/summary', (req, res) => {
  const date = req.query.date as string
  const target = resolveTarget(date)
  const actual = logTotals(date)

  const remaining: TargetRow = Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, null]))
  for (const key of NUMERIC_NUTRIENT_KEYS) {
    remaining[key] = target?.[key] != null && actual[key] != null
      ? Math.round((target[key]! - actual[key]!) * 100) / 100
      : null
  }

  res.json({ target, actual, remaining })
})

interface RecipeIngredientInput extends NumericRow {
  variant_id?: number
  name: string
  quantity: number
  unit: string
  glycemic_index?: string
  custom_nutrients?: unknown
  allergens?: unknown
  traces?: unknown
}

function sumField(items: RecipeIngredientInput[], key: NumericNutrientKey): number {
  return items.reduce((s, i) => s + (Number(i[key]) || 0), 0)
}

// Per-serving macros for a recipe's materialized food. Only the summable numeric fields
// participate — glycemic_index/custom_nutrients/allergens/traces have no sensible
// "sum of ingredients" and stay null on the materialized food (see DESCRIPTIVE_NUTRIENT_KEYS).
function perServingNutrients(ingredients: RecipeIngredientInput[], servings: number): NumericRow {
  return Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(key => {
    const total = sumField(ingredients, key)
    return [key, key === 'calories' ? roundKcal(total / servings) : roundMacro(total / servings)]
  }))
}

function validateRecipeInput(servings: number, ingredients: RecipeIngredientInput[], res: Response): boolean {
  if (!servings || servings <= 0) {
    res.status(400).json({ error: 'servings must be greater than 0' })
    return false
  }
  if (!ingredients || ingredients.length === 0) {
    res.status(400).json({ error: 'A recipe needs at least one ingredient' })
    return false
  }
  if (ingredients.some(ing => !(ing.quantity > 0))) {
    // A zero/negative ingredient quantity would get stored as this ingredient's
    // baseline snapshot, then divide-by-zero the next time it's rescaled client-side
    // in the recipe builder (#165 review finding) — reject at write time instead.
    res.status(400).json({ error: 'Each ingredient needs a quantity greater than 0' })
    return false
  }
  return true
}

// GET /api/nutrition/recipes — list saved recipes with their per-serving food's macros
nutritionRouter.get('/recipes', (req, res) => {
  const recipes = db.prepare(`
    SELECT r.id, r.name, r.servings, r.food_id, r.created_at,
      ${NUMERIC_NUTRIENT_KEYS.map(k => `fv.${k} as per_serving_${k}`).join(', ')},
      (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) as ingredient_count
    FROM recipes r
    JOIN food_variants fv ON fv.food_id = r.food_id AND fv.is_default = 1
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

  if (!validateRecipeInput(servings, ingredients, res)) return

  try {
    const perServing = perServingNutrients(ingredients, servings)

    const createRecipe = db.transaction(() => {
      const foodInfo = db.prepare("INSERT INTO foods (source, name) VALUES ('custom', ?)").run(name)
      const foodId = foodInfo.lastInsertRowid
      db.prepare(`
        INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, ${NUMERIC_NUTRIENT_KEYS.join(', ')})
        VALUES (@food_id, '1 serving', 1, 'serving', 1, 'custom', ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')})
      `).run({ food_id: foodId, ...perServing })

      const recipeInfo = db.prepare(
        'INSERT INTO recipes (name, servings, food_id) VALUES (?, ?, ?)'
      ).run(name, servings, foodId)
      const recipeId = recipeInfo.lastInsertRowid

      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (
          recipe_id, variant_id, name, quantity, unit,
          ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
        )
        VALUES (
          @recipe_id, @variant_id, @name, @quantity, @unit,
          ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')}, @glycemic_index, @custom_nutrients, @allergens, @traces
        )
      `)
      for (const ing of ingredients) {
        insertIngredient.run({
          recipe_id: recipeId, variant_id: ing.variant_id ?? null, name: ing.name, quantity: ing.quantity, unit: ing.unit,
          ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, ing[k] ?? null])),
          glycemic_index: ing.glycemic_index ?? null,
          custom_nutrients: parseJsonField(ing.custom_nutrients),
          allergens: parseJsonField(ing.allergens),
          traces: parseJsonField(ing.traces),
        })
      }
      return { recipeId, foodId }
    })

    const { recipeId, foodId } = createRecipe()
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as object
    const food = foodWithVariants(foodId as number)
    res.status(201).json({ ...recipe, food })
  } catch (err: unknown) {
    console.error('[nutrition] recipe save failed:', err)
    logEvent('nutrition', 'error', 'recipe save failed: ' + errorDetail(err))
    res.status(400).json({ error: 'Could not save recipe' })
  }
})

// GET /api/nutrition/recipes/:id — a single recipe's composition, for the edit flow
nutritionRouter.get('/recipes/:id', (req, res) => {
  const { id } = req.params
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id)
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  const ingredients = db.prepare(`
    SELECT variant_id, name, quantity, unit, ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
    FROM recipe_ingredients WHERE recipe_id = ? ORDER BY id
  `).all(id)
  res.json({ ...recipe, ingredients })
})

// PUT /api/nutrition/recipes/:id — re-save an existing recipe's composition: recomputes
// per-serving macros and updates the materialized foods row IN PLACE (same food_id), so
// past food_log_entries rows referencing it stay valid (they hold their own denormalized
// snapshot regardless). Ingredient rows are replaced wholesale, same as a fresh POST.
nutritionRouter.put('/recipes/:id', (req, res) => {
  const { id } = req.params
  const { name, servings, ingredients } = req.body as {
    name: string
    servings: number
    ingredients: RecipeIngredientInput[]
  }

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as { food_id: number } | undefined
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  if (!validateRecipeInput(servings, ingredients, res)) return
  const ownVariantIds = new Set(
    (db.prepare('SELECT id FROM food_variants WHERE food_id = ?').all(recipe.food_id) as { id: number }[]).map(v => v.id)
  )
  if (ingredients.some(ing => ing.variant_id != null && ownVariantIds.has(ing.variant_id))) {
    res.status(400).json({ error: 'A recipe cannot use itself as an ingredient' })
    return
  }

  try {
    const perServing = perServingNutrients(ingredients, servings)

    const updateRecipe = db.transaction(() => {
      db.prepare('UPDATE recipes SET name = ?, servings = ? WHERE id = ?').run(name, servings, id)
      db.prepare('UPDATE foods SET name = ? WHERE id = ?').run(name, recipe.food_id)
      db.prepare(`
        UPDATE food_variants SET ${NUMERIC_NUTRIENT_KEYS.map(k => `${k} = @${k}`).join(', ')}
        WHERE food_id = @food_id AND is_default = 1
      `).run({ food_id: recipe.food_id, ...perServing })

      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id)
      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (
          recipe_id, variant_id, name, quantity, unit,
          ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
        )
        VALUES (
          @recipe_id, @variant_id, @name, @quantity, @unit,
          ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')}, @glycemic_index, @custom_nutrients, @allergens, @traces
        )
      `)
      for (const ing of ingredients) {
        insertIngredient.run({
          recipe_id: id, variant_id: ing.variant_id ?? null, name: ing.name, quantity: ing.quantity, unit: ing.unit,
          ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, ing[k] ?? null])),
          glycemic_index: ing.glycemic_index ?? null,
          custom_nutrients: parseJsonField(ing.custom_nutrients),
          allergens: parseJsonField(ing.allergens),
          traces: parseJsonField(ing.traces),
        })
      }
    })
    updateRecipe()

    const updatedRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id)
    const food = foodWithVariants(recipe.food_id)
    res.json({ ...updatedRecipe as object, food })
  } catch (err: unknown) {
    console.error('[nutrition] recipe update failed:', err)
    logEvent('nutrition', 'error', 'recipe update failed: ' + errorDetail(err))
    res.status(400).json({ error: 'Could not update recipe' })
  }
})

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
      db.prepare('DELETE FROM food_variants WHERE food_id = ?').run(recipe.food_id)
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
    logEvent('nutrition', 'error', 'recipe delete failed: ' + errorDetail(err))
    res.status(400).json({ error: 'Could not delete recipe' })
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
      ${NUMERIC_NUTRIENT_KEYS.map(k => `COALESCE(SUM(${k}), 0) as ${k}`).join(',\n      ')}
    FROM food_log_entries
    WHERE date >= ?
    GROUP BY date
  `).all(dayLabel(days - 1)) as Array<{ date: string } & Record<NumericNutrientKey, number>>

  const zeroDay = (date: string): { date: string } & Record<NumericNutrientKey, number> =>
    ({ date, ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, 0])) } as { date: string } & Record<NumericNutrientKey, number>)

  const byDate = new Map(rows.map(r => [r.date, r]))
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const date = dayLabel(i)
    result.push(byDate.get(date) ?? zeroDay(date))
  }

  res.json({ days: result })
})

export default nutritionRouter
