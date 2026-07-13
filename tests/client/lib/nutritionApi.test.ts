import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchLog,
  createLogEntry,
  updateLogEntry,
  deleteLogEntry,
  fetchTargets,
  saveTargets,
  fetchSummary,
  searchFoods,
  createFood,
  deleteFood,
  createRecipe,
  fetchRecipes,
  deleteRecipe
} from '../../../client/src/lib/nutritionApi'

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
    const input = { date: '2026-07-13', meal_type: 'breakfast', quantity: 1, unit: 'serving' }
    const result = await createLogEntry(input)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(input)
    }))
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

  it('updateLogEntry PUTs the partial update and returns the updated row', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1, name: 'Oats (updated)' }) })
    const input = { quantity: 2 }
    const result = await updateLogEntry(1, input)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify(input)
    }))
    expect(result.name).toBe('Oats (updated)')
  })

  it('updateLogEntry surfaces the server error message on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Entry not found' }) })
    await expect(updateLogEntry(999, { quantity: 2 }))
      .rejects.toThrow('Entry not found')
  })

  it('fetchTargets returns the parsed target for a given date', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ date: '2026-07-13', calories: 2000, protein_g: 150 }) })
    const result = await fetchTargets('2026-07-13')
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/targets?date=2026-07-13')
    expect(result.calories).toBe(2000)
  })

  it('fetchTargets throws on a non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(fetchTargets('2026-07-13')).rejects.toThrow()
  })

  it('saveTargets POSTs the targets and returns the saved row', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ date: '2026-07-13', calories: 2000, protein_g: 150 }) })
    const input = { date: '2026-07-13', calories: 2000, protein_g: 150 }
    const result = await saveTargets(input)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/targets', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(input)
    }))
    expect(result.calories).toBe(2000)
  })

  it('saveTargets surfaces the server error message on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Invalid target values' }) })
    await expect(saveTargets({ date: '2026-07-13', calories: -1 }))
      .rejects.toThrow('Invalid target values')
  })

  it('createFood POSTs the food and returns the created row', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 5, name: 'Banana', source: 'custom' }) })
    const input = { name: 'Banana', default_qty: 1, default_unit: 'medium', calories: 105 }
    const result = await createFood(input)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/foods', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(input)
    }))
    expect(result.name).toBe('Banana')
  })

  it('createFood surfaces the server error message on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Food already exists' }) })
    await expect(createFood({ name: 'Banana', default_qty: 1, default_unit: 'medium' }))
      .rejects.toThrow('Food already exists')
  })

  it('deleteFood calls DELETE on the food id', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await deleteFood(5)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/foods/5', expect.objectContaining({ method: 'DELETE' }))
  })

  it('deleteFood surfaces the server error message on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Food has log entries' }) })
    await expect(deleteFood(5))
      .rejects.toThrow('Food has log entries')
  })

  it('fetchRecipes returns the parsed recipes array', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ recipes: [{ id: 1, name: 'Smoothie' }] }) })
    const result = await fetchRecipes()
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/recipes')
    expect(result).toEqual([{ id: 1, name: 'Smoothie' }])
  })

  it('fetchRecipes returns an empty array on a non-ok response instead of throwing', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await fetchRecipes()
    expect(result).toEqual([])
  })

  it('deleteRecipe calls DELETE on the recipe id', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await deleteRecipe(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/recipes/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('deleteRecipe surfaces the server error message on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Recipe not found' }) })
    await expect(deleteRecipe(999))
      .rejects.toThrow('Recipe not found')
  })

  it('createRecipe POSTs name/servings/ingredients and returns the created recipe+food', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1, food: { id: 2 } }) })
    const input = { name: 'Smoothie', servings: 2, ingredients: [{ name: 'Banana', quantity: 1, unit: 'each' }] }
    const result = await createRecipe(input)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/recipes', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(input)
    }))
    expect(result.food.id).toBe(2)
  })
})
