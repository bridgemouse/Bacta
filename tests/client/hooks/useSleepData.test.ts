import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../../client/src/lib/garminApi', () => ({
  fetchSummary: vi.fn(),
  fetchTrend: vi.fn(),
  fetchSources: vi.fn(),
}))

import { fetchSummary, fetchTrend, fetchSources } from '../../../client/src/lib/garminApi'
import { useSleepData } from '../../../client/src/hooks/useSleepData'

const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>
const mockFetchTrend = fetchTrend as ReturnType<typeof vi.fn>
const mockFetchSources = fetchSources as ReturnType<typeof vi.fn>

beforeEach(() => {
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
