import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useTransitionNavigate } from '../../../client/src/lib/useTransitionNavigate'

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
})
