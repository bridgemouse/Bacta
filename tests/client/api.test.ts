// tests/client/api.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  getGarminSummary,
  getInsight,
  getMetricHistory,
  getManualToday,
  postManual,
  triggerPoll,
} from '../../client/src/api'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('getGarminSummary', () => {
  test('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ steps: 7813, hrv: 58 }) })
    const result = await getGarminSummary()
    expect(result).toEqual({ steps: 7813, hrv: 58 })
    expect(mockFetch).toHaveBeenCalledWith('/api/garmin/summary')
  })

  test('returns empty object on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await getGarminSummary()
    expect(result).toEqual({})
  })
})

describe('getInsight', () => {
  test('returns HTML string on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('<p>AZI-3</p>') })
    const result = await getInsight('recovery')
    expect(result).toBe('<p>AZI-3</p>')
    expect(mockFetch).toHaveBeenCalledWith('/api/insights/recovery')
  })

  test('returns null on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await getInsight('bloodwork')
    expect(result).toBeNull()
  })
})

describe('getMetricHistory', () => {
  test('returns rows array on success', async () => {
    const rows = [{ date: '2026-04-27', metric: 'hrv', value: 58, unit: 'ms' }]
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ metric: 'hrv', rows }) })
    const result = await getMetricHistory('hrv', 7)
    expect(result).toEqual(rows)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/garmin/hrv?from='))
  })

  test('returns empty array on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await getMetricHistory('vo2max', 7)
    expect(result).toEqual([])
  })
})

describe('getManualToday', () => {
  test('returns entry on success', async () => {
    const entry = { date: '2026-04-27', readiness: 3, caffeine_mg: 200, supplements: '["creatine"]' }
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ entry }) })
    const result = await getManualToday()
    expect(result).toEqual(entry)
  })

  test('returns null when no entry', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ entry: null }) })
    const result = await getManualToday()
    expect(result).toBeNull()
  })
})

describe('postManual', () => {
  test('posts JSON to /api/manual', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await postManual({ readiness: 4, caffeine_mg: 100, supplements: ['creatine'] })
    expect(mockFetch).toHaveBeenCalledWith('/api/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readiness: 4, caffeine_mg: 100, supplements: ['creatine'] }),
    })
  })
})

describe('triggerPoll', () => {
  test('posts to /api/poll/force', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await triggerPoll()
    expect(mockFetch).toHaveBeenCalledWith('/api/poll/force', { method: 'POST' })
  })
})
