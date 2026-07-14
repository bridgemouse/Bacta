import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { LogEntrySheet } from '../../../../client/src/pages/nutrition/LogEntrySheet'

vi.mock('../../../../client/src/lib/nutritionApi', async () => {
  const actual = await vi.importActual('../../../../client/src/lib/nutritionApi')
  return { ...actual, createLogEntry: vi.fn(), searchFoods: vi.fn().mockResolvedValue([]) }
})

import { createLogEntry } from '../../../../client/src/lib/nutritionApi'
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
})
