import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ErrorBoundary } from '../../../client/src/components/ErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // React logs the caught error to console.error — expected noise for this test, silence it.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('renders a fallback UI instead of unmounting when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('SYSTEM ERROR')).toBeInTheDocument()
  })

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('POSTs the error to /api/logs so it is queryable later, not just console.error (#183)', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/logs', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('boom'),
    }))
  })
})
