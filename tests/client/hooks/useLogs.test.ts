import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useLogs } from '../../../client/src/hooks/useLogs'

function jsonResponse(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/logs/sources') return jsonResponse({ sources: ['garmin', 'mx4'] })
    if (url.startsWith('/api/logs')) return jsonResponse({ logs: [] })
    return jsonResponse({})
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useLogs', () => {
  it('fetches available sources on mount', async () => {
    const { result } = renderHook(() => useLogs())

    await waitFor(() => expect(result.current.sources).toEqual(['garmin', 'mx4']))
  })

  it('fetches all logs by default (no source filter in the URL)', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    renderHook(() => useLogs())

    await waitFor(() => {
      const calledUrls = fetchMock.mock.calls.map((c: unknown[]) => c[0])
      expect(calledUrls).toContain('/api/logs')
    })
  })

  it('refetches with a source query param when setActiveSource is called', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    const { result } = renderHook(() => useLogs())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setActiveSource('garmin')
    })

    await waitFor(() => {
      const calledUrls = fetchMock.mock.calls.map((c: unknown[]) => c[0])
      expect(calledUrls).toContain('/api/logs?source=garmin')
    })
  })

  it('populates logs from the response', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/logs/sources') return jsonResponse({ sources: ['garmin'] })
      return jsonResponse({ logs: [{ source: 'garmin', level: 'info', message: 'Sync triggered', created_at: '2026-06-30T03:00:00Z' }] })
    }))

    const { result } = renderHook(() => useLogs())

    await waitFor(() => expect(result.current.logs.length).toBe(1))
    expect(result.current.logs[0].message).toBe('Sync triggered')
  })
})
