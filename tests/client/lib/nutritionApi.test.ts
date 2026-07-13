import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchLog, createLogEntry, deleteLogEntry, fetchSummary, searchFoods, createRecipe } from '../../../client/src/lib/nutritionApi'

const mockFetch = vi.fn()

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('nutritionApi', () => {
  it('fetchLog calls GET /api/nutrition/log with the date and returns the parsed body', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ meals: {}, daily: { calories: 0 } }) })
    const result = await fetchLog('2026-07-13')
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log?date=2026-07-13')
    expect(result.daily.calories).toBe(0)
  })

  it('fetchLog throws on a non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(fetchLog('2026-07-13')).rejects.toThrow()
  })

  it('createLogEntry POSTs the entry and returns the created row', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1, name: 'Oats' }) })
    const result = await createLogEntry({ date: '2026-07-13', meal_type: 'breakfast', quantity: 1, unit: 'serving' })
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log', expect.objectContaining({ method: 'POST' }))
    expect(result.name).toBe('Oats')
  })

  it('createLogEntry surfaces the server error message on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Unit mismatch' }) })
    await expect(createLogEntry({ date: '2026-07-13', meal_type: 'breakfast', quantity: 1, unit: 'oz' }))
      .rejects.toThrow('Unit mismatch')
  })

  it('deleteLogEntry calls DELETE on the entry id', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await deleteLogEntry(42)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log/42', expect.objectContaining({ method: 'DELETE' }))
  })

  it('fetchSummary returns target/actual/remaining', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ target: null, actual: {}, remaining: {} }) })
    const result = await fetchSummary('2026-07-13')
    expect(result.target).toBeNull()
  })

  it('searchFoods returns an empty array on a non-ok response instead of throwing', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await searchFoods('oat')
    expect(result).toEqual([])
  })

  it('createRecipe POSTs name/servings/ingredients and returns the created recipe+food', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1, food: { id: 2 } }) })
    const result = await createRecipe({ name: 'Smoothie', servings: 2, ingredients: [{ name: 'Banana', quantity: 1, unit: 'each' }] })
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/recipes', expect.objectContaining({ method: 'POST' }))
    expect(result.food.id).toBe(2)
  })
})
