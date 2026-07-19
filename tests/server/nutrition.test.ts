import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateObject: vi.fn(),
  }
})

describe('Nutrition API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  describe('GET /api/nutrition/foods', () => {
    it('returns an empty array when the foods table is empty', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/foods').query({ q: 'chicken' })
      expect(res.status).toBe(200)
      expect(res.body.foods).toEqual([])
    })
  })

  describe('POST /api/nutrition/foods', () => {
    it('saves a new custom food', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/foods').send({
        name: 'Grilled Chicken Breast',
        default_qty: 100,
        default_unit: 'g',
        calories: 165,
        protein_g: 31,
        carbs_g: 0,
        fat_g: 3.6,
        fiber_g: 0,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ source: 'custom', name: 'Grilled Chicken Breast', calories: 165 })
    })

    it('the saved custom food is immediately returned by a case-insensitive search', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/foods').query({ q: 'CHICKEN' })
      expect(res.status).toBe(200)
      expect(res.body.foods.length).toBeGreaterThan(0)
      expect(res.body.foods.some((f: { name: string }) => f.name === 'Grilled Chicken Breast')).toBe(true)
    })

    it('rejects a default_qty of 0, which would cause a division-by-zero when later scaling a logged entry', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/foods').send({
        name: 'Zero Qty Food', default_qty: 0, default_unit: 'g', calories: 100,
      })
      expect(res.status).toBe(400)
    })

    it('rejects a negative default_qty for the same reason', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/foods').send({
        name: 'Negative Qty Food', default_qty: -5, default_unit: 'g', calories: 100,
      })
      expect(res.status).toBe(400)
    })
  })

  describe('Food log CRUD', () => {
    const logDate = '2026-07-01'
    let oatsFoodId: number
    let adHocEntryId: number

    beforeAll(async () => {
      const { default: db } = await import('../../server/db/client')
      const info = db.prepare(`
        INSERT INTO foods (source, name, default_qty, default_unit, calories, protein_g, carbs_g, fat_g, fiber_g)
        VALUES ('custom', 'Test Oats', 100, 'g', 389, 16.9, 66.3, 6.9, 10.6)
      `).run()
      oatsFoodId = Number(info.lastInsertRowid)
    })

    it('POST with food_id + quantity scales macros server-side', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: logDate,
        meal_type: 'breakfast',
        food_id: oatsFoodId,
        quantity: 200,
        unit: 'g',
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        name: 'Test Oats',
        calories: 778,
        protein_g: 33.8,
        carbs_g: 132.6,
        fat_g: 13.8,
        fiber_g: 21.2,
      })
    })

    it('POST without food_id stores an ad-hoc entry with caller-supplied macros as-is', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: logDate,
        meal_type: 'breakfast',
        name: 'Homemade smoothie',
        quantity: 1,
        unit: 'serving',
        calories: 300,
        protein_g: 20,
        carbs_g: 40,
        fat_g: 5,
        fiber_g: 3,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ name: 'Homemade smoothie', calories: 300, protein_g: 20 })
      adHocEntryId = res.body.id
    })

    it('POST with a food_id that does not exist in foods returns 400, not a raw 500', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: logDate,
        meal_type: 'lunch',
        food_id: 999999,
        quantity: 100,
        unit: 'g',
      })
      expect(res.status).toBe(400)
    })

    it('GET ?date= returns entries grouped by meal with correct per-meal and daily totals', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/log').query({ date: logDate })
      expect(res.status).toBe(200)
      expect(res.body.meals.breakfast.entries.length).toBe(2)
      expect(res.body.meals.breakfast.totals.calories).toBe(1078)
      expect(res.body.daily.calories).toBe(1078)
      expect(res.body.daily.protein_g).toBe(53.8)
    })

    it('PUT edits a logged entry', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).put(`/api/nutrition/log/${adHocEntryId}`).send({ calories: 350 })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id: adHocEntryId, calories: 350 })
    })

    it('PUT with a new quantity on a food-linked entry rescales macros from the reference food', async () => {
      // A separate date from logDate — this block only asserts the created/edited
      // entry's own fields, but reuses logDate elsewhere would pollute the later
      // Targets + summary block's aggregate totals for logDate.
      const rescaleDate = '2026-07-03'
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/log').send({
        date: rescaleDate, meal_type: 'lunch', food_id: oatsFoodId, quantity: 100, unit: 'g',
      })
      expect(created.body.calories).toBe(389) // 100g == default_qty, factor 1

      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ quantity: 50 })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ quantity: 50, calories: 194.5, protein_g: 8.45 })
    })

    it('PUT with quantity + one explicit macro override rescales the OTHER macros too, not just the one provided', async () => {
      const overrideDate = '2026-07-05'
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/log').send({
        date: overrideDate, meal_type: 'lunch', food_id: oatsFoodId, quantity: 100, unit: 'g',
      })
      expect(created.body).toMatchObject({ calories: 389, protein_g: 16.9 })

      // Change quantity to 50 (would normally halve everything) AND explicitly override
      // calories to a manually-corrected value. protein_g/carbs_g/fat_g/fiber_g were not
      // explicitly provided, so they must still rescale to the new quantity (194.5-style
      // halving), not remain stuck at the old quantity=100 values.
      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ quantity: 50, calories: 100 })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ quantity: 50, calories: 100, protein_g: 8.45 })
    })

    it('PUT rejects changing unit away from the linked food\'s default_unit, same as POST', async () => {
      const unitDate = '2026-07-06'
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/log').send({
        date: unitDate, meal_type: 'lunch', food_id: oatsFoodId, quantity: 100, unit: 'g',
      })

      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ unit: 'oz' })
      expect(res.status).toBe(400)

      // and the original entry must be unchanged, not partially written
      const { default: db } = await import('../../server/db/client')
      const row = db.prepare('SELECT unit, quantity, calories FROM food_log_entries WHERE id = ?').get(created.body.id)
      expect(row).toMatchObject({ unit: 'g', quantity: 100, calories: 389 })
    })

    it('POST with an explicit food_id: null is treated as ad-hoc, not an invalid food reference', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-04', meal_type: 'snack', food_id: null,
        name: 'Handful of nuts', quantity: 1, unit: 'serving', calories: 180,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ name: 'Handful of nuts', calories: 180 })
    })

    it('DELETE removes a logged entry', async () => {
      const { app } = await import('../../server/index')
      const del = await request(app).delete(`/api/nutrition/log/${adHocEntryId}`)
      expect(del.status).toBe(200)

      const res = await request(app).get('/api/nutrition/log').query({ date: logDate })
      expect(res.body.meals.breakfast.entries.some((e: { id: number }) => e.id === adHocEntryId)).toBe(false)
    })
  })

  describe('Targets + summary', () => {
    const targetDate = '2026-06-01'
    const laterDate = '2026-06-15'
    const logDate = '2026-07-01' // matches the date used in the "Food log CRUD" block above

    it('POST /api/nutrition/targets upserts a target set', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/targets').send({
        date: targetDate, calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65, fiber_g: 25,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ date: targetDate, calories: 2000 })
    })

    it('POST with the same date updates the existing row instead of duplicating', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/targets').send({
        date: targetDate, calories: 2200, protein_g: 180, carbs_g: 220, fat_g: 70, fiber_g: 30,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ date: targetDate, calories: 2200 })

      const { default: db } = await import('../../server/db/client')
      const count = db.prepare('SELECT COUNT(*) as n FROM nutrition_targets WHERE date = ?').get(targetDate) as { n: number }
      expect(count.n).toBe(1)
    })

    it('GET ?date= returns the most recent target with date <= the requested date', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/targets').query({ date: laterDate })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ date: targetDate, calories: 2200 })
    })

    it('GET /api/nutrition/summary composes log totals against the resolved target', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/summary').query({ date: logDate })
      expect(res.status).toBe(200)
      expect(res.body.target).toMatchObject({ calories: 2200, protein_g: 180 })
      expect(res.body.actual).toMatchObject({ calories: 778, protein_g: 33.8 })
      expect(res.body.remaining.calories).toBe(2200 - 778)
      expect(res.body.remaining.protein_g).toBeCloseTo(180 - 33.8)
    })
  })

  describe('GET /api/nutrition/trend', () => {
    function daysAgo(n: number): string {
      return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
    }

    it('computes "today" from the local calendar date, not UTC — the trend window must not be a day ahead in the evening EST hours', async () => {
      // 11:30pm EDT on 2026-07-02 is already 2026-07-03T03:30:00Z in UTC — a naive
      // UTC-based "today" would be one day ahead of what the user considers today.
      // Tested via an explicit Date argument (no fake timers/clock mocking needed,
      // which avoids the known supertest+fake-timers hang seen elsewhere in this file).
      const originalTz = process.env.TZ
      process.env.TZ = 'America/New_York'
      const { localDateString } = await import('../../server/api/nutrition')
      expect(localDateString(new Date('2026-07-03T03:30:00Z'))).toBe('2026-07-02')
      process.env.TZ = originalTz
    })

    it('zero-fills days with no logged entries within the requested window', async () => {
      const { default: db } = await import('../../server/db/client')
      // 5-day window ending today: seed entries on only 2 of those 5 days.
      db.prepare(`
        INSERT INTO food_log_entries (date, meal_type, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g)
        VALUES (?, 'lunch', 'Trend Test A', 1, 'serving', 500, 20, 50, 10, 5)
      `).run(daysAgo(3))
      db.prepare(`
        INSERT INTO food_log_entries (date, meal_type, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g)
        VALUES (?, 'dinner', 'Trend Test B', 1, 'serving', 700, 30, 60, 15, 8)
      `).run(daysAgo(1))

      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/trend').query({ days: 5 })

      expect(res.status).toBe(200)
      expect(res.body.days.length).toBe(5)
      expect(res.body.days.map((d: { date: string }) => d.date)).toEqual([
        daysAgo(4), daysAgo(3), daysAgo(2), daysAgo(1), daysAgo(0),
      ])
      expect(res.body.days.find((d: { date: string }) => d.date === daysAgo(4))).toMatchObject({ calories: 0 })
      expect(res.body.days.find((d: { date: string }) => d.date === daysAgo(3))).toMatchObject({ calories: 500 })
      expect(res.body.days.find((d: { date: string }) => d.date === daysAgo(2))).toMatchObject({ calories: 0 })
      expect(res.body.days.find((d: { date: string }) => d.date === daysAgo(1))).toMatchObject({ calories: 700 })
      expect(res.body.days.find((d: { date: string }) => d.date === daysAgo(0))).toMatchObject({ calories: 0 })
    })

    it('clamps days to the same 1-30 range as /api/garmin/activities?days=', async () => {
      const { app } = await import('../../server/index')
      const tooMany = await request(app).get('/api/nutrition/trend').query({ days: 9999 })
      expect(tooMany.body.days.length).toBe(30)

      // days=0 is falsy, so — mirroring garmin.ts's `Number(req.query.days) || 7` exactly —
      // it falls back to the default of 7 rather than clamping to the floor of 1.
      const zero = await request(app).get('/api/nutrition/trend').query({ days: 0 })
      expect(zero.body.days.length).toBe(7)

      const negative = await request(app).get('/api/nutrition/trend').query({ days: -5 })
      expect(negative.body.days.length).toBe(1)

      const missing = await request(app).get('/api/nutrition/trend').query({})
      expect(missing.body.days.length).toBe(7)
    })
  })

  describe('Recipes', () => {
    it('POST /api/nutrition/recipes creates a recipe, its per-serving food, and its ingredients', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/recipes').send({
        name: 'Protein Smoothie',
        servings: 2,
        ingredients: [
          { name: 'Protein powder', quantity: 1, unit: 'scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1, fiber_g: 0 },
          { name: 'Banana', quantity: 1, unit: 'each', calories: 106, protein_g: 26, carbs_g: 27, fat_g: 0, fiber_g: 3 },
        ],
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ name: 'Protein Smoothie', servings: 2 })
      expect(res.body.food).toMatchObject({
        name: 'Protein Smoothie', default_qty: 1, default_unit: 'serving',
        calories: 113, protein_g: 25, carbs_g: 15, fat_g: 0.5, fiber_g: 1.5,
      })
    })

    it('POST /api/nutrition/recipes rejects zero servings', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/recipes').send({
        name: 'Bad Recipe', servings: 0, ingredients: [{ name: 'X', quantity: 1, unit: 'g', calories: 10 }],
      })
      expect(res.status).toBe(400)
    })

    it('POST /api/nutrition/recipes rejects an empty ingredient list', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/recipes').send({
        name: 'Empty Recipe', servings: 2, ingredients: [],
      })
      expect(res.status).toBe(400)
    })

    it('GET /api/nutrition/recipes lists saved recipes with their per-serving macros and ingredient count', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/recipes')
      expect(res.status).toBe(200)
      const smoothie = res.body.recipes.find((r: { name: string }) => r.name === 'Protein Smoothie')
      expect(smoothie).toBeDefined()
      expect(smoothie.ingredient_count).toBe(2)
    })

    it('DELETE /api/nutrition/recipes/:id removes the recipe, its ingredients, and its materialized food', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Temp Recipe', servings: 1, ingredients: [{ name: 'X', quantity: 1, unit: 'g', calories: 50 }],
      })
      const foodId = created.body.food.id
      const del = await request(app).delete(`/api/nutrition/recipes/${created.body.id}`)
      expect(del.status).toBe(200)

      const { default: db } = await import('../../server/db/client')
      expect(db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId)).toBeUndefined()
    })

    it('DELETE /api/nutrition/recipes/:id returns 404 for a nonexistent recipe', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).delete('/api/nutrition/recipes/999999')
      expect(res.status).toBe(404)
    })

    it('DELETE /api/nutrition/recipes/:id is blocked with 400 if its food has already been logged, and leaves everything intact', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Logged Recipe', servings: 1, ingredients: [{ name: 'X', quantity: 1, unit: 'g', calories: 80 }],
      })
      const foodId = created.body.food.id
      await request(app).post('/api/nutrition/log').send({
        date: '2026-07-10', meal_type: 'lunch', food_id: foodId, quantity: 1, unit: 'serving',
      })

      const del = await request(app).delete(`/api/nutrition/recipes/${created.body.id}`)
      expect(del.status).toBe(400)

      const { default: db } = await import('../../server/db/client')
      expect(db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId)).toBeDefined()
      expect(db.prepare('SELECT * FROM recipes WHERE id = ?').get(created.body.id)).toBeDefined()
    })

    it('GET /api/nutrition/recipes/:id returns the recipe with its ingredient composition', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Chicken Rice Bowl', servings: 2,
        ingredients: [
          { name: 'Chicken breast', quantity: 200, unit: 'g', calories: 330, protein_g: 62, carbs_g: 0, fat_g: 7.2, fiber_g: 0 },
          { name: 'Rice', quantity: 150, unit: 'g', calories: 195, protein_g: 4, carbs_g: 42, fat_g: 0.5, fiber_g: 1 },
        ],
      })
      const res = await request(app).get(`/api/nutrition/recipes/${created.body.id}`)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ name: 'Chicken Rice Bowl', servings: 2 })
      expect(res.body.ingredients).toHaveLength(2)
      expect(res.body.ingredients[0]).toMatchObject({ name: 'Chicken breast', quantity: 200, unit: 'g', calories: 330 })
    })

    it('GET /api/nutrition/recipes/:id returns 404 for a nonexistent recipe', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/recipes/999999')
      expect(res.status).toBe(404)
    })

    it('PUT /api/nutrition/recipes/:id recomputes per-serving macros in place, without creating a duplicate food row or breaking existing log entries', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Protein Bowl', servings: 2,
        ingredients: [{ name: 'Chicken breast', quantity: 200, unit: 'g', calories: 330, protein_g: 62, carbs_g: 0, fat_g: 7.2, fiber_g: 0 }],
      })
      const recipeId = created.body.id
      const foodId = created.body.food.id

      // this recipe's materialized food has already been logged — editing must not orphan that entry
      const logRes = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-10', meal_type: 'lunch', food_id: foodId, quantity: 1, unit: 'serving',
      })

      const updated = await request(app).put(`/api/nutrition/recipes/${recipeId}`).send({
        name: 'Protein Bowl', servings: 2,
        ingredients: [
          { name: 'Chicken breast', quantity: 200, unit: 'g', calories: 330, protein_g: 62, carbs_g: 0, fat_g: 7.2, fiber_g: 0 },
          { name: 'Rice', quantity: 150, unit: 'g', calories: 195, protein_g: 4, carbs_g: 42, fat_g: 0.5, fiber_g: 1 },
        ],
      })
      expect(updated.status).toBe(200)
      expect(updated.body.food).toMatchObject({ id: foodId, calories: Math.round((330 + 195) / 2) })

      const { default: db } = await import('../../server/db/client')
      // still exactly one foods row for this recipe — updated in place, not duplicated
      expect(db.prepare('SELECT COUNT(*) as n FROM foods WHERE id = ?').get(foodId)).toMatchObject({ n: 1 })
      // the recipe's ingredient rows reflect the new composition
      const ingredients = db.prepare('SELECT name FROM recipe_ingredients WHERE recipe_id = ? ORDER BY id').all(recipeId) as { name: string }[]
      expect(ingredients.map(i => i.name)).toEqual(['Chicken breast', 'Rice'])
      // the earlier log entry still references a valid food_id and keeps its original snapshot
      const logEntry = db.prepare('SELECT food_id, calories FROM food_log_entries WHERE id = ?').get(logRes.body.id) as { food_id: number; calories: number }
      expect(logEntry.food_id).toBe(foodId)
      expect(logEntry.calories).toBe(165)
    })

    it('PUT /api/nutrition/log/:id rescales a food-linked entry from its OWN prior macros on a quantity edit, not the food\'s current (possibly since-edited) macros', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Protein Smoothie', servings: 2,
        ingredients: [{ name: 'Protein powder', quantity: 1, unit: 'scoop', calories: 300, protein_g: 60, carbs_g: 0, fat_g: 0, fiber_g: 0 }],
      })
      const foodId = created.body.food.id
      expect(created.body.food.calories).toBe(150) // 300 / 2 servings

      // logged 2 servings while the recipe was still 150 kcal/serving -> 300 kcal stored
      const logRes = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-10', meal_type: 'lunch', food_id: foodId, quantity: 2, unit: 'serving',
      })
      expect(logRes.body.calories).toBe(300)

      // recipe edited afterward -> materialized food's calories change from 150 to 400/serving
      await request(app).put(`/api/nutrition/recipes/${created.body.id}`).send({
        name: 'Protein Smoothie', servings: 2,
        ingredients: [{ name: 'Protein powder', quantity: 1, unit: 'scoop', calories: 800, protein_g: 60, carbs_g: 0, fat_g: 0, fiber_g: 0 }],
      })

      // editing only the log entry's quantity must scale from its OWN prior 300kcal-for-2-servings
      // ratio (150/serving), not the food's new 400/serving value
      const res = await request(app).put(`/api/nutrition/log/${logRes.body.id}`).send({ quantity: 3 })
      expect(res.status).toBe(200)
      expect(res.body.calories).toBe(450) // 150/serving (as originally logged) * 3, not 400 * 3 = 1200
    })

    it('PUT /api/nutrition/recipes/:id returns 404 for a nonexistent recipe', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).put('/api/nutrition/recipes/999999').send({
        name: 'X', servings: 1, ingredients: [{ name: 'X', quantity: 1, unit: 'g', calories: 10 }],
      })
      expect(res.status).toBe(404)
    })

    it('GET and PUT /api/nutrition/recipes/:id round-trip the widened nutrient set (#140), not just the original 5 macros', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Salty Bowl', servings: 2,
        ingredients: [{
          name: 'Cured ham', quantity: 100, unit: 'g', calories: 145, protein_g: 21, carbs_g: 1.5, fat_g: 5, fiber_g: 0,
          sodium_mg: 1200, allergens: ['pork'],
        }],
      })
      const recipeId = created.body.id
      expect(created.body.food.sodium_mg).toBe(600) // 1200 / 2 servings

      // GET must return the ingredient's widened fields, not just the original 5
      const fetched = await request(app).get(`/api/nutrition/recipes/${recipeId}`)
      expect(fetched.body.ingredients[0].sodium_mg).toBe(1200)
      expect(JSON.parse(fetched.body.ingredients[0].allergens)).toEqual(['pork'])

      // PUT must recompute the widened per-serving fields, not silently drop them
      const updated = await request(app).put(`/api/nutrition/recipes/${recipeId}`).send({
        name: 'Salty Bowl', servings: 2,
        ingredients: [{
          name: 'Cured ham', quantity: 100, unit: 'g', calories: 145, protein_g: 21, carbs_g: 1.5, fat_g: 5, fiber_g: 0,
          sodium_mg: 2400, allergens: ['pork'],
        }],
      })
      expect(updated.body.food.sodium_mg).toBe(1200) // 2400 / 2 servings

      const refetched = await request(app).get(`/api/nutrition/recipes/${recipeId}`)
      expect(refetched.body.ingredients[0].sodium_mg).toBe(2400)
    })

    it('PUT /api/nutrition/recipes/:id rejects an ingredient that references the recipe\'s own materialized food', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Self Ref Bowl', servings: 2,
        ingredients: [{ name: 'Chicken breast', quantity: 200, unit: 'g', calories: 330, protein_g: 62, carbs_g: 0, fat_g: 7.2, fiber_g: 0 }],
      })
      const recipeId = created.body.id
      const foodId = created.body.food.id

      const res = await request(app).put(`/api/nutrition/recipes/${recipeId}`).send({
        name: 'Self Ref Bowl', servings: 2,
        ingredients: [{ food_id: foodId, name: 'Self Ref Bowl', quantity: 1, unit: 'serving', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0 }],
      })
      expect(res.status).toBe(400)

      const { default: db } = await import('../../server/db/client')
      // rejected — the recipe's ingredient composition must be untouched
      const ingredients = db.prepare('SELECT name FROM recipe_ingredients WHERE recipe_id = ?').all(recipeId) as { name: string }[]
      expect(ingredients.map(i => i.name)).toEqual(['Chicken breast'])
    })
  })

  describe('Food deletion', () => {
    it('DELETE /api/nutrition/foods/:id removes an unused food', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/foods').send({
        name: 'Unused Food', default_qty: 100, default_unit: 'g', calories: 50,
      })
      const del = await request(app).delete(`/api/nutrition/foods/${created.body.id}`)
      expect(del.status).toBe(200)
    })

    it('DELETE /api/nutrition/foods/:id returns 404 for a nonexistent food', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).delete('/api/nutrition/foods/999999')
      expect(res.status).toBe(404)
    })

    it('DELETE /api/nutrition/foods/:id is blocked with 400 if the food has been logged', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/foods').send({
        name: 'Logged Food', default_qty: 100, default_unit: 'g', calories: 50,
      })
      await request(app).post('/api/nutrition/log').send({
        date: '2026-07-11', meal_type: 'snack', food_id: created.body.id, quantity: 100, unit: 'g',
      })
      const del = await request(app).delete(`/api/nutrition/foods/${created.body.id}`)
      expect(del.status).toBe(400)
    })
  })

  describe('Recent entries', () => {
    it('GET /api/nutrition/log/recent returns entries newest-first, deduped by name+unit', async () => {
      const { default: db } = await import('../../server/db/client')

      // Insert entries with explicit timestamps that are guaranteed to be newest
      // Use a timestamp in the future to ensure they're returned first by ORDER BY logged_at DESC
      const future = new Date(Date.now() + 10000).toISOString().replace('T', ' ').slice(0, 19)
      const pastFuture = new Date(Date.now() + 5000).toISOString().replace('T', ' ').slice(0, 19)

      db.prepare(`INSERT INTO food_log_entries (date, meal_type, name, quantity, unit, calories, logged_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('2026-07-08', 'lunch', 'Salmon bowl', 1, 'bowl', 500, pastFuture, pastFuture)
      db.prepare(`INSERT INTO food_log_entries (date, meal_type, name, quantity, unit, calories, logged_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('2026-07-09', 'lunch', 'Salmon bowl', 1, 'bowl', 520, future, future)
      db.prepare(`INSERT INTO food_log_entries (date, meal_type, name, quantity, unit, calories, logged_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('2026-07-09', 'dinner', 'Turkey sandwich', 1, 'sandwich', 400, future, future)

      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/log/recent').query({ limit: 4 })
      expect(res.status).toBe(200)
      const salmonEntries = res.body.entries.filter((e: { name: string }) => e.name === 'Salmon bowl')
      expect(salmonEntries.length).toBe(1) // deduped
      expect(salmonEntries[0].calories).toBe(520) // the more recent of the two
    })

    it('GET /api/nutrition/log/recent respects the limit param', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/log/recent').query({ limit: 1 })
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.entries)).toBe(true)
      // After the previous test, there should be at least some entries in the database
      expect(res.body.entries.length).toBeGreaterThan(0)
      expect(res.body.entries.length).toBeLessThanOrEqual(1)
    })

    it('breaks ties at the same logged_at timestamp by using id DESC (higher id wins)', async () => {
      const { default: db } = await import('../../server/db/client')
      // Insert two entries with the SAME name, unit, and logged_at timestamp
      // but DIFFERENT calories to test the deterministic tiebreaker. Far-future
      // date (not just "recent") so these two rows always sort first regardless of
      // how many other entries earlier tests in this file logged via the real API
      // (which default logged_at to actual current time, not a fixed past date).
      const sameTimestamp = '2099-07-12 12:00:00'
      const firstId = Number(db.prepare(`
        INSERT INTO food_log_entries (date, meal_type, name, quantity, unit, calories, logged_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('2026-07-12', 'lunch', 'Chicken sandwich', 1, 'sandwich', 450, sameTimestamp, sameTimestamp).lastInsertRowid)

      const secondId = Number(db.prepare(`
        INSERT INTO food_log_entries (date, meal_type, name, quantity, unit, calories, logged_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('2026-07-12', 'lunch', 'Chicken sandwich', 1, 'sandwich', 480, sameTimestamp, sameTimestamp).lastInsertRowid)

      // Verify secondId is indeed larger (inserted later)
      expect(secondId).toBeGreaterThan(firstId)

      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/log/recent').query({ limit: 10 })
      expect(res.status).toBe(200)
      const sandwichEntries = res.body.entries.filter((e: { name: string }) => e.name === 'Chicken sandwich')
      expect(sandwichEntries.length).toBe(1) // deduped to exactly one
      expect(sandwichEntries[0].id).toBe(secondId) // the one with the higher id (inserted second)
      expect(sandwichEntries[0].calories).toBe(480) // and thus the correct calories value
    })

    it('the recent-entries sort (logged_at DESC, id DESC) is covered by an index, not a full-table temp-b-tree sort', async () => {
      const { default: db } = await import('../../server/db/client')
      const plan = db.prepare(
        'EXPLAIN QUERY PLAN SELECT * FROM food_log_entries ORDER BY logged_at DESC, id DESC LIMIT 200'
      ).all() as Array<{ detail: string }>
      const planText = plan.map(p => p.detail).join(' | ')
      expect(planText).not.toMatch(/USE TEMP B-TREE FOR ORDER BY/i)
    })
  })

  describe('Camera-based logging (#141)', () => {
    it('GET /api/nutrition/foods/barcode/:code finds a food previously imported from Open Food Facts by its barcode', async () => {
      const { default: db } = await import('../../server/db/client')
      db.prepare(`
        INSERT INTO foods (source, source_id, name, default_qty, default_unit, calories)
        VALUES ('openfoodfacts', '0016000275287', 'Cheerios', 100, 'g', 379)
      `).run()

      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/foods/barcode/0016000275287')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ name: 'Cheerios', source: 'openfoodfacts' })
    })

    it('GET /api/nutrition/foods/barcode/:code returns 404 for an unrecognized barcode, so the client can fall back to ad-hoc entry', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/foods/barcode/9999999999999')
      expect(res.status).toBe(404)
    })

    it('POST /api/nutrition/scan/meal-photo returns a macro estimate without creating a log entry — the user must still confirm and POST /log separately', async () => {
      const { generateObject } = await import('ai')
      vi.mocked(generateObject).mockResolvedValue({
        object: { name: 'Burrito bowl', calories: 650, protein_g: 35, carbs_g: 70, fat_g: 22, fiber_g: 8 },
      } as any)

      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/scan/meal-photo').send({ image: 'base64data', mediaType: 'image/jpeg' })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ name: 'Burrito bowl', calories: 650 })

      const { default: db } = await import('../../server/db/client')
      const count = db.prepare("SELECT COUNT(*) as n FROM food_log_entries WHERE name = 'Burrito bowl'").get() as { n: number }
      expect(count.n).toBe(0) // never auto-logged
    })

    it('POST /api/nutrition/scan/meal-photo returns 400 (not a raw 500) when the vision model call fails', async () => {
      const { generateObject } = await import('ai')
      vi.mocked(generateObject).mockRejectedValue(new Error('model unavailable'))

      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/scan/meal-photo').send({ image: 'base64data', mediaType: 'image/jpeg' })
      expect(res.status).toBe(400)
      expect(res.body.error).toBeDefined()
    })

    it('POST /api/nutrition/scan/meal-photo accepts a real phone-camera-sized photo — a base64 payload well over the old 1mb JSON body limit', async () => {
      const { generateObject } = await import('ai')
      vi.mocked(generateObject).mockResolvedValue({
        object: { name: 'Burrito bowl', calories: 650, protein_g: 35, carbs_g: 70, fat_g: 22, fiber_g: 8 },
      } as any)

      // ~3MB of base64 — comfortably in range for an actual iPhone camera photo, well
      // over the 1mb limit that would previously reject this with a 413 before the
      // route handler ever ran.
      const bigImage = 'A'.repeat(3 * 1024 * 1024)
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/scan/meal-photo').send({ image: bigImage, mediaType: 'image/jpeg' })
      expect(res.status).toBe(200)
    })
  })

  describe('Extended nutrients (#140)', () => {
    it('POST /api/nutrition/foods stores the widened nutrient set, round-tripping JSON fields', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/foods').send({
        name: 'Peanut Butter', default_qty: 32, default_unit: 'g', calories: 190,
        sodium_mg: 140, sugar_g: 3, saturated_fat_g: 3.5, cholesterol_mg: 0,
        glycemic_index: 'Low',
        custom_nutrients: { manganese_mg: 0.6 },
        allergens: ['peanuts'],
        traces: ['tree nuts'],
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        sodium_mg: 140, sugar_g: 3, saturated_fat_g: 3.5, cholesterol_mg: 0, glycemic_index: 'Low',
      })
      expect(JSON.parse(res.body.custom_nutrients)).toEqual({ manganese_mg: 0.6 })
      expect(JSON.parse(res.body.allergens)).toEqual(['peanuts'])
      expect(JSON.parse(res.body.traces)).toEqual(['tree nuts'])
    })

    it('a food saved without the new fields returns null for them, not 0 or []', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/foods').send({
        name: 'Plain Rice', default_qty: 100, default_unit: 'g', calories: 130,
      })
      expect(res.status).toBe(201)
      expect(res.body.sodium_mg).toBeNull()
      expect(res.body.custom_nutrients).toBeNull()
      expect(res.body.allergens).toBeNull()
      expect(res.body.glycemic_index).toBeNull()
    })

    it('POST /api/nutrition/log scales the new numeric fields from the linked food, and passes through non-scalable fields (glycemic_index/allergens) unchanged', async () => {
      const { app } = await import('../../server/index')
      const food = await request(app).post('/api/nutrition/foods').send({
        name: 'Wheat Bread', default_qty: 100, default_unit: 'g', calories: 250,
        sodium_mg: 400, glycemic_index: 'High', allergens: ['wheat', 'gluten'],
      })
      const res = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-12', meal_type: 'breakfast', food_id: food.body.id, quantity: 50, unit: 'g',
      })
      expect(res.status).toBe(201)
      expect(res.body.sodium_mg).toBe(200) // scaled by factor 0.5, same as calories/protein etc
      expect(res.body.glycemic_index).toBe('High') // not scaled — a descriptive property, not a quantity
      expect(JSON.parse(res.body.allergens)).toEqual(['wheat', 'gluten'])
    })

    it('POST /api/nutrition/log stores caller-supplied new fields as-is for an ad-hoc entry', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-12', meal_type: 'snack', name: 'Trail mix', quantity: 1, unit: 'serving',
        calories: 200, sodium_mg: 90, sugar_g: 12,
        custom_nutrients: { zinc_mg: 1.2 }, allergens: ['tree nuts'],
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ sodium_mg: 90, sugar_g: 12 })
      expect(JSON.parse(res.body.custom_nutrients)).toEqual({ zinc_mg: 1.2 })
    })

    it('PUT /api/nutrition/log/:id rescales the new numeric fields when quantity changes, same as the original five', async () => {
      const { app } = await import('../../server/index')
      const food = await request(app).post('/api/nutrition/foods').send({
        name: 'Salted Almonds', default_qty: 100, default_unit: 'g', calories: 600, sodium_mg: 300,
      })
      const created = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-13', meal_type: 'snack', food_id: food.body.id, quantity: 100, unit: 'g',
      })
      expect(created.body.sodium_mg).toBe(300)

      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ quantity: 50 })
      expect(res.status).toBe(200)
      expect(res.body.sodium_mg).toBe(150)
    })

    it('POST /api/nutrition/targets stores the new numeric target fields, unaffected kcal auto-sync', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/targets').send({
        date: '2026-06-20', calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65, fiber_g: 25,
        sodium_mg: 2300, vitamin_c_mg: 90,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ calories: 2000, sodium_mg: 2300, vitamin_c_mg: 90 })
    })

    it('GET /api/nutrition/summary aggregates the new numeric fields against the resolved target, same null-handling as the original five', async () => {
      const { app } = await import('../../server/index')
      await request(app).post('/api/nutrition/targets').send({ date: '2026-06-21', sodium_mg: 2300 })
      const food = await request(app).post('/api/nutrition/foods').send({
        name: 'Canned Soup', default_qty: 1, default_unit: 'serving', calories: 100, sodium_mg: 890,
      })
      await request(app).post('/api/nutrition/log').send({
        date: '2026-06-22', meal_type: 'lunch', food_id: food.body.id, quantity: 1, unit: 'serving',
      })
      const res = await request(app).get('/api/nutrition/summary').query({ date: '2026-06-22' })
      expect(res.status).toBe(200)
      expect(res.body.target.sodium_mg).toBe(2300)
      expect(res.body.actual.sodium_mg).toBe(890)
      expect(res.body.remaining.sodium_mg).toBe(2300 - 890)
    })

    it('GET /api/nutrition/trend aggregates the new numeric fields per day, zero-filled for empty days', async () => {
      const { app } = await import('../../server/index')
      const food = await request(app).post('/api/nutrition/foods').send({
        name: 'Trend Sodium Food', default_qty: 1, default_unit: 'serving', calories: 50, sodium_mg: 500,
      })
      const today = new Date().toISOString().slice(0, 10)
      await request(app).post('/api/nutrition/log').send({
        date: today, meal_type: 'lunch', food_id: food.body.id, quantity: 1, unit: 'serving',
      })
      const res = await request(app).get('/api/nutrition/trend').query({ days: 1 })
      expect(res.status).toBe(200)
      expect(res.body.days[0].sodium_mg).toBe(500)
    })

    it('POST /api/nutrition/recipes computes per-serving new numeric fields from the ingredient sum, same rounding as the original five', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/recipes').send({
        name: 'Salty Snack Mix', servings: 2,
        ingredients: [
          { name: 'Pretzels', quantity: 50, unit: 'g', calories: 190, sodium_mg: 450 },
          { name: 'Peanuts', quantity: 30, unit: 'g', calories: 170, sodium_mg: 110 },
        ],
      })
      expect(res.status).toBe(201)
      expect(res.body.food.sodium_mg).toBe(Math.round((450 + 110) / 2))
    })
  })
})
