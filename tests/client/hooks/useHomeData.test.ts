import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../../client/src/lib/garminApi', () => ({
  fetchSummary: vi.fn(),
  TRAINING_STATUS: { 1: 'Maintaining' },
}))

import { fetchSummary } from '../../../client/src/lib/garminApi'
import { useHomeData } from '../../../client/src/hooks/useHomeData'
import { setCachedData, clearCachedData } from '../../../client/src/lib/sectionDataCache'

const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>

beforeEach(() => {
  clearCachedData()
  mockFetchSummary.mockResolvedValue({})
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useHomeData — revisit cache (no pop-in)', () => {
  it('renders cached data immediately with loading=false when a prior fetch already populated the cache, instead of showing stub/loading on every mount', async () => {
    mockFetchSummary.mockResolvedValue({ body_battery_current: 55, hrv: 61 })

    const first = renderHook(() => useHomeData())
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    expect(first.result.current.data.recovery.value).toBe('55')
    first.unmount()

    mockFetchSummary.mockReturnValue(new Promise(() => {}))

    const second = renderHook(() => useHomeData())
    expect(second.result.current.loading).toBe(false)
    expect(second.result.current.data.recovery.value).toBe('55')
  })

  it('seeds initial state from the section cache on mount', () => {
    setCachedData('home', {
      recovery: { value: '99', sub: 'seeded' },
      training: { value: '1', sub: 'seeded' },
      sleep: { value: '1h', sub: 'seeded', ring: 0.1 },
    })
    mockFetchSummary.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useHomeData())

    expect(result.current.loading).toBe(false)
    expect(result.current.data.recovery.value).toBe('99')
  })
})
