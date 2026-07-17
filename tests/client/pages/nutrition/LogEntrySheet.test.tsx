import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { LogEntrySheet } from '../../../../client/src/pages/nutrition/LogEntrySheet'

vi.mock('../../../../client/src/lib/nutritionApi', async () => {
  const actual = await vi.importActual('../../../../client/src/lib/nutritionApi')
  return { ...actual, createLogEntry: vi.fn(), searchFoods: vi.fn().mockResolvedValue([]), fetchRecentEntries: vi.fn().mockResolvedValue([]) }
})

import { createLogEntry, searchFoods, fetchRecentEntries } from '../../../../client/src/lib/nutritionApi'
const mockCreateLogEntry = createLogEntry as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('LogEntrySheet — Quick Track', () => {
  it('submits an ad-hoc entry with the typed name, quantity, and unit', async () => {
    mockCreateLogEntry.mockResolvedValue({ id: 1 })
    const onLogged = vi.fn()
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={onLogged} />)

    await user.type(screen.getByPlaceholderText(/what did you eat/i), 'Tacos from the truck')
    await user.type(screen.getByPlaceholderText('qty'), '2')
    await user.type(screen.getByPlaceholderText('unit (any)'), 'tacos')
    await user.click(screen.getByRole('button', { name: 'LOG ENTRY' }))

    await waitFor(() => expect(mockCreateLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-07-13', meal_type: 'breakfast', name: 'Tacos from the truck', quantity: 2, unit: 'tacos',
    })))
    expect(onLogged).toHaveBeenCalled()
  })

  it('leaves blank macro fields as null, not zero', async () => {
    mockCreateLogEntry.mockResolvedValue({ id: 1 })
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)

    await user.type(screen.getByPlaceholderText(/what did you eat/i), 'Mystery snack')
    await user.type(screen.getByPlaceholderText('qty'), '1')
    await user.type(screen.getByPlaceholderText('unit (any)'), 'serving')
    await user.click(screen.getByRole('button', { name: 'LOG ENTRY' }))

    await waitFor(() => expect(mockCreateLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null,
    })))
  })

  it('does not render when open is false', () => {
    render(<LogEntrySheet open={false} date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    expect(screen.queryByText('LOG ENTRY')).not.toBeInTheDocument()
  })

  it('blocks submit when quantity is "0", instead of silently logging a zeroed-out entry', async () => {
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText(/what did you eat/i), 'Tacos')
    await user.type(screen.getByPlaceholderText('qty'), '0')
    await user.type(screen.getByPlaceholderText('unit (any)'), 'tacos')
    await user.click(screen.getByRole('button', { name: 'LOG ENTRY' }))
    expect(mockCreateLogEntry).not.toHaveBeenCalled()
  })
})

describe('LogEntrySheet — search and recents', () => {
  it('shows a no-saved-foods hint when there is no query and no recents (cold start)', async () => {
    const { fetchRecentEntries: mockFetchRecentEntries } = await import('../../../../client/src/lib/nutritionApi')
    ;(mockFetchRecentEntries as ReturnType<typeof vi.fn>).mockResolvedValue([])
    render(<LogEntrySheet open date="2026-07-13" meal="lunch" onClose={vi.fn()} onLogged={vi.fn()} />)
    expect(await screen.findByText(/No saved foods yet/)).toBeInTheDocument()
  })

  it('shows up to 4 recent entries when the search query is empty', async () => {
    const { fetchRecentEntries: mockFetchRecentEntries } = await import('../../../../client/src/lib/nutritionApi')
    ;(mockFetchRecentEntries as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, name: 'Salmon bowl', quantity: 1, unit: 'bowl', calories: 520, protein_g: 46, meal_type: 'lunch', food_id: null, carbs_g: null, fat_g: null, fiber_g: null, logged_at: '' },
    ])
    render(<LogEntrySheet open date="2026-07-13" meal="lunch" onClose={vi.fn()} onLogged={vi.fn()} />)
    expect(await screen.findByText('Salmon bowl')).toBeInTheDocument()
  })

  it('calls searchFoods as the user types a query', async () => {
    const { searchFoods: mockSearchFoods } = await import('../../../../client/src/lib/nutritionApi')
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="lunch" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await waitFor(() => expect(mockSearchFoods).toHaveBeenCalledWith('oat'))
  })

  it('shows a no-match hint when search returns nothing for a non-empty query', async () => {
    const { searchFoods: mockSearchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(mockSearchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="lunch" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'zzz')
    expect(await screen.findByText(/No match for "zzz"/)).toBeInTheDocument()
  })

  it('does not flash a "No match" hint during the debounce window, before the search has actually run', async () => {
    vi.useFakeTimers()
    try {
      const { searchFoods: mockSearchFoods } = await import('../../../../client/src/lib/nutritionApi')
      ;(mockSearchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([])
      render(<LogEntrySheet open date="2026-07-13" meal="lunch" onClose={vi.fn()} onLogged={vi.fn()} />)
      const input = screen.getByPlaceholderText('Search saved foods…')

      act(() => { fireEvent.change(input, { target: { value: 'zzz' } }) })
      // still inside the 280ms debounce window — searchFoods hasn't even been called yet,
      // so a "No match" hint here would be premature, not a real result
      expect(screen.queryByText(/No match for/)).not.toBeInTheDocument()

      await act(async () => { await vi.advanceTimersByTimeAsync(300) })
      expect(screen.getByText(/No match for "zzz"/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('debounces rapid typing into exactly one searchFoods call per pause, not one per keystroke', async () => {
    vi.useFakeTimers()
    try {
      const { searchFoods: mockSearchFoods } = await import('../../../../client/src/lib/nutritionApi')
      render(<LogEntrySheet open date="2026-07-13" meal="lunch" onClose={vi.fn()} onLogged={vi.fn()} />)
      const input = screen.getByPlaceholderText('Search saved foods…')

      // simulate rapid keystroke-by-keystroke typing via change events, same as a real
      // controlled input receives, without userEvent's real-timer-dependent interaction delays
      act(() => {
        for (const partial of ['o', 'oa', 'oat', 'oatm', 'oatme', 'oatmea', 'oatmeal']) {
          fireEvent.change(input, { target: { value: partial } })
        }
      })
      // still within the debounce window — no call fired yet despite 7 keystrokes
      expect(mockSearchFoods).not.toHaveBeenCalled()

      await act(async () => { await vi.advanceTimersByTimeAsync(300) })
      expect(mockSearchFoods).toHaveBeenCalledTimes(1)
      expect(mockSearchFoods).toHaveBeenCalledWith('oatmeal')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('LogEntrySheet — selected food', () => {
  const oats = { id: 5, source: 'custom', name: 'Test Oats', brand: null, default_qty: 100, default_unit: 'g', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 }

  it('shows a locked unit chip and auto-rescale preview after picking a search result', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))

    expect(screen.getByText(/LOCKED/)).toBeInTheDocument()
    expect(screen.getByText('g')).toBeInTheDocument()
  })

  it('submits with food_id + quantity + the food\'s locked unit, not raw macros', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    mockCreateLogEntry.mockResolvedValue({ id: 9 })
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '200')
    await user.click(screen.getByRole('button', { name: 'LOG ENTRY' }))

    await waitFor(() => expect(mockCreateLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      food_id: 5, quantity: 200, unit: 'g',
    })))
    const call = mockCreateLogEntry.mock.calls[0][0]
    expect(call.calories).toBeUndefined() // server computes the scale, client sends none
  })

  it('recomputes quantity from a macro goal (protein) using reverse math', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.click(screen.getByText('P'))
    await user.type(screen.getByPlaceholderText('goal'), '40')

    // 40g protein ÷ (16.9g protein / 100g) = 236.7g
    await waitFor(() => expect(screen.getByLabelText('Quantity')).toHaveValue('236.69'))
  })

  it('blocks submit when quantity is "0" for a selected food', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '0')
    await user.click(screen.getByRole('button', { name: 'LOG ENTRY' }))
    expect(mockCreateLogEntry).not.toHaveBeenCalled()
  })

  it('does not poison the quantity field with "NaN" when the goal input is non-numeric', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.click(screen.getByText('P'))
    await user.type(screen.getByPlaceholderText('goal'), 'abc')
    expect(screen.getByLabelText('Quantity')).not.toHaveValue('NaN')
  })

  it('CLEAR returns to the search view', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.click(screen.getByLabelText('Clear selected food'))
    expect(screen.getByPlaceholderText('Search saved foods…')).toBeInTheDocument()
    expect(screen.queryByText(/LOCKED/)).not.toBeInTheDocument()
  })

  it('clears selectedFood, goalMacro, and goalValue when the sheet closes', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    const user = userEvent.setup()
    const { rerender } = render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))
    expect(screen.getByText(/LOCKED/)).toBeInTheDocument()

    // Close the sheet
    rerender(<LogEntrySheet open={false} date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)

    // Reopen and verify selectedFood is cleared (Quick Track is visible)
    rerender(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    expect(screen.getByPlaceholderText(/what did you eat/i)).toBeInTheDocument()
    expect(screen.queryByText(/LOCKED/)).not.toBeInTheDocument()
  })
})
