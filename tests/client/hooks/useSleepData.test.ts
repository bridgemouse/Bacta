import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../../client/src/lib/garminApi', () => ({
  fetchSummary: vi.fn(),
  fetchTrend: vi.fn(),
  fetchSources: vi.fn(),
}))

import { fetchSummary, fetchTrend, fetchSources } from '../../../client/src/lib/garminApi'
import { useSleepData } from '../../../client/src/hooks/useSleepData'
import { clearCachedData } from '../../../client/src/lib/sectionDataCache'

const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>
const mockFetchTrend = fetchTrend as ReturnType<typeof vi.fn>
const mockFetchSources = fetchSources as ReturnType<typeof vi.fn>

beforeEach(() => {
  clearCachedData()
  mockFetchSummary.mockResolvedValue({})
  mockFetchTrend.mockResolvedValue([])
  mockFetchSources.mockResolvedValue({})
  // useSleepData also fetches /api/garmin/sleep-hypno directly
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
})

describe('useSleepData — sources', () => {
  it('defaults sources to empty object before data loads', () => {
    mockFetchSummary.mockReturnValue(new Promise(() => {}))
    mockFetchTrend.mockReturnValue(new Promise(() => {}))
    mockFetchSources.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useSleepData())
    expect(result.current.sources).toEqual({})
  })

  it('populates sources from fetchSources response', async () => {
    mockFetchSources.mockResolvedValue({ sleep_score: 'oura', sleep_spo2: 'oura' })

    const { result } = renderHook(() => useSleepData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sources['sleep_score']).toBe('oura')
    expect(result.current.sources['sleep_spo2']).toBe('oura')
  })

  it('defaults sources to empty object when fetchSources returns empty', async () => {
    mockFetchSources.mockResolvedValue({})

    const { result } = renderHook(() => useSleepData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sources).toEqual({})
  })

  it('keeps sources as empty object when fetchSummary throws', async () => {
    mockFetchSummary.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useSleepData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sources).toEqual({})
  })

  it('returns sources in the hook return value', async () => {
    mockFetchSources.mockResolvedValue({ sleep_hr: 'garmin' })

    const { result } = renderHook(() => useSleepData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current).toHaveProperty('sources')
    expect(typeof result.current.sources).toBe('object')
  })
})

describe('useSleepData — cumulative sleep debt', () => {
  it('sums daily deficits across the 7-day sleep_s trend instead of using a single night', async () => {
    // 7 nights of exactly 420 min (7h) each: 60 min short of the 480 min (8h) target per night.
    // Cumulative debt should be 7 * 60 = 420 min, not the 60 min a single-night calc would show.
    mockFetchTrend.mockImplementation((metric: string) => {
      if (metric === 'sleep_s') return Promise.resolve(Array(7).fill(420 * 60))
      return Promise.resolve([])
    })
    mockFetchSummary.mockResolvedValue({ sleep_s: 420 * 60 })

    const { result } = renderHook(() => useSleepData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data.sleepDebt).toBe(420)
  })

  it('does not let a single well-rested night cancel out debt from other nights', async () => {
    // Six 420-min (7h) nights (60 min short each = 360 total) plus one 600-min (10h) night
    // (120 min over target, clamped to 0 — no negative debt). Cumulative should stay 360, not 240.
    mockFetchTrend.mockImplementation((metric: string) => {
      if (metric === 'sleep_s') return Promise.resolve([420, 420, 420, 420, 420, 420, 600].map(m => m * 60))
      return Promise.resolve([])
    })
    mockFetchSummary.mockResolvedValue({ sleep_s: 600 * 60 })

    const { result } = renderHook(() => useSleepData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data.sleepDebt).toBe(360)
  })
})

describe('useSleepData — hypnogram fetch concurrency (#202)', () => {
  it('fires the hypnogram fetch concurrently with the other 9 calls, not sequenced after their Promise.all resolves', async () => {
    let resolveSummary: (v: unknown) => void = () => {}
    mockFetchSummary.mockReturnValue(new Promise(resolve => { resolveSummary = resolve }))
    mockFetchTrend.mockResolvedValue([])
    mockFetchSources.mockResolvedValue({})

    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useSleepData())

    // Let pending microtasks run — enough for an immediately-fired concurrent call
    // to register, but fetchSummary (part of the other 9) is still unresolved.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledWith('/api/garmin/sleep-hypno')

    await act(async () => {
      resolveSummary({})
      await Promise.resolve()
    })
  })
})
