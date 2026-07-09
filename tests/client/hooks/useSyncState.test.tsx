import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { ToastProvider, useToast } from '../../../client/src/lib/ToastContext'
import { useSyncState } from '../../../client/src/hooks/useSyncState'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
)

function useCombined() {
  return { sync: useSyncState(), toast: useToast() }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useSyncState — error toast', () => {
  it('shows an error toast when the sync poller reports a failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'error', elapsed: null }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    const { result } = renderHook(() => useCombined(), { wrapper })

    await act(async () => {
      await result.current.sync.startSync()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(result.current.toast.toasts.length).toBeGreaterThan(0)
    expect(result.current.toast.toasts[0].level).toBe('error')
  })

  it('resets status back to idle after pollStatus observes an error, matching startSync\'s catch behavior', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'error', elapsed: null }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    const { result } = renderHook(() => useCombined(), { wrapper })

    await act(async () => {
      await result.current.sync.startSync()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(result.current.sync.status).toBe('error')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(result.current.sync.status).toBe('idle')
  })

  it('does not clobber a retried sync with the previous error\'s pending idle-reset timer', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) }) // initial sync POST
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'error', elapsed: null }) }) // poll -> error
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) }) // retry sync POST
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'running', elapsed: 4 }) }) // subsequent polls
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    const { result } = renderHook(() => useCombined(), { wrapper })

    await act(async () => {
      await result.current.sync.startSync()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(result.current.sync.status).toBe('error')

    // Retry within the 3s idle-reset window the error branch scheduled.
    await act(async () => {
      await result.current.sync.startSync()
    })
    expect(result.current.sync.status).toBe('running')

    // Advance exactly to when the stale idle-reset timer from the first
    // error would fire (scheduled for +3000ms from the error at t=2000, i.e.
    // t=5000). A later poll tick would mask the bug by re-setting 'running',
    // so assert right at this boundary, not past it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(result.current.sync.status).toBe('running')
  })

  it('shows an error toast when triggering the sync request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    const { result } = renderHook(() => useCombined(), { wrapper })

    await act(async () => {
      await result.current.sync.startSync()
    })

    expect(result.current.toast.toasts.length).toBeGreaterThan(0)
    expect(result.current.toast.toasts[0].level).toBe('error')
  })

  it('does not show a toast while sync is still running', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'running', elapsed: 4 }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    const { result } = renderHook(() => useCombined(), { wrapper })

    await act(async () => {
      await result.current.sync.startSync()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(result.current.toast.toasts).toEqual([])
  })
})
