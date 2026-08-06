import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NutritionLibrary } from '../../../../client/src/pages/nutrition/NutritionLibrary'

vi.mock('../../../../client/src/lib/nutritionApi', () => ({
  searchFoods: vi.fn(), deleteFood: vi.fn(), fetchRecipes: vi.fn(), deleteRecipe: vi.fn(), createFood: vi.fn(), createRecipe: vi.fn(),
  fetchRecipe: vi.fn(), updateRecipe: vi.fn(), addFoodVariant: vi.fn(), deleteFoodVariant: vi.fn(),
}))

import { searchFoods, deleteFood, fetchRecipes, deleteRecipe, createFood, createRecipe, fetchRecipe, updateRecipe, addFoodVariant, deleteFoodVariant } from '../../../../client/src/lib/nutritionApi'
const mockSearchFoods = searchFoods as ReturnType<typeof vi.fn>
const mockDeleteFood = deleteFood as ReturnType<typeof vi.fn>
const mockFetchRecipes = fetchRecipes as ReturnType<typeof vi.fn>
const mockDeleteRecipe = deleteRecipe as ReturnType<typeof vi.fn>
const mockCreateFood = createFood as ReturnType<typeof vi.fn>
const mockCreateRecipe = createRecipe as ReturnType<typeof vi.fn>
const mockFetchRecipe = fetchRecipe as ReturnType<typeof vi.fn>
const mockUpdateRecipe = updateRecipe as ReturnType<typeof vi.fn>
const mockAddFoodVariant = addFoodVariant as ReturnType<typeof vi.fn>
const mockDeleteFoodVariant = deleteFoodVariant as ReturnType<typeof vi.fn>

const oats = { id: 1, source: 'custom', name: 'Test Oats', brand: null, variants: [
  { id: 100, food_id: 1, label: '100 g', serving_qty: 100, serving_unit: 'g', is_default: 1, source: 'custom', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 },
] }
const multiOats = { id: 1, source: 'custom', name: 'Test Oats', brand: null, variants: [
  { id: 100, food_id: 1, label: '100 g', serving_qty: 100, serving_unit: 'g', is_default: 1, source: 'custom', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 },
  { id: 101, food_id: 1, label: '1 cup', serving_qty: 1, serving_unit: 'cup', is_default: 0, source: 'custom', calories: 300, protein_g: 12, carbs_g: 50, fat_g: 5, fiber_g: 8 },
] }
const smoothie = { id: 2, name: 'Protein Smoothie', servings: 2, food_id: 9, ingredient_count: 2, per_serving_calories: 113, per_serving_protein_g: 25, per_serving_carbs_g: 15, per_serving_fat_g: 0.5, per_serving_fiber_g: 1.5 }

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchFoods.mockResolvedValue([oats])
  mockFetchRecipes.mockResolvedValue([smoothie])
})

describe('NutritionLibrary — list', () => {
  it('lists foods and recipes with counts in the rail', async () => {
    render(<NutritionLibrary />)
    expect(await screen.findByText('Test Oats')).toBeInTheDocument()
    expect(screen.getByText('Protein Smoothie')).toBeInTheDocument()
    expect(screen.getByText('1 FOODS · 1 RECIPES')).toBeInTheDocument()
  })

  it('shows recipe ingredient count and per-serving kcal', async () => {
    render(<NutritionLibrary />)
    expect(await screen.findByText('2 ingredients · 2 servings · 113 kcal / serving')).toBeInTheDocument()
  })

  it('deleting a food calls deleteFood and reloads the list', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    mockSearchFoods.mockResolvedValue([])
    await user.click(screen.getByLabelText('Delete Test Oats'))
    await waitFor(() => expect(mockDeleteFood).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('Test Oats')).not.toBeInTheDocument())
  })

  it('deleting a recipe calls deleteRecipe and reloads the list', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Protein Smoothie')
    mockFetchRecipes.mockResolvedValue([])
    await user.click(screen.getByLabelText('Delete Protein Smoothie'))
    await waitFor(() => expect(mockDeleteRecipe).toHaveBeenCalledWith(2))
    await waitFor(() => expect(screen.queryByText('Protein Smoothie')).not.toBeInTheDocument())
  })

  it('shows the empty state when there are no foods or recipes', async () => {
    mockSearchFoods.mockResolvedValue([])
    mockFetchRecipes.mockResolvedValue([])
    render(<NutritionLibrary />)
    expect(await screen.findByText('NO SAVED FOODS YET')).toBeInTheDocument()
  })
})

describe('NutritionLibrary — delete a food variant (#195)', () => {
  it('expanding a multi-serving food shows each variant with a delete action, calling deleteFoodVariant and reloading', async () => {
    mockSearchFoods.mockResolvedValue([multiOats])
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')

    await user.click(screen.getByLabelText('Show all servings for Test Oats'))
    expect(await screen.findByLabelText('Delete serving 1 cup of Test Oats')).toBeInTheDocument()

    mockDeleteFoodVariant.mockResolvedValue(undefined)
    mockSearchFoods.mockResolvedValue([oats]) // reload reflects the variant now gone
    await user.click(screen.getByLabelText('Delete serving 1 cup of Test Oats'))

    await waitFor(() => expect(mockDeleteFoodVariant).toHaveBeenCalledWith(101))
    await waitFor(() => expect(screen.queryByLabelText('Delete serving 1 cup of Test Oats')).not.toBeInTheDocument())
  })

  it('does not remove the variant row when the server rejects the delete (last-variant or in-use guard)', async () => {
    mockSearchFoods.mockResolvedValue([multiOats])
    mockDeleteFoodVariant.mockRejectedValue(new Error('Cannot delete — this variant has been logged or used in a recipe'))
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')

    await user.click(screen.getByLabelText('Show all servings for Test Oats'))
    await user.click(await screen.findByLabelText('Delete serving 1 cup of Test Oats'))

    await waitFor(() => expect(mockDeleteFoodVariant).toHaveBeenCalledWith(101))
    // rejected — mockSearchFoods was never told to drop the variant, so the row must still be there
    expect(screen.getByLabelText('Delete serving 1 cup of Test Oats')).toBeInTheDocument()
  })

  it('does not show a per-variant delete action for a food with only one serving', async () => {
    mockSearchFoods.mockResolvedValue([oats])
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    expect(screen.queryByLabelText(/Delete serving/)).not.toBeInTheDocument()
  })
})

describe('NutritionLibrary — new food', () => {
  it('+ NEW FOOD switches to the new-food form', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW FOOD'))
    expect(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY')).toBeInTheDocument()
  })

  it('saving a new food calls createFood and returns to the list', async () => {
    mockCreateFood.mockResolvedValue({ id: 5, name: 'Greek Yogurt', variants: [{ id: 50, label: '170 g', is_default: 1 }] })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW FOOD'))
    await user.type(screen.getByLabelText('Food name'), 'Greek Yogurt')
    await user.type(screen.getByLabelText('Default quantity'), '170')
    await user.type(screen.getByLabelText('Default unit'), 'g')
    await user.click(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY'))
    await waitFor(() => expect(mockCreateFood).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Greek Yogurt', variant: expect.objectContaining({ label: '170 g', serving_qty: 170, serving_unit: 'g' }),
    })))
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument() // back on the list screen
  })

  it('NewFoodForm submits a single default variant', async () => {
    mockCreateFood.mockResolvedValue({ id: 5, name: 'Greek Yogurt', variants: [{ id: 50, label: '170 g', is_default: 1 }] })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW FOOD'))
    await user.type(screen.getByLabelText('Food name'), 'Greek Yogurt')
    await user.type(screen.getByLabelText('Default quantity'), '170')
    await user.type(screen.getByLabelText('Default unit'), 'g')
    await user.click(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY'))
    await waitFor(() => expect(mockCreateFood).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Greek Yogurt', variant: expect.objectContaining({ label: '170 g', serving_qty: 170, serving_unit: 'g' }),
    })))
  })

  it('food list shows the default variant\'s macros', async () => {
    render(<NutritionLibrary />)
    expect(await screen.findByText(/per 100 g · 389 kcal/)).toBeInTheDocument()
  })

  it('+ ADD SERVING adds another variant to an existing food', async () => {
    mockAddFoodVariant.mockResolvedValue({ id: 101, label: '1 cup', is_default: 0 })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByLabelText('Add serving to Test Oats'))
    await user.type(screen.getByLabelText('New serving label'), '1 cup')
    await user.type(screen.getByLabelText('New serving quantity'), '1')
    await user.type(screen.getByLabelText('New serving unit'), 'cup')
    await user.click(screen.getByText('SAVE SERVING'))
    await waitFor(() => expect(mockAddFoodVariant).toHaveBeenCalledWith(1, expect.objectContaining({ label: '1 cup', serving_qty: 1, serving_unit: 'cup' })))
  })

  it('‹ BACK TO LIBRARY returns without saving', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW FOOD'))
    await user.click(screen.getByText('‹ BACK TO LIBRARY'))
    expect(mockCreateFood).not.toHaveBeenCalled()
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument()
  })

  it('appends the created food to the list directly, with no extra searchFoods call', async () => {
    const newFood = { id: 5, source: 'custom', name: 'Greek Yogurt', brand: null, variants: [
      { id: 50, food_id: 5, label: '170 g', serving_qty: 170, serving_unit: 'g', is_default: 1, source: 'custom', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0, fiber_g: 0 },
    ] }
    mockCreateFood.mockResolvedValue(newFood)
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    mockSearchFoods.mockClear() // only the initial list-mount call should be counted so far

    await user.click(screen.getByText('+ NEW FOOD'))
    await user.type(screen.getByLabelText('Food name'), 'Greek Yogurt')
    await user.type(screen.getByLabelText('Default quantity'), '170')
    await user.type(screen.getByLabelText('Default unit'), 'g')
    await user.click(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY'))

    expect(await screen.findByText('Greek Yogurt')).toBeInTheDocument()
    expect(screen.getByText('Test Oats')).toBeInTheDocument() // original list entry still present
    expect(mockSearchFoods).not.toHaveBeenCalled() // no re-fetch of the whole list
  })

  it('inserts the appended food in alphabetical order, not always at the end of the list', async () => {
    // "Apple Slices" sorts before "Test Oats" — a naive append would put it after
    mockCreateFood.mockResolvedValue({ id: 5, source: 'custom', name: 'Apple Slices', brand: null, variants: [
      { id: 51, food_id: 5, label: '1 each', serving_qty: 1, serving_unit: 'each', is_default: 1, source: 'custom', calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, fiber_g: 4.4 },
    ] })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')

    await user.click(screen.getByText('+ NEW FOOD'))
    await user.type(screen.getByLabelText('Food name'), 'Apple Slices')
    await user.type(screen.getByLabelText('Default quantity'), '1')
    await user.type(screen.getByLabelText('Default unit'), 'each')
    await user.click(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY'))

    const apple = await screen.findByText('Apple Slices')
    const oats = screen.getByText('Test Oats')
    // DOCUMENT_POSITION_FOLLOWING means `oats` comes after `apple` in the DOM
    expect(apple.compareDocumentPosition(oats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('NutritionLibrary — new recipe', () => {
  it('+ NEW RECIPE switches to the new-recipe form', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    expect(screen.getByLabelText('Recipe name')).toBeInTheDocument()
  })

  it('adding an ingredient from saved foods prefills quantity, unit, and calories', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))
    expect(screen.getByText('389 kcal')).toBeInTheDocument()
  })

  it('+ AD-HOC INGREDIENT adds a blank editable row', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.click(screen.getByText('+ AD-HOC INGREDIENT'))
    expect(screen.getByLabelText('Ingredient 0 quantity')).toBeInTheDocument()
  })

  it('removing an ingredient removes its row', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.click(screen.getByText('+ AD-HOC INGREDIENT'))
    await user.click(screen.getByLabelText('Remove ingredient 0'))
    expect(screen.queryByLabelText('Ingredient 0 quantity')).not.toBeInTheDocument()
  })

  it('shows a live RECIPE TOTAL / PER SERVING kcal summary', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Servings'), '2')
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))
    expect(screen.getByText(/RECIPE TOTAL 389 kcal · PER SERVING 195 kcal/)).toBeInTheDocument()
  })

  it('SAVE RECIPE calls createRecipe with name, servings, and the current ingredient rows', async () => {
    mockCreateFood.mockResolvedValue({}) // unused here, just avoiding an unrelated unmocked call
    mockCreateRecipe.mockResolvedValue({ id: 1, food: { id: 2 } })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Recipe name'), 'Oat Bowl')
    await user.type(screen.getByLabelText('Servings'), '2')
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.click(screen.getByText('SAVE RECIPE'))

    await waitFor(() => expect(mockCreateRecipe).toHaveBeenCalledWith({
      name: 'Oat Bowl',
      servings: 2,
      ingredients: [{
        variant_id: 100, name: 'Test Oats', quantity: 100, unit: 'g',
        calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6,
      }],
    }))
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument() // back on the list screen
  })

  it('appends the created recipe to the list directly, with no extra fetchRecipes call', async () => {
    mockCreateRecipe.mockResolvedValue({
      id: 3, name: 'Oat Bowl', servings: 2,
      food: { id: 10, variants: [{ id: 200, is_default: 1, calories: 195, protein_g: 8.45, carbs_g: 33.15, fat_g: 3.45, fiber_g: 5.3 }] },
    })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Protein Smoothie')
    mockFetchRecipes.mockClear() // only the initial list-mount call should be counted so far

    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Recipe name'), 'Oat Bowl')
    await user.type(screen.getByLabelText('Servings'), '2')
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.click(screen.getByText('SAVE RECIPE'))

    expect(await screen.findByText('Oat Bowl')).toBeInTheDocument()
    expect(screen.getByText('Protein Smoothie')).toBeInTheDocument() // original list entry still present
    expect(mockFetchRecipes).not.toHaveBeenCalled() // no re-fetch of the whole list
  })

  it('inserts the appended recipe in alphabetical order, not always at the end of the list', async () => {
    // "Oat Bowl" sorts before "Protein Smoothie" — a naive append would put it after
    mockCreateRecipe.mockResolvedValue({
      id: 3, name: 'Oat Bowl', servings: 2,
      food: { id: 10, variants: [{ id: 200, is_default: 1, calories: 195, protein_g: 8.45, carbs_g: 33.15, fat_g: 3.45, fiber_g: 5.3 }] },
    })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Protein Smoothie')

    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Recipe name'), 'Oat Bowl')
    await user.type(screen.getByLabelText('Servings'), '2')
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.click(screen.getByText('SAVE RECIPE'))

    const oatBowl = await screen.findByText('Oat Bowl')
    const smoothie = screen.getByText('Protein Smoothie')
    expect(oatBowl.compareDocumentPosition(smoothie) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('SAVE RECIPE is blocked if servings is not filled in', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Recipe name'), 'Oat Bowl')
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))
    // Don't fill in Servings
    await user.click(screen.getByText('SAVE RECIPE'))

    // createRecipe should NOT have been called
    await waitFor(() => expect(mockCreateRecipe).not.toHaveBeenCalled())
  })

  it('ad-hoc ingredient name and unit are editable inputs', async () => {
    mockCreateRecipe.mockResolvedValue({ id: 1, food: { id: 2 } })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Recipe name'), 'Custom Mix')
    await user.type(screen.getByLabelText('Servings'), '1')
    await user.click(screen.getByText('+ AD-HOC INGREDIENT'))
    await user.type(screen.getByLabelText('Ingredient 0 name'), 'Honey')
    const unitInput = screen.getByLabelText('Ingredient 0 unit')
    await user.clear(unitInput)
    await user.type(unitInput, 'tbsp')
    const qtyInput = screen.getByLabelText('Ingredient 0 quantity')
    await user.clear(qtyInput)
    await user.type(qtyInput, '2')
    await user.click(screen.getByText('SAVE RECIPE'))

    await waitFor(() => expect(mockCreateRecipe).toHaveBeenCalledWith({
      name: 'Custom Mix',
      servings: 1,
      ingredients: [{
        variant_id: undefined, name: 'Honey', quantity: 2, unit: 'tbsp',
        calories: undefined, protein_g: undefined, carbs_g: undefined, fat_g: undefined, fiber_g: undefined,
      }],
    }))
  })

  it('editing a food-linked ingredient quantity rescales its macros, not just the quantity', async () => {
    mockCreateRecipe.mockResolvedValue({ id: 1, food: { id: 2 } })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Recipe name'), 'Double Oats')
    await user.type(screen.getByLabelText('Servings'), '1')
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))

    const qtyInput = screen.getByLabelText('Ingredient 0 quantity')
    await user.clear(qtyInput)
    await user.type(qtyInput, '200') // double the food's default_qty of 100g

    // Displayed kcal for the row and the RECIPE TOTAL must both reflect the doubled quantity,
    // not the stale calories captured when the ingredient was first added.
    expect(screen.getByText('778 kcal')).toBeInTheDocument()
    expect(screen.getByText(/RECIPE TOTAL 778 kcal · PER SERVING 778 kcal/)).toBeInTheDocument()

    await user.click(screen.getByText('SAVE RECIPE'))
    await waitFor(() => expect(mockCreateRecipe).toHaveBeenCalledWith(expect.objectContaining({
      ingredients: [expect.objectContaining({
        quantity: 200, calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2,
      })],
    })))
  })

  it('ad-hoc ingredient macros are editable and contribute to the RECIPE TOTAL', async () => {
    mockCreateRecipe.mockResolvedValue({ id: 1, food: { id: 2 } })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Recipe name'), 'Honey Toast')
    await user.type(screen.getByLabelText('Servings'), '1')
    await user.click(screen.getByText('+ AD-HOC INGREDIENT'))
    await user.type(screen.getByLabelText('Ingredient 0 name'), 'Honey')
    await user.type(screen.getByLabelText('Ingredient 0 calories'), '64')
    await user.type(screen.getByLabelText('Ingredient 0 carbs_g'), '17')

    expect(screen.getByText(/RECIPE TOTAL 64 kcal · PER SERVING 64 kcal/)).toBeInTheDocument()

    await user.click(screen.getByText('SAVE RECIPE'))
    await waitFor(() => expect(mockCreateRecipe).toHaveBeenCalledWith(expect.objectContaining({
      ingredients: [expect.objectContaining({ name: 'Honey', calories: 64, carbs_g: 17, protein_g: undefined })],
    })))
  })
})

describe('NutritionLibrary — edit recipe', () => {
  beforeEach(() => {
    mockFetchRecipe.mockResolvedValue({
      id: 2, name: 'Protein Smoothie', servings: 2, food_id: 9,
      ingredients: [
        { variant_id: 100, name: 'Test Oats', quantity: 100, unit: 'g', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 },
      ],
    })
  })

  it('EDIT switches to the recipe form prefilled via fetchRecipe', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Protein Smoothie')
    await user.click(screen.getByLabelText('Edit Protein Smoothie'))

    await waitFor(() => expect(mockFetchRecipe).toHaveBeenCalledWith(2))
    expect(await screen.findByDisplayValue('Protein Smoothie')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument() // servings
    expect(screen.getByText('Test Oats')).toBeInTheDocument() // prefilled ingredient
    expect(screen.getByText('SAVE CHANGES')).toBeInTheDocument()
  })

  it('SAVE CHANGES calls updateRecipe with the recipe id and current fields, then returns to the list', async () => {
    mockUpdateRecipe.mockResolvedValue({ id: 2, food: { id: 9 } })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Protein Smoothie')
    await user.click(screen.getByLabelText('Edit Protein Smoothie'))
    await screen.findByDisplayValue('Protein Smoothie')

    await user.click(screen.getByText('SAVE CHANGES'))

    await waitFor(() => expect(mockUpdateRecipe).toHaveBeenCalledWith(2, {
      name: 'Protein Smoothie',
      servings: 2,
      ingredients: [{
        variant_id: 100, name: 'Test Oats', quantity: 100, unit: 'g',
        calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6,
      }],
    }))
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument() // back on the list screen
  })

  it('SAVE CHANGES updates the recipe in the list directly, with no full re-fetch', async () => {
    mockUpdateRecipe.mockResolvedValue({
      id: 2, name: 'Protein Smoothie', servings: 2,
      food: { id: 9, variants: [{ id: 201, is_default: 1, calories: 250, protein_g: 30, carbs_g: 20, fat_g: 5, fiber_g: 2 }] },
    })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Protein Smoothie')
    mockFetchRecipes.mockClear() // only the initial list-mount call should be counted so far

    await user.click(screen.getByLabelText('Edit Protein Smoothie'))
    await screen.findByDisplayValue('Protein Smoothie')
    await user.click(screen.getByText('SAVE CHANGES'))

    // the prefilled edit form has 1 ingredient (Test Oats, per the beforeEach mock above)
    expect(await screen.findByText('1 ingredients · 2 servings · 250 kcal / serving')).toBeInTheDocument()
    expect(mockFetchRecipes).not.toHaveBeenCalled() // no re-fetch of the whole list
  })

  it('the "Add from saved foods" search excludes the recipe\'s own materialized food while editing', async () => {
    const smoothieFood = { id: 9, source: 'custom', name: 'Protein Smoothie', brand: null, variants: [
      { id: 900, food_id: 9, label: '1 serving', serving_qty: 1, serving_unit: 'serving', is_default: 1, source: 'custom', calories: 113, protein_g: 25, carbs_g: 15, fat_g: 0.5, fiber_g: 1.5 },
    ] }
    mockSearchFoods.mockResolvedValue([oats, smoothieFood])
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByLabelText('Edit Protein Smoothie')
    await user.click(screen.getByLabelText('Edit Protein Smoothie'))
    await screen.findByDisplayValue('Protein Smoothie')

    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Protein Smoothie')

    expect(screen.queryByRole('button', { name: 'Protein Smoothie' })).not.toBeInTheDocument()
  })

  it('rescaling an existing ingredient\'s quantity uses the ingredient\'s OWN stored snapshot, not the referenced food\'s current (possibly since-edited) macros', async () => {
    // The recipe's own stored snapshot for this ingredient (as saved at the time):
    // 100g of Test Oats = 200 kcal. But "Test Oats" (food_id 1) has SINCE been edited —
    // the live foods list (`oats`, from the top-of-file fixture) now says 389 kcal/100g.
    mockFetchRecipe.mockResolvedValue({
      id: 2, name: 'Protein Smoothie', servings: 2, food_id: 9,
      ingredients: [
        { variant_id: 100, name: 'Test Oats', quantity: 100, unit: 'g', calories: 200, protein_g: 10, carbs_g: 20, fat_g: 5, fiber_g: 2 },
      ],
    })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Protein Smoothie')
    await user.click(screen.getByLabelText('Edit Protein Smoothie'))
    await screen.findByDisplayValue('Protein Smoothie')

    await user.clear(screen.getByLabelText('Ingredient 0 quantity'))
    await user.type(screen.getByLabelText('Ingredient 0 quantity'), '50')

    // 200 kcal stored per 100g * (50/100) = 100 -- NOT 389 (live Test Oats) * 0.5 = 194.5
    expect(await screen.findByText('100 kcal')).toBeInTheDocument()
  })

  it('‹ BACK TO LIBRARY from the edit form does not call updateRecipe', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Protein Smoothie')
    await user.click(screen.getByLabelText('Edit Protein Smoothie'))
    await screen.findByDisplayValue('Protein Smoothie')
    await user.click(screen.getByText('‹ BACK TO LIBRARY'))

    expect(mockUpdateRecipe).not.toHaveBeenCalled()
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument()
  })
})
