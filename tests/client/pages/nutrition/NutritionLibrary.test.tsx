import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NutritionLibrary } from '../../../../client/src/pages/nutrition/NutritionLibrary'

vi.mock('../../../../client/src/lib/nutritionApi', () => ({
  searchFoods: vi.fn(), deleteFood: vi.fn(), fetchRecipes: vi.fn(), deleteRecipe: vi.fn(), createFood: vi.fn(),
}))

import { searchFoods, deleteFood, fetchRecipes, deleteRecipe, createFood } from '../../../../client/src/lib/nutritionApi'
const mockSearchFoods = searchFoods as ReturnType<typeof vi.fn>
const mockDeleteFood = deleteFood as ReturnType<typeof vi.fn>
const mockFetchRecipes = fetchRecipes as ReturnType<typeof vi.fn>
const mockDeleteRecipe = deleteRecipe as ReturnType<typeof vi.fn>
const mockCreateFood = createFood as ReturnType<typeof vi.fn>

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
