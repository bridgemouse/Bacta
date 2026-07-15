import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import {
  MoreNutrientsSection, emptyExtendedNutrients, extendedNutrientsToPayload, payloadToExtendedNutrients,
  type ExtendedNutrients,
} from '../../../../client/src/pages/nutrition/MoreNutrientsSection'

function StatefulWrapper({ onLatest }: { onLatest: (data: ExtendedNutrients) => void }) {
  const [data, setData] = useState(emptyExtendedNutrients())
  return <MoreNutrientsSection accent="#3ecf8e" data={data} onChange={next => { setData(next); onLatest(next) }} />
}

describe('MoreNutrientsSection', () => {
  it('is collapsed by default — no extended nutrient inputs visible', () => {
    render(<MoreNutrientsSection accent="#3ecf8e" data={emptyExtendedNutrients()} onChange={() => {}} />)
    expect(screen.getByText('+ MORE NUTRIENTS')).toBeInTheDocument()
    expect(screen.queryByLabelText('sodium_mg')).not.toBeInTheDocument()
  })

  it('expands to reveal the widened nutrient fields when clicked', async () => {
    const user = userEvent.setup()
    render(<MoreNutrientsSection accent="#3ecf8e" data={emptyExtendedNutrients()} onChange={() => {}} />)
    await user.click(screen.getByText('+ MORE NUTRIENTS'))
    expect(screen.getByLabelText('sodium_mg')).toBeInTheDocument()
    expect(screen.getByLabelText('vitamin_c_mg')).toBeInTheDocument()
    expect(screen.getByLabelText('Glycemic index')).toBeInTheDocument()
    expect(screen.getByLabelText('Allergens')).toBeInTheDocument()
  })

  it('calls onChange with the updated field when a numeric input changes', async () => {
    const user = userEvent.setup()
    let latest = emptyExtendedNutrients()
    render(<StatefulWrapper onLatest={next => { latest = next }} />)
    await user.click(screen.getByText('+ MORE NUTRIENTS'))
    await user.type(screen.getByLabelText('sodium_mg'), '140')
    expect(latest.values.sodium_mg).toBe('140')
  })

  it('hides descriptive fields (glycemic index / allergens / traces) when numericOnly is set, for the Targets sheet', async () => {
    const user = userEvent.setup()
    render(<MoreNutrientsSection accent="#3ecf8e" data={emptyExtendedNutrients()} onChange={() => {}} numericOnly />)
    await user.click(screen.getByText('+ MORE NUTRIENTS'))
    expect(screen.getByLabelText('sodium_mg')).toBeInTheDocument()
    expect(screen.queryByLabelText('Glycemic index')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Allergens')).not.toBeInTheDocument()
  })
})

describe('extendedNutrientsToPayload', () => {
  it('converts blank string fields to undefined, not 0 or empty arrays', () => {
    const payload = extendedNutrientsToPayload(emptyExtendedNutrients())
    expect(payload.sodium_mg).toBeUndefined()
    expect(payload.allergens).toBeUndefined()
    expect(payload.glycemic_index).toBeUndefined()
  })

  it('parses numeric strings and splits comma-separated allergens/traces into arrays', () => {
    const data = emptyExtendedNutrients()
    data.values.sodium_mg = '140'
    data.glycemicIndex = 'Low'
    data.allergens = 'peanuts, tree nuts'
    const payload = extendedNutrientsToPayload(data)
    expect(payload.sodium_mg).toBe(140)
    expect(payload.glycemic_index).toBe('Low')
    expect(payload.allergens).toEqual(['peanuts', 'tree nuts'])
  })
})

describe('payloadToExtendedNutrients', () => {
  it('round-trips a stored row (JSON-string allergens) back into editable form state', () => {
    const result = payloadToExtendedNutrients({ sodium_mg: 140, glycemic_index: 'Low', allergens: JSON.stringify(['peanuts', 'tree nuts']) })
    expect(result.values.sodium_mg).toBe('140')
    expect(result.glycemicIndex).toBe('Low')
    expect(result.allergens).toBe('peanuts, tree nuts')
  })

  it('returns an empty state for a null/undefined row', () => {
    const result = payloadToExtendedNutrients(null)
    expect(result.values.sodium_mg).toBe('')
    expect(result.allergens).toBe('')
  })
})
