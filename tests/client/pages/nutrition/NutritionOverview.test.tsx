import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NutritionOverview } from '../../../../client/src/pages/nutrition/NutritionOverview'

vi.mock('../../../../client/src/lib/nutritionApi', () => ({
  fetchLog: vi.fn(),
  fetchSummary: vi.fn(),
}))

import { fetchLog, fetchSummary } from '../../../../client/src/lib/nutritionApi'
const mockFetchLog = fetchLog as ReturnType<typeof vi.fn>
const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetchLog.mockResolvedValue({
    meals: {
      breakfast: {
        entries: [{ id: 1, meal_type: 'breakfast', food_id: null, name: 'Oatmeal', quantity: 200, unit: 'g', calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2, logged_at: '' }],
        totals: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
      },
    },
    daily: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
  })
  mockFetchSummary.mockResolvedValue({
    target: { date: '2026-07-01', calories: 2200, protein_g: 138, carbs_g: 220, fat_g: 60, fiber_g: 30 },
    actual: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
    remaining: { calories: 1422, protein_g: 104.2, carbs_g: 87.4, fat_g: 46.2, fiber_g: 8.8 },
  })
  // Task 8 adds MX4Briefing, which fetches /api/insights/nutrition via useBriefing. Mocked
  // here (not just in Task 8) so this file's fetch behavior is defined from the start rather
  // than relying on environment-dependent fetch availability. Must be well-formed, not `{}` —
  // MX4Briefing reads liveData.tone unconditionally once liveData is non-null.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tone: 'POSITIVE', headline: '', body: '', recommendation: '', flags: [] }),
  }) as unknown as typeof fetch
})

describe('NutritionOverview — ledger', () => {
  it('renders the hero remaining-kcal value from summary', async () => {
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText('1422')).toBeInTheDocument())
  })

  it('renders only meal groups present in the log response (sparse)', async () => {
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText('Oatmeal')).toBeInTheDocument())
    expect(screen.queryByText('DINNER')).not.toBeInTheDocument() // no header for a meal with no entries
  })

  it('renders a NOT LOGGED YET affordance for standard meals with no entries', async () => {
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getAllByText('NOT LOGGED YET').length).toBe(3)) // lunch, dinner, snack
  })

  it('renders "—" for a null macro on an entry instead of 0', async () => {
    mockFetchLog.mockResolvedValue({
      meals: {
        breakfast: {
          entries: [{ id: 2, meal_type: 'breakfast', food_id: null, name: 'Coffee', quantity: 1, unit: 'cup', calories: 45, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, logged_at: '' }],
          totals: { calories: 45, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
        },
      },
      daily: { calories: 45, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    })
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText('P — · C — · F —')).toBeInTheDocument())
  })

  it('shows NO TARGET SET when summary.target is null, not a crash', async () => {
    mockFetchSummary.mockResolvedValue({
      target: null,
      actual: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
      remaining: { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null },
    })
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText('NO TARGET SET · SET ›')).toBeInTheDocument())
  })
})

describe('NutritionOverview — MX-4 briefing', () => {
  it('renders the MX-4 briefing card only when viewing today', async () => {
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText(/MX-4 \/\/ NUTRITION/)).toBeInTheDocument())
  })

  it('does not render the briefing card on a past day', async () => {
    render(<NutritionOverview />)
    const user = (await import('@testing-library/user-event')).default.setup()
    await waitFor(() => screen.getByLabelText('Previous day'))
    await user.click(screen.getByLabelText('Previous day'))
    await waitFor(() => expect(screen.queryByText(/MX-4 \/\/ NUTRITION/)).not.toBeInTheDocument())
  })
})
