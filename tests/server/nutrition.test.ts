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
})
