import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../../client/src/lib/nutritionApi', () => ({
  fetchLog: vi.fn(),
  fetchSummary: vi.fn(),
}))

import { fetchLog, fetchSummary } from '../../../client/src/lib/nutritionApi'
import { useNutritionLog } from '../../../client/src/hooks/useNutritionLog'

const mockFetchLog = fetchLog as ReturnType<typeof vi.fn>
const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetchLog.mockResolvedValue({ meals: {}, daily: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } })
  mockFetchSummary.mockResolvedValue({ target: null, actual: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, remaining: { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null } })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useNutritionLog', () => {
  it('fetches log and summary for the given date on mount', async () => {
    const { result } = renderHook(() => useNutritionLog('2026-07-13'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockFetchLog).toHaveBeenCalledWith('2026-07-13')
    expect(mockFetchSummary).toHaveBeenCalledWith('2026-07-13')
    expect(result.current.log).not.toBeNull()
    expect(result.current.summary).not.toBeNull()
  })

  it('refetches when the date argument changes', async () => {
    const { result, rerender } = renderHook(({ date }) => useNutritionLog(date), { initialProps: { date: '2026-07-13' } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ date: '2026-07-14' })
    await waitFor(() => expect(mockFetchLog).toHaveBeenCalledWith('2026-07-14'))
  })

  it('refresh() re-fetches the current date', async () => {
    const { result } = renderHook(() => useNutritionLog('2026-07-13'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    mockFetchLog.mockClear()
    result.current.refresh()
    await waitFor(() => expect(mockFetchLog).toHaveBeenCalledWith('2026-07-13'))
  })
})
