import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../../client/src/lib/nutritionApi', () => ({
  fetchLog: vi.fn(),
  fetchSummary: vi.fn(),
}))

import { fetchLog, fetchSummary } from '../../../client/src/lib/nutritionApi'
import { useNutritionSummary } from '../../../client/src/hooks/useNutritionSummary'

const mockFetchLog = fetchLog as ReturnType<typeof vi.fn>
const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetchSummary.mockResolvedValue({ target: { date: '2026-07-13', calories: 2200, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null }, actual: { calories: 1850, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, remaining: { calories: 350, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null } })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useNutritionSummary', () => {
  it('fetches only the summary for the given date, not the full log', async () => {
    const { result } = renderHook(() => useNutritionSummary('2026-07-13'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockFetchSummary).toHaveBeenCalledWith('2026-07-13')
    expect(mockFetchLog).not.toHaveBeenCalled()
    expect(result.current.summary?.actual.calories).toBe(1850)
  })

  it('refetches when the date argument changes', async () => {
    const { result, rerender } = renderHook(({ date }) => useNutritionSummary(date), { initialProps: { date: '2026-07-13' } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ date: '2026-07-14' })
    await waitFor(() => expect(mockFetchSummary).toHaveBeenCalledWith('2026-07-14'))
  })
})
