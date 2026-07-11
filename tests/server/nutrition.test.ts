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
})
