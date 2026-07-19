import { Router, type Response } from 'express'
import db from '../db/client'
import { estimateMealFromPhoto } from '../lib/ai/mealPhoto'

const nutritionRouter = Router()

// Widened nutrient set (#140). NUMERIC_NUTRIENT_KEYS covers every summable/scalable
// quantity (the original 5 macros plus the 12 new ones) — used everywhere a per-key
// loop already iterated the original 5, so scaling/totals/target-vs-actual logic stays
// mechanical instead of hand-duplicated per field. DESCRIPTIVE_KEYS are NOT summed or
// scaled — they describe the food itself (a "half" glycemic index or half an allergen
// list makes no sense), so they're only read/written on a single row, never aggregated.
const NUMERIC_NUTRIENT_KEYS = [
  'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g',
  'sodium_mg', 'sugar_g', 'saturated_fat_g', 'polyunsaturated_fat_g', 'monounsaturated_fat_g',
  'trans_fat_g', 'cholesterol_mg', 'potassium_mg', 'vitamin_a_mcg', 'vitamin_c_mg',
  'calcium_mg', 'iron_mg',
] as const
type NumericNutrientKey = typeof NUMERIC_NUTRIENT_KEYS[number]
const JSON_NUTRIENT_KEYS = ['custom_nutrients', 'allergens', 'traces'] as const
const DESCRIPTIVE_NUTRIENT_KEYS = ['glycemic_index', ...JSON_NUTRIENT_KEYS] as const
type NumericRow = Partial<Record<NumericNutrientKey, number | null>>

function parseJsonField(value: unknown): unknown {
  return value === undefined || value === null ? null : JSON.stringify(value)
}

// GET /api/nutrition/foods/barcode/:code — look up a food by barcode (#141 still-image
// barcode capture: client decodes the photo via zxing-wasm, then looks up the decoded
// code here against foods.source_id for Open Food Facts-sourced rows, which are keyed
// by product barcode — see foodImportMapping.ts's mapOffProductToRow). Registered before
// the generic GET /foods so it isn't shadowed (not actually at risk here since the paths
// diverge, but matches this file's established "specific routes before :param" habit).
nutritionRouter.get('/foods/barcode/:code', (req, res) => {
  const { code } = req.params
  const food = db.prepare(
    "SELECT * FROM foods WHERE source_id = ? AND source = 'openfoodfacts'"
  ).get(code)
  if (!food) {
    res.status(404).json({ error: 'No food matches this barcode' })
    return
  }
  res.json(food)
})

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

// GET /api/nutrition/foods?q= — search reference foods by name (includes custom foods)
nutritionRouter.get('/foods', (req, res) => {
  const q = (req.query.q as string | undefined) ?? ''
  const rows = db.prepare(
    'SELECT * FROM foods WHERE name LIKE ? ORDER BY name'
  ).all(`%${q}%`)
  res.json({ foods: rows })
})

interface FoodBody extends NumericRow {
  name: string
  brand?: string
  default_qty?: number
  default_unit?: string
  glycemic_index?: string
  custom_nutrients?: unknown
  allergens?: unknown
  traces?: unknown
}

// POST /api/nutrition/foods — save a new custom/ad-hoc food for reuse
nutritionRouter.post('/foods', (req, res) => {
  const body = req.body as FoodBody
  const { name, brand, default_qty, default_unit, glycemic_index } = body

  if (default_qty !== undefined && default_qty <= 0) {
    res.status(400).json({ error: 'default_qty must be greater than 0' })
    return
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO foods (
        source, name, brand, default_qty, default_unit,
        ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
      )
      VALUES (
        'custom', @name, @brand, @default_qty, @default_unit,
        ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')}, @glycemic_index, @custom_nutrients, @allergens, @traces
      )
    `)
    const info = stmt.run({
      name,
      brand: brand ?? null,
      default_qty: default_qty ?? 100,
      default_unit: default_unit ?? 'g',
      ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, body[k] ?? null])),
      glycemic_index: glycemic_index ?? null,
      custom_nutrients: parseJsonField(body.custom_nutrients),
      allergens: parseJsonField(body.allergens),
      traces: parseJsonField(body.traces),
    })
    const row = db.prepare('SELECT * FROM foods WHERE id = ?').get(info.lastInsertRowid)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[nutrition] custom food save failed:', err)
    res.status(400).json({ error: 'Could not save custom food' })
  }
})

interface FoodRow extends NumericRow {
  id: number
  name: string
  default_qty: number
  default_unit: string
  glycemic_index: string | null
  custom_nutrients: string | null
  allergens: string | null
  traces: string | null
}

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
    'SELECT * FROM food_log_entries WHERE date = ? ORDER BY logged_at'
  ).all(date) as Array<{ id: number; meal_type: string } & NumericRow>

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
    'SELECT * FROM food_log_entries ORDER BY logged_at DESC, id DESC LIMIT 200'
  ).all() as Array<{ name: string; unit: string }>

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
  food_id?: number
  name?: string
  quantity: number
  unit: string
  glycemic_index?: string
  custom_nutrients?: unknown
  allergens?: unknown
  traces?: unknown
}

// POST /api/nutrition/log — log a new entry, either against a reference food (scaled) or fully ad-hoc
nutritionRouter.post('/log', (req, res) => {
  const body = req.body as LogEntryBody
  const { date, meal_type, food_id, name, quantity, unit } = body

  if (!(quantity > 0)) {
    // A zero/negative quantity would divide-by-zero (ad-hoc) or store zeroed macros
    // (food-linked) at write time, and — worse — later become an unrescalable stored
    // quantity: PUT /log/:id rescales from THIS entry's own prior quantity, so a zeroed
    // entry can never recover its macros on a subsequent edit (#164 review finding).
    res.status(400).json({ error: 'quantity must be greater than 0' })
    return
  }

  try {
    let entry: { name: string } & NumericRow & { glycemic_index: string | null; custom_nutrients: unknown; allergens: unknown; traces: unknown }

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
        ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, scale(food[k] ?? null, factor)])),
        // Descriptive fields are not scaled by quantity (see DESCRIPTIVE_NUTRIENT_KEYS
        // comment) — copied straight through from the food row, already TEXT/JSON-text.
        glycemic_index: food.glycemic_index ?? null,
        custom_nutrients: food.custom_nutrients ?? null,
        allergens: food.allergens ?? null,
        traces: food.traces ?? null,
      }
    } else {
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
        date, meal_type, food_id, name, quantity, unit,
        ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
      )
      VALUES (
        @date, @meal_type, @food_id, @name, @quantity, @unit,
        ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')}, @glycemic_index, @custom_nutrients, @allergens, @traces
      )
    `)
    const info = stmt.run({
      date, meal_type, food_id: food_id ?? null, quantity, unit,
      ...entry,
    })
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

  const editable = ['date', 'meal_type', 'name', 'quantity', 'unit', ...NUMERIC_NUTRIENT_KEYS, ...DESCRIPTIVE_NUTRIENT_KEYS] as const
  const updates: Record<string, unknown> = {}
  for (const key of editable) {
    if (key in req.body) {
      updates[key] = (JSON_NUTRIENT_KEYS as readonly string[]).includes(key) ? parseJsonField(req.body[key]) : req.body[key]
    }
  }

  // A food-linked entry's macros are a denormalized snapshot, not a live join — a
  // quantity or unit edit must rescale, otherwise the stored macros silently keep
  // reflecting the old quantity/unit combination. Rescaling from the entry's OWN prior
  // quantity/macros (not a fresh read of the current `foods` row) matters: the
  // referenced food can itself have been edited since this entry was logged (e.g. a
  // recipe re-save widens/narrows its per-serving macros), and a live re-read would
  // silently rewrite this historical entry's macros to reflect that later edit instead
  // of what was actually true when it was logged. Only macros NOT explicitly overridden
  // in this same request get rescaled — providing one corrected macro must not freeze
  // the other four at their now-stale values. Unit is still validated against the food's
  // default_unit the same way POST does (no conversion in v1), since an entry's unit
  // must always match the food it's linked to, edit or not — that check is the only
  // remaining reason to read the live `foods` row here.
  if (existing.food_id != null) {
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(existing.food_id) as FoodRow | undefined
    if (food) {
      const finalUnit = (updates.unit ?? existing.unit) as string
      if (finalUnit !== food.default_unit) {
        res.status(400).json({ error: `Unit mismatch — this food is logged in ${food.default_unit}` })
        return
      }
      if ('quantity' in updates || 'unit' in updates) {
        const finalQuantity = (updates.quantity ?? existing.quantity) as number
        if (finalQuantity <= 0) {
          res.status(400).json({ error: 'quantity must be greater than 0' })
          return
        }
        const existingQuantity = existing.quantity as number
        if (existingQuantity <= 0) {
          // Defense in depth against pre-existing bad data (mirrors the POST /log
          // guard) — a stale row with quantity <= 0 has no valid ratio to rescale
          // from, and silently skipping the rescale would freeze its macros at
          // whatever they already (wrongly) were instead of surfacing the problem.
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
    }
  }

  const merged = { ...existing, ...updates }
  db.prepare(`
    UPDATE food_log_entries SET
      date = @date, meal_type = @meal_type, name = @name, quantity = @quantity, unit = @unit,
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
  food_id?: number
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
      ${NUMERIC_NUTRIENT_KEYS.map(k => `f.${k} as per_serving_${k}`).join(', ')},
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

  if (!validateRecipeInput(servings, ingredients, res)) return

  try {
    const perServing = perServingNutrients(ingredients, servings)

    const createRecipe = db.transaction(() => {
      const foodInfo = db.prepare(`
        INSERT INTO foods (source, name, default_qty, default_unit, ${NUMERIC_NUTRIENT_KEYS.join(', ')})
        VALUES ('custom', @name, 1, 'serving', ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')})
      `).run({ name, ...perServing })
      const foodId = foodInfo.lastInsertRowid

      const recipeInfo = db.prepare(
        'INSERT INTO recipes (name, servings, food_id) VALUES (?, ?, ?)'
      ).run(name, servings, foodId)
      const recipeId = recipeInfo.lastInsertRowid

      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (
          recipe_id, food_id, name, quantity, unit,
          ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
        )
        VALUES (
          @recipe_id, @food_id, @name, @quantity, @unit,
          ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')}, @glycemic_index, @custom_nutrients, @allergens, @traces
        )
      `)
      for (const ing of ingredients) {
        insertIngredient.run({
          recipe_id: recipeId, food_id: ing.food_id ?? null, name: ing.name, quantity: ing.quantity, unit: ing.unit,
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

// GET /api/nutrition/recipes/:id — a single recipe's composition, for the edit flow
nutritionRouter.get('/recipes/:id', (req, res) => {
  const { id } = req.params
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id)
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  const ingredients = db.prepare(`
    SELECT food_id, name, quantity, unit, ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
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
  if (ingredients.some(ing => ing.food_id === recipe.food_id)) {
    res.status(400).json({ error: 'A recipe cannot use itself as an ingredient' })
    return
  }

  try {
    const perServing = perServingNutrients(ingredients, servings)

    const updateRecipe = db.transaction(() => {
      db.prepare('UPDATE recipes SET name = ?, servings = ? WHERE id = ?').run(name, servings, id)
      db.prepare(`
        UPDATE foods SET name = @name, ${NUMERIC_NUTRIENT_KEYS.map(k => `${k} = @${k}`).join(', ')}
        WHERE id = @food_id
      `).run({ name, food_id: recipe.food_id, ...perServing })

      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id)
      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (
          recipe_id, food_id, name, quantity, unit,
          ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
        )
        VALUES (
          @recipe_id, @food_id, @name, @quantity, @unit,
          ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')}, @glycemic_index, @custom_nutrients, @allergens, @traces
        )
      `)
      for (const ing of ingredients) {
        insertIngredient.run({
          recipe_id: id, food_id: ing.food_id ?? null, name: ing.name, quantity: ing.quantity, unit: ing.unit,
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
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(recipe.food_id)
    res.json({ ...updatedRecipe as object, food })
  } catch (err: unknown) {
    console.error('[nutrition] recipe update failed:', err)
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
