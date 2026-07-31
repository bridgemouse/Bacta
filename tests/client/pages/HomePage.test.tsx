import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { HomePage } from '../../../client/src/pages/HomePage'

vi.mock('../../../client/src/lib/nutritionApi', () => ({
  fetchLog: vi.fn().mockResolvedValue({ meals: {}, daily: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } }),
  fetchSummary: vi.fn().mockResolvedValue({
    target: { date: '2026-07-30', calories: 2200, protein_g: 150, carbs_g: 220, fat_g: 70, fiber_g: 30 },
    actual: { calories: 1850, protein_g: 120, carbs_g: 180, fat_g: 60, fiber_g: 20 },
    remaining: { calories: 350, protein_g: 30, carbs_g: 40, fat_g: 10, fiber_g: 10 },
  }),
}))

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tone: 'POSITIVE', headline: '', body: '', recommendation: '', flags: [] }),
  }) as unknown as typeof fetch
})

describe('HomePage — Nutrition overview tile', () => {
  it('renders Nutrition as a live tile with real data, not calibrating', async () => {
    render(<MemoryRouter initialEntries={['/']}><HomePage /></MemoryRouter>)

    const nutritionLabel = await screen.findByText('NUTRITION')
    const card = nutritionLabel.closest('button')

    await waitFor(() => expect(card).toHaveTextContent('1850'))
    expect(card).not.toHaveTextContent('CALIBRATING')
  })
})
