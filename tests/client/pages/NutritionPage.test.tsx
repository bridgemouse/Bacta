import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NutritionPage } from '../../../client/src/pages/NutritionPage'

vi.mock('../../../client/src/lib/nutritionApi', () => ({
  fetchLog: vi.fn().mockResolvedValue({ meals: {}, daily: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } }),
  fetchSummary: vi.fn().mockResolvedValue({ target: null, actual: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, remaining: { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null } }),
  searchFoods: vi.fn().mockResolvedValue([]),
  fetchRecipes: vi.fn().mockResolvedValue([]),
  deleteFood: vi.fn().mockResolvedValue({}),
  deleteRecipe: vi.fn().mockResolvedValue({}),
  createFood: vi.fn().mockResolvedValue({}),
}))

beforeEach(() => {
  // Well-formed, not `{}` — MX4Briefing (wired in Task 8) reads liveData.tone unconditionally
  // once liveData is non-null, so a shape-less mock would throw on liveData.tone.toLowerCase().
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tone: 'POSITIVE', headline: '', body: '', recommendation: '', flags: [] }),
  }) as unknown as typeof fetch
})

describe('NutritionPage', () => {
  it('renders the day navigator on the Overview tab by default', async () => {
    render(<MemoryRouter initialEntries={['/nutrition']}><NutritionPage /></MemoryRouter>)
    expect(await screen.findByText('TODAY')).toBeInTheDocument()
  })

  it('shows the empty-log message once loading resolves with no entries', async () => {
    render(<MemoryRouter initialEntries={['/nutrition']}><NutritionPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('NO ENTRIES LOGGED YET TODAY')).toBeInTheDocument())
  })

  it('switches to Library when the Library tab is clicked', async () => {
    render(<MemoryRouter initialEntries={['/nutrition']}><NutritionPage /></MemoryRouter>)
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.click(screen.getByText('Library'))
    expect(await screen.findByText('NO SAVED FOODS YET')).toBeInTheDocument()
  })
})
