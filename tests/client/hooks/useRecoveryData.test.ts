import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../../client/src/lib/garminApi', () => ({
  fetchSummary: vi.fn(),
  fetchTrend: vi.fn(),
  fetchSources: vi.fn(),
}))

import { fetchSummary, fetchTrend, fetchSources } from '../../../client/src/lib/garminApi'
import { useRecoveryData } from '../../../client/src/hooks/useRecoveryData'

const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>
const mockFetchTrend = fetchTrend as ReturnType<typeof vi.fn>
const mockFetchSources = fetchSources as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetchSummary.mockResolvedValue({})
  mockFetchTrend.mockResolvedValue([])
  mockFetchSources.mockResolvedValue({})
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useRecoveryData — sources', () => {
  it('defaults sources to empty object before data loads', () => {
    // Don't resolve the promises yet — check initial state
    mockFetchSummary.mockReturnValue(new Promise(() => {}))
    mockFetchTrend.mockReturnValue(new Promise(() => {}))
    mockFetchSources.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useRecoveryData())
    expect(result.current.sources).toEqual({})
  })

  it('populates sources from fetchSources response', async () => {
    mockFetchSources.mockResolvedValue({ hrv: 'oura', resting_hr: 'whoop' })

    const { result } = renderHook(() => useRecoveryData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sources['hrv']).toBe('oura')
    expect(result.current.sources['resting_hr']).toBe('whoop')
  })

  it('defaults sources to empty object when fetchSources returns empty', async () => {
    mockFetchSources.mockResolvedValue({})

    const { result } = renderHook(() => useRecoveryData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sources).toEqual({})
  })

  it('keeps sources as empty object when fetchSummary throws', async () => {
    mockFetchSummary.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useRecoveryData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sources).toEqual({})
  })

  it('returns sources in the hook return value', async () => {
    mockFetchSources.mockResolvedValue({ body_battery_wake: 'garmin' })

    const { result } = renderHook(() => useRecoveryData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current).toHaveProperty('sources')
    expect(typeof result.current.sources).toBe('object')
  })
})

describe('useRecoveryData — sync refresh', () => {
  it('refetches Body Battery when bacta:sync-complete event fires', async () => {
    mockFetchSummary.mockResolvedValue({ body_battery_current: 85, body_battery_wake: 90 })

    const { result } = renderHook(() => useRecoveryData())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data.battery.now).toBe(85)

    // Simulate new data arriving after sync
    mockFetchSummary.mockResolvedValue({ body_battery_current: 60, body_battery_wake: 90 })

    await act(async () => {
      window.dispatchEvent(new CustomEvent('bacta:sync-complete'))
    })

    await waitFor(() => expect(result.current.data.battery.now).toBe(60))
  })
})
