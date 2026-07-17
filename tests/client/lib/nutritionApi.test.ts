import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchLog,
  fetchRecentEntries,
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
  deleteRecipe,
  lookupFoodByBarcode,
  estimateMealFromPhoto,
  widenedNutrientFields,
  fetchRecipe,
  updateRecipe,
  type FoodLogEntry
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

  it('fetchRecentEntries calls GET /api/nutrition/log/recent with the limit and returns entries', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ entries: [{ id: 1, name: 'Oats' }] }) })
    const result = await fetchRecentEntries(4)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log/recent?limit=4')
    expect(result[0].name).toBe('Oats')
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

  it('lookupFoodByBarcode GETs the barcode lookup route and returns the matched food', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 5, name: 'Cheerios' }) })
    const result = await lookupFoodByBarcode('0016000275287')
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/foods/barcode/0016000275287')
    expect(result).toMatchObject({ name: 'Cheerios' })
  })

  it('lookupFoodByBarcode returns null (not a throw) on a 404 — no match, caller falls back to ad-hoc', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    const result = await lookupFoodByBarcode('9999999999999')
    expect(result).toBeNull()
  })

  it('estimateMealFromPhoto POSTs the image and returns the parsed macro estimate', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ name: 'Burrito bowl', calories: 650 }) })
    const result = await estimateMealFromPhoto('base64data', 'image/jpeg')
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/scan/meal-photo', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ image: 'base64data', mediaType: 'image/jpeg' }),
    }))
    expect(result).toMatchObject({ name: 'Burrito bowl', calories: 650 })
  })

  it('estimateMealFromPhoto throws with the server error message on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Could not estimate meal from photo' }) })
    await expect(estimateMealFromPhoto('base64data', 'image/jpeg')).rejects.toThrow('Could not estimate meal from photo')
  })

  it('widenedNutrientFields carries the widened nutrient set forward from a FoodLogEntry, defaulting missing fields to null', () => {
    const entry = {
      id: 1, meal_type: 'lunch', food_id: null, name: 'Canned soup', quantity: 1, unit: 'serving',
      calories: 200, protein_g: 5, carbs_g: 20, fat_g: 8, fiber_g: 2, logged_at: '2026-07-10T12:00:00Z',
      sodium_mg: 890, allergens: JSON.stringify(['dairy']),
    } as unknown as FoodLogEntry
    const result = widenedNutrientFields(entry)
    expect(result.sodium_mg).toBe(890)
    expect(result.allergens).toBe(JSON.stringify(['dairy']))
    // fields absent on the source entry must default to null, not be omitted —
    // omitting them would mean "don't touch" on a PUT, but here they're being set on
    // a brand-new entry via POST, where an omitted key and an explicit null are only
    // equivalent for creation, not for copy/re-log call sites reusing this helper.
    expect(result.sugar_g).toBeNull()
    expect(result.glycemic_index).toBeNull()
  })

  it('fetchRecipe GETs a single recipe by id, including its ingredients', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, name: 'Smoothie', servings: 2, food_id: 2, ingredients: [{ name: 'Banana', quantity: 1, unit: 'each' }] }),
    })
    const result = await fetchRecipe(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/recipes/1')
    expect(result.ingredients).toHaveLength(1)
  })

  it('fetchRecipe throws on a non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Recipe not found' }) })
    await expect(fetchRecipe(999)).rejects.toThrow('Recipe not found')
  })

  it('updateRecipe PUTs name/servings/ingredients and returns the updated recipe+food', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1, food: { id: 2, calories: 200 } }) })
    const input = { name: 'Smoothie', servings: 3, ingredients: [{ name: 'Banana', quantity: 1, unit: 'each' }] }
    const result = await updateRecipe(1, input)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/recipes/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify(input)
    }))
    expect(result.food.calories).toBe(200)
  })

  it('updateRecipe surfaces the server error message on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Could not update recipe' }) })
    await expect(updateRecipe(1, { name: 'X', servings: 1, ingredients: [] }))
      .rejects.toThrow('Could not update recipe')
  })
})
