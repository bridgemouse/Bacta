import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

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

    it('PUT /api/nutrition/recipes/:id returns 404 for a nonexistent recipe', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).put('/api/nutrition/recipes/999999').send({
        name: 'X', servings: 1, ingredients: [{ name: 'X', quantity: 1, unit: 'g', calories: 10 }],
      })
      expect(res.status).toBe(404)
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
      // but DIFFERENT calories to test the deterministic tiebreaker
      const sameTimestamp = '2026-07-12 12:00:00'
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
  })
})
