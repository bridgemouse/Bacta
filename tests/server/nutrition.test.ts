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

async function seedFoodWithVariant(overrides: Partial<{ name: string; serving_qty: number; serving_unit: string; calories: number; protein_g: number }> = {}) {
  const { default: db } = await import('../../server/db/client')
  const foodInfo = db.prepare("INSERT INTO foods (source, name) VALUES ('custom', ?)").run(overrides.name ?? 'Test Oats')
  const variantInfo = db.prepare(`
    INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, calories, protein_g)
    VALUES (?, '100 g', ?, ?, 1, 'custom', ?, ?)
  `).run(
    foodInfo.lastInsertRowid,
    overrides.serving_qty ?? 100, overrides.serving_unit ?? 'g',
    overrides.calories ?? 389, overrides.protein_g ?? 13.2,
  )
  return { foodId: foodInfo.lastInsertRowid as number, variantId: variantInfo.lastInsertRowid as number }
}

describe('Nutrition API', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  describe('GET/POST /api/nutrition/foods and variants', () => {
    it('POST /foods creates a food with its first variant as is_default', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/foods').send({
        name: 'Test Oats', brand: null,
        variant: { label: '100 g', serving_qty: 100, serving_unit: 'g', calories: 389, protein_g: 13.2 },
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ name: 'Test Oats', source: 'custom' })
      expect(res.body.variants).toHaveLength(1)
      expect(res.body.variants[0]).toMatchObject({ label: '100 g', is_default: 1, calories: 389, protein_g: 13.2 })
    })

    it('POST /foods rejects a variant with serving_qty <= 0', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/foods').send({
        name: 'Bad Food', variant: { label: 'bad', serving_qty: 0, serving_unit: 'g' },
      })
      expect(res.status).toBe(400)
    })

    it('GET /foods?q= returns matching foods with nested variants', async () => {
      const { app } = await import('../../server/index')
      await request(app).post('/api/nutrition/foods').send({
        name: 'Findable Bread', variant: { label: '1 slice', serving_qty: 1, serving_unit: 'slice', calories: 80 },
      })
      const res = await request(app).get('/api/nutrition/foods?q=Findable')
      expect(res.status).toBe(200)
      expect(res.body.foods).toHaveLength(1)
      expect(res.body.foods[0].variants[0]).toMatchObject({ label: '1 slice', calories: 80 })
    })

    it('POST /foods/:id/variants adds a non-default variant to an existing food', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/foods').send({
        name: 'Multi-Serving Food', variant: { label: '100 g', serving_qty: 100, serving_unit: 'g', calories: 200 },
      })
      const res = await request(app).post(`/api/nutrition/foods/${created.body.id}/variants`).send({
        label: '1 cup', serving_qty: 1, serving_unit: 'cup', calories: 240,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ label: '1 cup', is_default: 0, food_id: created.body.id })

      const listRes = await request(app).get(`/api/nutrition/foods?q=Multi-Serving`)
      expect(listRes.body.foods[0].variants).toHaveLength(2)
    })

    it('POST /foods/:id/variants 404s for a nonexistent food', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/foods/999999/variants').send({ label: 'x', serving_qty: 1, serving_unit: 'g' })
      expect(res.status).toBe(404)
    })

    it('DELETE /food_variants/:id removes a non-default variant', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/foods').send({
        name: 'Deletable Variant Food', variant: { label: '100 g', serving_qty: 100, serving_unit: 'g' },
      })
      const added = await request(app).post(`/api/nutrition/foods/${created.body.id}/variants`).send({ label: '1 cup', serving_qty: 1, serving_unit: 'cup' })
      const res = await request(app).delete(`/api/nutrition/food_variants/${added.body.id}`)
      expect(res.status).toBe(200)
    })

    it('DELETE /food_variants/:id is blocked (400) when it is the food\'s last remaining variant', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/foods').send({
        name: 'Single Variant Food', variant: { label: '100 g', serving_qty: 100, serving_unit: 'g' },
      })
      const variantId = created.body.variants[0].id
      const res = await request(app).delete(`/api/nutrition/food_variants/${variantId}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/at least one/i)
    })

    it('GET /foods/:id/variants returns a food\'s variant list', async () => {
      const { foodId } = await seedFoodWithVariant()
      const { app } = await import('../../server/index')
      const res = await request(app).get(`/api/nutrition/foods/${foodId}/variants`)
      expect(res.status).toBe(200)
      expect(res.body.variants).toHaveLength(1)
    })

    it('GET /foods/:id/variants 404s for a nonexistent food', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/foods/999999/variants')
      expect(res.status).toBe(404)
    })

    it('GET /foods/barcode/:code returns a matching Open Food Facts food with its variants', async () => {
      const { default: db } = await import('../../server/db/client')
      const foodInfo = db.prepare("INSERT INTO foods (source, source_id, name) VALUES ('openfoodfacts', '111222333', 'Barcode Food')").run()
      db.prepare(`
        INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, calories)
        VALUES (?, '100 g', 100, 'g', 1, 'openfoodfacts', 150)
      `).run(foodInfo.lastInsertRowid)

      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/foods/barcode/111222333')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ name: 'Barcode Food' })
      expect(res.body.variants[0]).toMatchObject({ calories: 150 })
    })

    it('GET /foods/barcode/:code 404s when no food matches', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/foods/barcode/nonexistent')
      expect(res.status).toBe(404)
    })
  })

  describe('Food log CRUD', () => {
    const logDate = '2026-07-01'
    let oatsVariantId: number
    let adHocEntryId: number

    beforeAll(async () => {
      const { variantId } = await seedFoodWithVariant({ name: 'Test Oats', calories: 389, protein_g: 16.9 })
      oatsVariantId = variantId
    })

    it('POST with variant_id + quantity scales macros server-side', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: logDate,
        meal_type: 'breakfast',
        variant_id: oatsVariantId,
        quantity: 2,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        name: 'Test Oats',
        calories: 778,
        protein_g: 33.8,
        unit: 'g',
      })
    })

    it('POST without variant_id stores an ad-hoc entry with caller-supplied macros as-is', async () => {
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

    it('POST with a variant_id that does not exist in food_variants returns 400, not a raw 500', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: logDate,
        meal_type: 'lunch',
        variant_id: 999999,
        quantity: 1,
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

    it('GET ?date= includes food_id (the underlying food, distinct from variant_id) on linked entries, null on ad-hoc', async () => {
      // A date not reused by the later "Targets + summary" block's aggregate-total
      // assertions on logDate (same reasoning as rescaleDate/overrideDate above).
      const foodIdJoinDate = '2026-07-06'
      const { app } = await import('../../server/index')
      const linkedPost = await request(app).post('/api/nutrition/log').send({
        date: foodIdJoinDate, meal_type: 'lunch', variant_id: oatsVariantId, quantity: 1,
      })
      const adHocPost = await request(app).post('/api/nutrition/log').send({
        date: foodIdJoinDate, meal_type: 'lunch', name: 'Ad-hoc side', quantity: 1, unit: 'serving', calories: 50,
      })
      const res = await request(app).get('/api/nutrition/log').query({ date: foodIdJoinDate })
      const entries = res.body.meals.lunch.entries as Array<{ id: number; variant_id: number | null; food_id: number | null }>
      expect(entries.find(e => e.id === linkedPost.body.id)?.food_id).not.toBeNull()
      expect(entries.find(e => e.id === adHocPost.body.id)).toMatchObject({ variant_id: null, food_id: null })
    })

    it('GET ?date= includes the variant\'s label on linked entries, null on ad-hoc — needed so the client can display "2 x 100g" instead of misreading quantity(servings)+unit(bare serving_unit) as a raw amount', async () => {
      const variantLabelDate = '2026-07-07'
      const { app } = await import('../../server/index')
      const linkedPost = await request(app).post('/api/nutrition/log').send({
        date: variantLabelDate, meal_type: 'lunch', variant_id: oatsVariantId, quantity: 2,
      })
      const adHocPost = await request(app).post('/api/nutrition/log').send({
        date: variantLabelDate, meal_type: 'lunch', name: 'Ad-hoc side', quantity: 1, unit: 'serving', calories: 50,
      })
      const res = await request(app).get('/api/nutrition/log').query({ date: variantLabelDate })
      const entries = res.body.meals.lunch.entries as Array<{ id: number; variant_label: string | null }>
      expect(entries.find(e => e.id === linkedPost.body.id)?.variant_label).not.toBeNull()
      expect(entries.find(e => e.id === adHocPost.body.id)?.variant_label).toBeNull()
    })

    it('PUT edits a logged entry', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).put(`/api/nutrition/log/${adHocEntryId}`).send({ calories: 350 })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id: adHocEntryId, calories: 350 })
    })

    it('PUT with a new quantity on a variant-linked entry rescales macros from the entry\'s own prior values', async () => {
      // A separate date from logDate — this block only asserts the created/edited
      // entry's own fields, but reusing logDate elsewhere would pollute the later
      // Targets + summary block's aggregate totals for logDate.
      const rescaleDate = '2026-07-03'
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/log').send({
        date: rescaleDate, meal_type: 'lunch', variant_id: oatsVariantId, quantity: 1,
      })
      expect(created.body.calories).toBe(389) // quantity 1 == exactly one of this variant's servings, factor 1

      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ quantity: 0.5 })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ quantity: 0.5, calories: 194.5, protein_g: 8.45 })
    })

    it('PUT with quantity + one explicit macro override rescales the OTHER macros too, not just the one provided', async () => {
      const overrideDate = '2026-07-05'
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/log').send({
        date: overrideDate, meal_type: 'lunch', variant_id: oatsVariantId, quantity: 1,
      })
      expect(created.body).toMatchObject({ calories: 389, protein_g: 16.9 })

      // Change quantity to 0.5 (would normally halve everything) AND explicitly override
      // calories to a manually-corrected value. protein_g was not explicitly provided, so
      // it must still rescale to the new quantity (halving), not remain stuck at the old
      // quantity=1 value.
      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ quantity: 0.5, calories: 100 })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ quantity: 0.5, calories: 100, protein_g: 8.45 })
    })

    it('POST with an explicit variant_id: null is treated as ad-hoc, not an invalid variant reference', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-04', meal_type: 'snack', variant_id: null,
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

  describe('POST /api/nutrition/log with variant_id', () => {
    it('scales macros from the variant times quantity (quantity = count of that serving)', async () => {
      const { variantId } = await seedFoodWithVariant({ serving_qty: 100, calories: 389, protein_g: 13.2 })
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-20', meal_type: 'breakfast', variant_id: variantId, quantity: 2,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ calories: 778, protein_g: 26.4, unit: 'g', quantity: 2 })
    })

    it('400s for a variant_id that does not reference an existing variant', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({ date: '2026-07-20', meal_type: 'lunch', variant_id: 999999, quantity: 1 })
      expect(res.status).toBe(400)
    })

    it('ad-hoc entries (no variant_id) are unaffected', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-20', meal_type: 'snack', name: 'Handful of nuts', quantity: 1, unit: 'handful', calories: 180,
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ name: 'Handful of nuts', calories: 180 })
    })
  })

  describe('PUT /api/nutrition/log/:id with variant_id', () => {
    it('rescales from the entry\'s own stored quantity/macros on a quantity change, same as before', async () => {
      const { variantId } = await seedFoodWithVariant({ serving_qty: 100, calories: 200, protein_g: 10 })
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/log').send({ date: '2026-07-20', meal_type: 'lunch', variant_id: variantId, quantity: 1 })
      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ quantity: 2 })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ quantity: 2, calories: 400, protein_g: 20 })
    })

    it('switching to a different variant_id re-derives unit and macros from the NEW variant times the current quantity', async () => {
      const { default: db } = await import('../../server/db/client')
      const foodInfo = db.prepare("INSERT INTO foods (source, name) VALUES ('custom', 'Switchable Food')").run()
      const gramsVariant = db.prepare(`
        INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, calories, protein_g)
        VALUES (?, '100 g', 100, 'g', 1, 'custom', 200, 10)
      `).run(foodInfo.lastInsertRowid)
      const cupVariant = db.prepare(`
        INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, calories, protein_g)
        VALUES (?, '1 cup', 1, 'cup', 0, 'custom', 300, 25)
      `).run(foodInfo.lastInsertRowid)

      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-20', meal_type: 'lunch', variant_id: gramsVariant.lastInsertRowid, quantity: 1,
      })
      expect(created.body).toMatchObject({ unit: 'g', calories: 200, protein_g: 10 })

      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({
        variant_id: cupVariant.lastInsertRowid,
      })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        variant_id: Number(cupVariant.lastInsertRowid), unit: 'cup', calories: 300, protein_g: 25,
      })
    })

    it('switching variant_id together with a new quantity scales the new variant\'s macros by that quantity, not the old one\'s', async () => {
      const { default: db } = await import('../../server/db/client')
      const foodInfo = db.prepare("INSERT INTO foods (source, name) VALUES ('custom', 'Switchable Food 2')").run()
      const gramsVariant = db.prepare(`
        INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, calories)
        VALUES (?, '100 g', 100, 'g', 1, 'custom', 200)
      `).run(foodInfo.lastInsertRowid)
      const cupVariant = db.prepare(`
        INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, calories)
        VALUES (?, '1 cup', 1, 'cup', 0, 'custom', 300)
      `).run(foodInfo.lastInsertRowid)

      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-20', meal_type: 'dinner', variant_id: gramsVariant.lastInsertRowid, quantity: 1,
      })
      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({
        variant_id: cupVariant.lastInsertRowid, quantity: 2,
      })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ quantity: 2, calories: 600 })
    })

    it('switching to a variant_id that does not exist returns 400, not a silent no-op', async () => {
      const { variantId } = await seedFoodWithVariant()
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/log').send({ date: '2026-07-20', meal_type: 'lunch', variant_id: variantId, quantity: 1 })
      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ variant_id: 999999 })
      expect(res.status).toBe(400)
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
      expect(res.body.food).toMatchObject({ name: 'Protein Smoothie' })
      expect(res.body.food.variants).toHaveLength(1)
      expect(res.body.food.variants[0]).toMatchObject({
        is_default: 1, label: '1 serving', serving_qty: 1, serving_unit: 'serving',
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

    it('POST /api/nutrition/recipes rejects an ingredient with quantity <= 0 (#165 review finding) -- a persisted zero quantity divides by zero when that ingredient is later rescaled client-side from its baseline', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/recipes').send({
        name: 'Bad Ingredient Recipe', servings: 1,
        ingredients: [{ name: 'X', quantity: 0, unit: 'g', calories: 10 }],
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
      const variantId = created.body.food.variants[0].id
      await request(app).post('/api/nutrition/log').send({
        date: '2026-07-10', meal_type: 'lunch', variant_id: variantId, quantity: 1,
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
      const variantId = created.body.food.variants[0].id

      // this recipe's materialized food has already been logged — editing must not orphan that entry
      const logRes = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-10', meal_type: 'lunch', variant_id: variantId, quantity: 1,
      })

      const updated = await request(app).put(`/api/nutrition/recipes/${recipeId}`).send({
        name: 'Protein Bowl', servings: 2,
        ingredients: [
          { name: 'Chicken breast', quantity: 200, unit: 'g', calories: 330, protein_g: 62, carbs_g: 0, fat_g: 7.2, fiber_g: 0 },
          { name: 'Rice', quantity: 150, unit: 'g', calories: 195, protein_g: 4, carbs_g: 42, fat_g: 0.5, fiber_g: 1 },
        ],
      })
      expect(updated.status).toBe(200)
      expect(updated.body.food.id).toBe(foodId)
      expect(updated.body.food.variants[0]).toMatchObject({ id: variantId, calories: Math.round((330 + 195) / 2) })

      const { default: db } = await import('../../server/db/client')
      // still exactly one foods row for this recipe — updated in place, not duplicated
      expect(db.prepare('SELECT COUNT(*) as n FROM foods WHERE id = ?').get(foodId)).toMatchObject({ n: 1 })
      // the recipe's ingredient rows reflect the new composition
      const ingredients = db.prepare('SELECT name FROM recipe_ingredients WHERE recipe_id = ? ORDER BY id').all(recipeId) as { name: string }[]
      expect(ingredients.map(i => i.name)).toEqual(['Chicken breast', 'Rice'])
      // the earlier log entry still references the same variant and keeps its original snapshot
      const logEntry = db.prepare('SELECT variant_id, calories FROM food_log_entries WHERE id = ?').get(logRes.body.id) as { variant_id: number; calories: number }
      expect(logEntry.variant_id).toBe(variantId)
      expect(logEntry.calories).toBe(165)
    })

    it('PUT /api/nutrition/log/:id rescales a food-linked entry from its OWN prior macros on a quantity edit, not the food\'s current (possibly since-edited) macros', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Protein Smoothie', servings: 2,
        ingredients: [{ name: 'Protein powder', quantity: 1, unit: 'scoop', calories: 300, protein_g: 60, carbs_g: 0, fat_g: 0, fiber_g: 0 }],
      })
      const variantId = created.body.food.variants[0].id
      expect(created.body.food.variants[0].calories).toBe(150) // 300 / 2 servings

      // logged 2 servings while the recipe was still 150 kcal/serving -> 300 kcal stored
      const logRes = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-10', meal_type: 'lunch', variant_id: variantId, quantity: 2,
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

    it('POST /api/nutrition/log rejects a quantity <= 0 (#164 review finding) -- otherwise a zero quantity permanently zeroes a food-linked entry\'s macros with no way to recover them on a later edit', async () => {
      const { variantId } = await seedFoodWithVariant({ name: 'Test Food', calories: 200, protein_g: 10 })
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-10', meal_type: 'lunch', variant_id: variantId, quantity: 0,
      })
      expect(res.status).toBe(400)
    })

    it('PUT /api/nutrition/log/:id rejects an edit that would leave the stored quantity at 0 or below (#164 review finding)', async () => {
      const { variantId } = await seedFoodWithVariant({ calories: 200, protein_g: 10 })
      const { app } = await import('../../server/index')
      const logRes = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-10', meal_type: 'lunch', variant_id: variantId, quantity: 1,
      })
      const res = await request(app).put(`/api/nutrition/log/${logRes.body.id}`).send({ quantity: 0 })
      expect(res.status).toBe(400)
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
      expect(created.body.food.variants[0].sodium_mg).toBe(600) // 1200 / 2 servings

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
      expect(updated.body.food.variants[0].sodium_mg).toBe(1200) // 2400 / 2 servings

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
      const variantId = created.body.food.variants[0].id

      const res = await request(app).put(`/api/nutrition/recipes/${recipeId}`).send({
        name: 'Self Ref Bowl', servings: 2,
        ingredients: [{ variant_id: variantId, name: 'Self Ref Bowl', quantity: 1, unit: 'serving', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0 }],
      })
      expect(res.status).toBe(400)

      const { default: db } = await import('../../server/db/client')
      // rejected — the recipe's ingredient composition must be untouched
      const ingredients = db.prepare('SELECT name FROM recipe_ingredients WHERE recipe_id = ?').all(recipeId) as { name: string }[]
      expect(ingredients.map(i => i.name)).toEqual(['Chicken breast'])
    })
  })

  describe('POST /api/nutrition/recipes with variant_id ingredients', () => {
    it('creates a recipe whose materialized food has exactly one (default) variant', async () => {
      const { variantId } = await seedFoodWithVariant({ calories: 200, protein_g: 10 })
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/recipes').send({
        name: 'Test Recipe', servings: 2,
        ingredients: [{ variant_id: variantId, name: 'Test Oats', quantity: 1, unit: 'g', calories: 200, protein_g: 10 }],
      })
      expect(res.status).toBe(201)
      expect(res.body.food.variants).toHaveLength(1)
      expect(res.body.food.variants[0]).toMatchObject({ is_default: 1, calories: 100 }) // 200/2 servings
    })

    it('PUT /recipes/:id updates ingredients keyed by variant_id', async () => {
      const { variantId } = await seedFoodWithVariant({ calories: 100 })
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Editable Recipe', servings: 1,
        ingredients: [{ variant_id: variantId, name: 'Test Oats', quantity: 1, unit: 'g', calories: 100 }],
      })
      const res = await request(app).put(`/api/nutrition/recipes/${created.body.id}`).send({
        name: 'Editable Recipe', servings: 2,
        ingredients: [{ variant_id: variantId, name: 'Test Oats', quantity: 1, unit: 'g', calories: 100 }],
      })
      expect(res.status).toBe(200)
      expect(res.body.food.variants[0].calories).toBe(50) // 100/2 servings
    })

    it('GET /recipes/:id returns ingredients with variant_id, not food_id', async () => {
      const { variantId } = await seedFoodWithVariant({ calories: 100 })
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Composition Recipe', servings: 1,
        ingredients: [{ variant_id: variantId, name: 'Test Oats', quantity: 1, unit: 'g', calories: 100 }],
      })
      const res = await request(app).get(`/api/nutrition/recipes/${created.body.id}`)
      expect(res.body.ingredients[0]).toMatchObject({ variant_id: variantId })
      expect(res.body.ingredients[0].food_id).toBeUndefined()
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

    it('GET /api/nutrition/log/recent includes food_id (the underlying food, distinct from variant_id) on linked entries, null on ad-hoc', async () => {
      const { variantId, foodId } = await seedFoodWithVariant({ name: 'Recent Join Test Food' })
      const { app } = await import('../../server/index')
      await request(app).post('/api/nutrition/log').send({
        date: '2026-07-08', meal_type: 'dinner', variant_id: variantId, quantity: 1,
      })
      const res = await request(app).get('/api/nutrition/log/recent').query({ limit: 20 })
      const entries = res.body.entries as Array<{ name: string; variant_id: number | null; food_id: number | null }>
      const linked = entries.find(e => e.name === 'Recent Join Test Food')
      expect(linked?.food_id).toBe(foodId)
      const salmon = entries.find(e => e.name === 'Salmon bowl')
      expect(salmon).toMatchObject({ variant_id: null, food_id: null })
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
        name: 'Peanut Butter',
        variant: {
          label: '32 g', serving_qty: 32, serving_unit: 'g', calories: 190,
          sodium_mg: 140, sugar_g: 3, saturated_fat_g: 3.5, cholesterol_mg: 0,
          glycemic_index: 'Low',
          custom_nutrients: { manganese_mg: 0.6 },
          allergens: ['peanuts'],
          traces: ['tree nuts'],
        },
      })
      expect(res.status).toBe(201)
      const variant = res.body.variants[0]
      expect(variant).toMatchObject({
        sodium_mg: 140, sugar_g: 3, saturated_fat_g: 3.5, cholesterol_mg: 0, glycemic_index: 'Low',
      })
      expect(JSON.parse(variant.custom_nutrients)).toEqual({ manganese_mg: 0.6 })
      expect(JSON.parse(variant.allergens)).toEqual(['peanuts'])
      expect(JSON.parse(variant.traces)).toEqual(['tree nuts'])
    })

    it('a food saved without the new fields returns null for them, not 0 or []', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/foods').send({
        name: 'Plain Rice',
        variant: { label: '100 g', serving_qty: 100, serving_unit: 'g', calories: 130 },
      })
      expect(res.status).toBe(201)
      const variant = res.body.variants[0]
      expect(variant.sodium_mg).toBeNull()
      expect(variant.custom_nutrients).toBeNull()
      expect(variant.allergens).toBeNull()
      expect(variant.glycemic_index).toBeNull()
    })

    it('POST /api/nutrition/log scales the new numeric fields from the linked food, and passes through non-scalable fields (glycemic_index/allergens) unchanged', async () => {
      const { app } = await import('../../server/index')
      const food = await request(app).post('/api/nutrition/foods').send({
        name: 'Wheat Bread',
        variant: {
          label: '100 g', serving_qty: 100, serving_unit: 'g', calories: 250,
          sodium_mg: 400, glycemic_index: 'High', allergens: ['wheat', 'gluten'],
        },
      })
      const variantId = food.body.variants[0].id
      const res = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-12', meal_type: 'breakfast', variant_id: variantId, quantity: 0.5,
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
        name: 'Salted Almonds',
        variant: { label: '100 g', serving_qty: 100, serving_unit: 'g', calories: 600, sodium_mg: 300 },
      })
      const variantId = food.body.variants[0].id
      const created = await request(app).post('/api/nutrition/log').send({
        date: '2026-07-13', meal_type: 'snack', variant_id: variantId, quantity: 1,
      })
      expect(created.body.sodium_mg).toBe(300)

      const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ quantity: 0.5 })
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
        name: 'Canned Soup',
        variant: { label: '1 serving', serving_qty: 1, serving_unit: 'serving', calories: 100, sodium_mg: 890 },
      })
      const variantId = food.body.variants[0].id
      await request(app).post('/api/nutrition/log').send({
        date: '2026-06-22', meal_type: 'lunch', variant_id: variantId, quantity: 1,
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
        name: 'Trend Sodium Food',
        variant: { label: '1 serving', serving_qty: 1, serving_unit: 'serving', calories: 50, sodium_mg: 500 },
      })
      const variantId = food.body.variants[0].id
      // Local calendar date, matching the server's own localDateString() convention
      // (see the "GET /api/nutrition/trend" describe block above) — a naive
      // toISOString() UTC date can be a day ahead of the server's "today" in the
      // evening EST hours, which is exactly the flake this sidesteps.
      const today = new Date().toLocaleDateString('en-CA')
      await request(app).post('/api/nutrition/log').send({
        date: today, meal_type: 'lunch', variant_id: variantId, quantity: 1,
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
      expect(res.body.food.variants[0].sodium_mg).toBe(Math.round((450 + 110) / 2))
    })
  })
})
