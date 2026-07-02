import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../../client/src/lib/garminApi', async () => {
  const actual = await vi.importActual<typeof import('../../../client/src/lib/garminApi')>(
    '../../../client/src/lib/garminApi'
  )
  return {
    ...actual,
    fetchSummary: vi.fn(),
    fetchTrend: vi.fn(),
    fetchActivities: vi.fn(),
    fetchWeeklyVolume: vi.fn(),
    fetchWeeklyAvgHr: vi.fn(),
    fetchWeeklyIntensity: vi.fn(),
  }
})

import {
  fetchSummary,
  fetchTrend,
  fetchActivities,
  fetchWeeklyVolume,
  fetchWeeklyAvgHr,
  fetchWeeklyIntensity,
} from '../../../client/src/lib/garminApi'
import { useTrainingData } from '../../../client/src/hooks/useTrainingData'
import { clearCachedData } from '../../../client/src/lib/sectionDataCache'

const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>
const mockFetchTrend = fetchTrend as ReturnType<typeof vi.fn>
const mockFetchActivities = fetchActivities as ReturnType<typeof vi.fn>
const mockFetchWeeklyVolume = fetchWeeklyVolume as ReturnType<typeof vi.fn>
const mockFetchWeeklyAvgHr = fetchWeeklyAvgHr as ReturnType<typeof vi.fn>
const mockFetchWeeklyIntensity = fetchWeeklyIntensity as ReturnType<typeof vi.fn>

beforeEach(() => {
  clearCachedData()
  mockFetchSummary.mockResolvedValue({})
  mockFetchTrend.mockResolvedValue([])
  mockFetchActivities.mockResolvedValue([])
  mockFetchWeeklyVolume.mockResolvedValue([])
  mockFetchWeeklyAvgHr.mockResolvedValue([])
  mockFetchWeeklyIntensity.mockResolvedValue({ moderate: 0, vigorous: 0 })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useTrainingData — status sub-label', () => {
  it('never shows the dead "Block 4 of 8" stub sub-label', async () => {
    mockFetchSummary.mockResolvedValue({ training_status_n: 4, training_status_n_date: '2026-06-30' })

    const { result } = renderHook(() => useTrainingData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data.status.sub).not.toBe('Block 4 of 8')
  })

  it('shows a freshness indicator reflecting the training status snapshot date', async () => {
    mockFetchSummary.mockResolvedValue({ training_status_n: 4, training_status_n_date: '2026-06-30' })

    const { result } = renderHook(() => useTrainingData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data.status.sub).toBe('as of Jun 30')
  })

  it('does not carry a previous test\'s cached data into a fresh mount (shared section cache is cleared per test)', () => {
    // useTrainingData now seeds initial render state from the module-level
    // sectionDataCache (added alongside the view-transition nav cache). If
    // beforeEach didn't clear it, this mount would incorrectly inherit the
    // 'as of Jun 30' value written by the previous test's successful fetch,
    // even though this render's own fetch never resolves.
    mockFetchSummary.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useTrainingData())

    expect(result.current.loading).toBe(true)
    expect(result.current.data.status.sub).not.toBe('as of Jun 30')
  })
})
