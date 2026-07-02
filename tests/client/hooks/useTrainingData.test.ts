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

const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>
const mockFetchTrend = fetchTrend as ReturnType<typeof vi.fn>
const mockFetchActivities = fetchActivities as ReturnType<typeof vi.fn>
const mockFetchWeeklyVolume = fetchWeeklyVolume as ReturnType<typeof vi.fn>
const mockFetchWeeklyAvgHr = fetchWeeklyAvgHr as ReturnType<typeof vi.fn>
const mockFetchWeeklyIntensity = fetchWeeklyIntensity as ReturnType<typeof vi.fn>

beforeEach(() => {
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
})
