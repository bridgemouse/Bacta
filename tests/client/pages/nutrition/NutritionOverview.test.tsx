import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NutritionOverview } from '../../../../client/src/pages/nutrition/NutritionOverview'
import { todayLocal } from '../../../../client/src/lib/nutritionDate'

vi.mock('../../../../client/src/lib/nutritionApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../client/src/lib/nutritionApi')>()
  return {
    ...actual,
    fetchLog: vi.fn(),
    fetchSummary: vi.fn(),
    createLogEntry: vi.fn(),
    searchFoods: vi.fn().mockResolvedValue([]),
    fetchRecentEntries: vi.fn().mockResolvedValue([]),
    saveTargets: vi.fn(),
  }
})

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

describe('NutritionOverview — LogEntrySheet', () => {
  it('opens the LogEntrySheet with LUNCH pre-selected when the missing-meal LUNCH button is clicked', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    const today = todayLocal()
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getAllByText('NOT LOGGED YET').length).toBe(3))
    const lunchButtons = screen.getAllByText(/\+ LUNCH/)
    await user.click(lunchButtons[0])
    await waitFor(() => {
      expect(screen.getByText(`LUNCH · ${today}`)).toBeInTheDocument()
    })
  })

  it('opens the LogEntrySheet with DINNER pre-selected when the missing-meal DINNER button is clicked', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    const today = todayLocal()
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getAllByText('NOT LOGGED YET').length).toBe(3))
    const dinnerButtons = screen.getAllByText(/\+ DINNER/)
    await user.click(dinnerButtons[0])
    await waitFor(() => {
      expect(screen.getByText(`DINNER · ${today}`)).toBeInTheDocument()
    })
  })

  it('opens the LogEntrySheet with the correct meal pre-selected when "+ ADD TO {MEAL}" is clicked on an existing meal group', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    const today = todayLocal()
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText('Oatmeal')).toBeInTheDocument())
    const addButtons = screen.getAllByText(/\+ ADD TO BREAKFAST/)
    await user.click(addButtons[0])
    await waitFor(() => {
      expect(screen.getByText(`BREAKFAST · ${today}`)).toBeInTheDocument()
    })
  })

  it('resync meal selection when sheet is closed and reopened with a different meal', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    const today = todayLocal()
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getAllByText('NOT LOGGED YET').length).toBe(3))

    // Open sheet with LUNCH
    const lunchButtons = screen.getAllByText(/\+ LUNCH/)
    await user.click(lunchButtons[0])
    await waitFor(() => {
      expect(screen.getByText(`LUNCH · ${today}`)).toBeInTheDocument()
    })

    // Close the sheet by clicking the close button
    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    await user.click(closeButtons[closeButtons.length - 1])

    // Verify sheet is closed
    await waitFor(() => {
      expect(screen.queryByText(`LUNCH · ${today}`)).not.toBeInTheDocument()
    })

    // Open sheet again with DINNER
    const dinnerButtons = screen.getAllByText(/\+ DINNER/)
    await user.click(dinnerButtons[0])
    await waitFor(() => {
      expect(screen.getByText(`DINNER · ${today}`)).toBeInTheDocument()
    })
  })

  it('clears draft form state when sheet is closed without submitting', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getAllByText('NOT LOGGED YET').length).toBe(3))

    // Open sheet and type in the name field
    const lunchButtons = screen.getAllByText(/\+ LUNCH/)
    await user.click(lunchButtons[0])
    await waitFor(() => {
      expect(screen.getByPlaceholderText('What did you eat? (e.g. tacos from the truck)')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('What did you eat? (e.g. tacos from the truck)') as HTMLInputElement
    await user.type(nameInput, 'stale entry')
    expect(nameInput.value).toBe('stale entry')

    // Close the sheet
    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    await user.click(closeButtons[closeButtons.length - 1])

    // Reopen and verify the form is cleared
    const dinnerButtons = screen.getAllByText(/\+ DINNER/)
    await user.click(dinnerButtons[0])
    await waitFor(() => {
      const reopenedInput = screen.getByPlaceholderText('What did you eat? (e.g. tacos from the truck)') as HTMLInputElement
      expect(reopenedInput.value).toBe('')
    })
  })
})

describe('NutritionOverview — EditEntrySheet', () => {
  it('opens the EditEntrySheet with the clicked entry', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => screen.getByText('Oatmeal'))
    await user.click(screen.getByText('Oatmeal'))
    expect(await screen.findByText('SAVE CHANGES')).toBeInTheDocument()
  })
})

describe('NutritionOverview — TargetsSheet', () => {
  it('opens the TargetsSheet when the target rail button is clicked', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => screen.getByText(/EDIT ›/))
    await user.click(screen.getByText(/EDIT ›/))
    expect(await screen.findByText('SAVE TARGETS')).toBeInTheDocument()
  })
})

describe('NutritionOverview — Copy to today', () => {
  it('shows a COPY TO TODAY chip on a meal group only when viewing a past day, and copies every entry in that meal', async () => {
    const { createLogEntry } = await import('../../../../client/src/lib/nutritionApi')
    ;(createLogEntry as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99 })
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => screen.getByLabelText('Previous day'))
    expect(screen.queryByText('COPY TO TODAY')).not.toBeInTheDocument() // today has no chip

    await user.click(screen.getByLabelText('Previous day'))
    await waitFor(() => screen.getByText('COPY TO TODAY'))
    await user.click(screen.getByText('COPY TO TODAY'))

    await waitFor(() => expect(createLogEntry).toHaveBeenCalledWith(expect.objectContaining({ name: 'Oatmeal', meal_type: 'breakfast' })))
  })

  it('fires createLogEntry for every entry in the meal concurrently, not one at a time', async () => {
    mockFetchLog.mockResolvedValue({
      meals: {
        lunch: {
          entries: [
            { id: 1, meal_type: 'lunch', food_id: null, name: 'Chicken', quantity: 1, unit: 'serving', calories: 300, protein_g: 30, carbs_g: 0, fat_g: 10, fiber_g: 0, logged_at: '' },
            { id: 2, meal_type: 'lunch', food_id: null, name: 'Rice', quantity: 1, unit: 'serving', calories: 200, protein_g: 4, carbs_g: 45, fat_g: 0, fiber_g: 1, logged_at: '' },
            { id: 3, meal_type: 'lunch', food_id: null, name: 'Broccoli', quantity: 1, unit: 'serving', calories: 50, protein_g: 4, carbs_g: 10, fat_g: 0, fiber_g: 3, logged_at: '' },
          ],
          totals: { calories: 550, protein_g: 38, carbs_g: 55, fat_g: 10, fiber_g: 4 },
        },
      },
      daily: { calories: 550, protein_g: 38, carbs_g: 55, fat_g: 10, fiber_g: 4 },
    })
    const { createLogEntry } = await import('../../../../client/src/lib/nutritionApi')
    const mockCreate = createLogEntry as ReturnType<typeof vi.fn>
    mockCreate.mockClear() // this file's mocks aren't reset between tests — start from a clean call count
    // Deliberately never-resolving — if the entries are copied one at a time (awaited
    // sequentially in a for-loop), only the FIRST call would ever fire, since the loop
    // would be stuck awaiting a promise that never resolves.
    mockCreate.mockReturnValue(new Promise(() => {}))
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => screen.getByLabelText('Previous day'))
    await user.click(screen.getByLabelText('Previous day'))
    await waitFor(() => screen.getByText('COPY TO TODAY'))
    await user.click(screen.getByText('COPY TO TODAY'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(3))
  })

  it('copies the widened nutrient fields forward too, not just the 5 original macros', async () => {
    const { createLogEntry } = await import('../../../../client/src/lib/nutritionApi')
    ;(createLogEntry as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99 })
    mockFetchLog.mockResolvedValue({
      meals: {
        breakfast: {
          entries: [{ id: 1, meal_type: 'breakfast', food_id: null, name: 'Oatmeal', quantity: 200, unit: 'g', calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2, logged_at: '', sodium_mg: 140 }],
          totals: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
        },
      },
      daily: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
    })
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => screen.getByLabelText('Previous day'))
    await user.click(screen.getByLabelText('Previous day'))
    await waitFor(() => screen.getByText('COPY TO TODAY'))
    await user.click(screen.getByText('COPY TO TODAY'))

    await waitFor(() => expect(createLogEntry).toHaveBeenCalledWith(expect.objectContaining({ sodium_mg: 140 })))
  })
})
