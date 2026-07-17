import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EditEntrySheet } from '../../../../client/src/pages/nutrition/EditEntrySheet'
import { ToastProvider } from '../../../../client/src/lib/ToastContext'
import { ToastContainer } from '../../../../client/src/components/ToastContainer'

vi.mock('../../../../client/src/lib/nutritionApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../client/src/lib/nutritionApi')>()
  return { ...actual, updateLogEntry: vi.fn(), deleteLogEntry: vi.fn(), createLogEntry: vi.fn() }
})

import { updateLogEntry, deleteLogEntry, createLogEntry } from '../../../../client/src/lib/nutritionApi'
const mockUpdate = updateLogEntry as ReturnType<typeof vi.fn>
const mockDelete = deleteLogEntry as ReturnType<typeof vi.fn>
const mockCreate = createLogEntry as ReturnType<typeof vi.fn>

function renderWithToasts(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}<ToastContainer /></ToastProvider>)
}

const linkedEntry = { id: 7, meal_type: 'breakfast', food_id: 3, name: 'Test Oats', quantity: 100, unit: 'g', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6, logged_at: '' }
const adHocEntry = { id: 8, meal_type: 'snack', food_id: null, name: 'Nuts', quantity: 1, unit: 'handful', calories: 180, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, logged_at: '' }

beforeEach(() => vi.clearAllMocks())

describe('EditEntrySheet', () => {
  it('shows a locked unit chip for a food-linked entry, a free unit input for ad-hoc', () => {
    const { rerender } = render(<EditEntrySheet open entry={linkedEntry} date="2026-07-13" onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText(/LOCKED/)).toBeInTheDocument()
    rerender(<EditEntrySheet open entry={adHocEntry} date="2026-07-13" onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText(/LOCKED/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Unit')).toBeInTheDocument()
  })

  it('renders blank macro inputs for null macros, not "0"', () => {
    render(<EditEntrySheet open entry={adHocEntry} date="2026-07-13" onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('protein_g')).toHaveValue('')
  })

  it('SAVE CHANGES sends only the fields that were actually edited', async () => {
    const user = userEvent.setup()
    render(<EditEntrySheet open entry={linkedEntry} date="2026-07-13" onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '150')
    await user.click(screen.getByText('SAVE CHANGES'))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(7, { quantity: 150 }))
  })

  it('DELETE calls deleteLogEntry with the entry id and closes', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<EditEntrySheet open entry={adHocEntry} date="2026-07-13" onClose={onClose} onSaved={vi.fn()} />)
    await user.click(screen.getByText('DELETE'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(8))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows COPY THIS ITEM TO TODAY only when viewing a past day, and it creates a new entry dated today', async () => {
    const user = userEvent.setup()
    render(<EditEntrySheet open entry={adHocEntry} date="2026-06-01" onClose={vi.fn()} onSaved={vi.fn()} />)
    const copyBtn = screen.getByText('COPY THIS ITEM TO TODAY')
    await user.click(copyBtn)
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nuts', quantity: 1, unit: 'handful' })))
    expect(mockCreate.mock.calls[0][0].date).not.toBe('2026-06-01')
  })

  it('COPY THIS ITEM TO TODAY carries the widened nutrient fields forward, not just the 5 original macros', async () => {
    const entryWithSodium = { ...adHocEntry, sodium_mg: 890, allergens: JSON.stringify(['dairy']) }
    const user = userEvent.setup()
    render(<EditEntrySheet open entry={entryWithSodium} date="2026-06-01" onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.click(screen.getByText('COPY THIS ITEM TO TODAY'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      sodium_mg: 890, allergens: JSON.stringify(['dairy']),
    })))
  })

  it('does not show COPY THIS ITEM TO TODAY when viewing today', () => {
    render(<EditEntrySheet open entry={adHocEntry} date={new Date().toLocaleDateString('en-CA')} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText('COPY THIS ITEM TO TODAY')).not.toBeInTheDocument()
  })

  it('blocks SAVE CHANGES when quantity is cleared to blank, instead of silently zeroing macros', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    renderWithToasts(<EditEntrySheet open entry={linkedEntry} date="2026-07-13" onClose={vi.fn()} onSaved={onSaved} />)
    await user.clear(screen.getByLabelText('Quantity'))
    await user.click(screen.getByText('SAVE CHANGES'))
    expect(await screen.findByText('Quantity must be greater than 0.')).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('shows an error toast instead of silently failing when SAVE CHANGES is rejected', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Unit mismatch — this food is logged in g'))
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithToasts(<EditEntrySheet open entry={linkedEntry} date="2026-07-13" onClose={onClose} onSaved={vi.fn()} />)
    await user.click(screen.getByText('SAVE CHANGES'))
    expect(await screen.findByText('Unit mismatch — this food is logged in g')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows an error toast instead of silently failing when DELETE is rejected', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Cannot delete — this food has been logged'))
    const user = userEvent.setup()
    renderWithToasts(<EditEntrySheet open entry={adHocEntry} date="2026-07-13" onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.click(screen.getByText('DELETE'))
    expect(await screen.findByText('Cannot delete — this food has been logged')).toBeInTheDocument()
  })
})
