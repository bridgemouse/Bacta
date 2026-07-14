import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NutritionLibrary } from '../../../../client/src/pages/nutrition/NutritionLibrary'

vi.mock('../../../../client/src/lib/nutritionApi', () => ({
  searchFoods: vi.fn(), deleteFood: vi.fn(), fetchRecipes: vi.fn(), deleteRecipe: vi.fn(), createFood: vi.fn(), createRecipe: vi.fn(),
}))

import { searchFoods, deleteFood, fetchRecipes, deleteRecipe, createFood, createRecipe } from '../../../../client/src/lib/nutritionApi'
const mockSearchFoods = searchFoods as ReturnType<typeof vi.fn>
const mockDeleteFood = deleteFood as ReturnType<typeof vi.fn>
const mockFetchRecipes = fetchRecipes as ReturnType<typeof vi.fn>
const mockDeleteRecipe = deleteRecipe as ReturnType<typeof vi.fn>
const mockCreateFood = createFood as ReturnType<typeof vi.fn>
const mockCreateRecipe = createRecipe as ReturnType<typeof vi.fn>

const oats = { id: 1, source: 'custom', name: 'Test Oats', brand: null, default_qty: 100, default_unit: 'g', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 }
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

describe('NutritionLibrary — new food', () => {
  it('+ NEW FOOD switches to the new-food form', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW FOOD'))
    expect(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY')).toBeInTheDocument()
  })

  it('saving a new food calls createFood and returns to the list', async () => {
    mockCreateFood.mockResolvedValue({ id: 5 })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW FOOD'))
    await user.type(screen.getByLabelText('Food name'), 'Greek Yogurt')
    await user.type(screen.getByLabelText('Default quantity'), '170')
    await user.type(screen.getByLabelText('Default unit'), 'g')
    await user.click(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY'))
    await waitFor(() => expect(mockCreateFood).toHaveBeenCalledWith(expect.objectContaining({ name: 'Greek Yogurt', default_qty: 170, default_unit: 'g' })))
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument() // back on the list screen
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
        food_id: 1, name: 'Test Oats', quantity: 100, unit: 'g',
        calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6,
      }],
    }))
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument() // back on the list screen
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
        food_id: undefined, name: 'Honey', quantity: 2, unit: 'tbsp',
        calories: undefined, protein_g: undefined, carbs_g: undefined, fat_g: undefined, fiber_g: undefined,
      }],
    }))
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
