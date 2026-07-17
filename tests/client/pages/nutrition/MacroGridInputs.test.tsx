import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MacroGridInputs, MACRO_KEYS } from '../../../../client/src/pages/nutrition/MacroGridInputs'

const emptyValues = { calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' }

describe('MacroGridInputs', () => {
  it('renders one input per macro key, in order', () => {
    render(<MacroGridInputs values={emptyValues} onChange={() => {}} />)
    const inputs = screen.getAllByPlaceholderText('—')
    expect(inputs).toHaveLength(5)
  })

  it('displays the current value for each key', () => {
    render(<MacroGridInputs values={{ ...emptyValues, calories: '389' }} onChange={() => {}} />)
    expect(screen.getByDisplayValue('389')).toBeInTheDocument()
  })

  it('calls onChange with the key and new value when an input changes', async () => {
    const user = userEvent.setup()
    let received: [string, string] | null = null
    render(<MacroGridInputs values={emptyValues} onChange={(key, value) => { received = [key, value] }} />)
    const inputs = screen.getAllByPlaceholderText('—')
    await user.type(inputs[1], '5') // protein_g is index 1
    expect(received).toEqual(['protein_g', '5'])
  })

  it('applies a per-key aria-label when ariaLabel is provided, for forms that need accessible per-field targeting', () => {
    render(<MacroGridInputs values={emptyValues} onChange={() => {}} ariaLabel={key => `Ingredient 0 ${key}`} />)
    expect(screen.getByLabelText('Ingredient 0 calories')).toBeInTheDocument()
    expect(screen.getByLabelText('Ingredient 0 fiber_g')).toBeInTheDocument()
  })

  it('exports MACRO_KEYS in the canonical order used by the API payload', () => {
    expect(MACRO_KEYS).toEqual(['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'])
  })
})
