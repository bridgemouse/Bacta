import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { TargetsSheet } from '../../../../client/src/pages/nutrition/TargetsSheet'

vi.mock('../../../../client/src/lib/nutritionApi', () => ({ saveTargets: vi.fn() }))
import { saveTargets } from '../../../../client/src/lib/nutritionApi'
const mockSave = saveTargets as ReturnType<typeof vi.fn>

const target = { date: '2026-06-01', calories: 1972, protein_g: 138, carbs_g: 220, fat_g: 60, fiber_g: 30 }

beforeEach(() => vi.clearAllMocks())

describe('TargetsSheet', () => {
  it('prefills fields from initialTarget', () => {
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('Protein goal')).toHaveValue('138')
    expect(screen.getByLabelText('Calorie goal')).toHaveValue('1972')
  })

  it('renders blank fields when initialTarget is null (no target set yet)', () => {
    render(<TargetsSheet open initialTarget={null} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('Protein goal')).toHaveValue('')
  })

  it('editing protein recomputes the calorie goal as P*4 + C*4 + F*9', async () => {
    const user = userEvent.setup()
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.clear(screen.getByLabelText('Protein goal'))
    await user.type(screen.getByLabelText('Protein goal'), '150')
    // 150*4 + 220*4 + 60*9 = 600 + 880 + 540 = 2020
    await waitFor(() => expect(screen.getByLabelText('Calorie goal')).toHaveValue('2020'))
  })

  it('overriding calories directly shows a mismatch indicator against the macro sum', async () => {
    const user = userEvent.setup()
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.clear(screen.getByLabelText('Calorie goal'))
    await user.type(screen.getByLabelText('Calorie goal'), '2500')
    expect(await screen.findByText(/MACROS SUM TO/)).toBeInTheDocument()
  })

  it('shows MATCHES MACROS when calories agree with the macro sum within tolerance', () => {
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText(/MATCHES MACROS/)).toBeInTheDocument()
  })

  it('SAVE TARGETS calls saveTargets with today\'s date and the current field values', async () => {
    const user = userEvent.setup()
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.click(screen.getByText('SAVE TARGETS'))
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      calories: 1972, protein_g: 138, carbs_g: 220, fat_g: 60, fiber_g: 30,
    })))
    expect(mockSave.mock.calls[0][0].date).toBe(new Date().toLocaleDateString('en-CA'))
  })
})
