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
})
