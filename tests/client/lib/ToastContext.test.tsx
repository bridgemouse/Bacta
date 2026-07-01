import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { ToastProvider, useToast } from '../../../client/src/lib/ToastContext'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
)

afterEach(() => {
  vi.useRealTimers()
})

describe('useToast', () => {
  it('starts with no toasts', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    expect(result.current.toasts).toEqual([])
  })

  it('showToast adds a toast with the given message and level', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => result.current.showToast('Sync failed', 'error'))
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Sync failed')
    expect(result.current.toasts[0].level).toBe('error')
  })

  it('defaults level to error when omitted', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => result.current.showToast('Something went wrong'))
    expect(result.current.toasts[0].level).toBe('error')
  })

  it('dismissToast removes a toast by id', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => result.current.showToast('First'))
    const id = result.current.toasts[0].id
    act(() => result.current.dismissToast(id))
    expect(result.current.toasts).toEqual([])
  })

  it('auto-dismisses a toast after a timeout', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => result.current.showToast('Auto dismiss me'))
    expect(result.current.toasts).toHaveLength(1)
    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current.toasts).toEqual([])
  })

  it('supports multiple simultaneous toasts', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => {
      result.current.showToast('First')
      result.current.showToast('Second')
    })
    expect(result.current.toasts).toHaveLength(2)
  })
})
