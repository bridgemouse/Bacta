import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useTransitionNavigate } from '../../../client/src/lib/useTransitionNavigate'

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return { ...actual, flushSync: vi.fn((cb: () => void) => cb()) }
})
import { flushSync } from 'react-dom'
const mockFlushSync = flushSync as unknown as ReturnType<typeof vi.fn>

afterEach(() => {
  vi.restoreAllMocks()
  // @ts-expect-error test cleanup of a browser API not in jsdom's Document type
  delete document.startViewTransition
})

describe('useTransitionNavigate', () => {
  it('wraps navigation in document.startViewTransition when the browser supports it', () => {
    const startViewTransition = vi.fn((cb: () => void) => cb())
    // @ts-expect-error jsdom does not implement the View Transitions API
    document.startViewTransition = startViewTransition

    const { result } = renderHook(() => useTransitionNavigate(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    })

    result.current('/recovery')

    expect(startViewTransition).toHaveBeenCalledTimes(1)
  })

  it('falls back to a plain navigate when startViewTransition is unsupported (no throw)', () => {
    const { result } = renderHook(() => useTransitionNavigate(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    })

    expect(() => result.current('/recovery')).not.toThrow()
  })

  it('flushes the navigation synchronously inside the transition callback', () => {
    // React batches the navigate() state update; without flushSync the browser
    // can capture its "after" screenshot before React commits the route change,
    // so the crossfade silently never appears. Assert flushSync actually wraps
    // the call, not just that startViewTransition was invoked.
    mockFlushSync.mockClear()
    const startViewTransition = vi.fn((cb: () => void) => cb())
    // @ts-expect-error jsdom does not implement the View Transitions API
    document.startViewTransition = startViewTransition

    const { result } = renderHook(() => useTransitionNavigate(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    })

    result.current('/recovery')

    expect(mockFlushSync).toHaveBeenCalledTimes(1)
  })
})
