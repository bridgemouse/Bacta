// tests/client/AziCard.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { AziCard } from '../../client/src/components/AziCard'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('AziCard', () => {
  test('renders fetched HTML content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<p data-testid="azi-content">AZI-3 briefing</p>'),
    })
    render(<AziCard section="recovery" />)
    await waitFor(() =>
      expect(screen.getByTestId('azi-content')).toBeInTheDocument()
    )
  })

  test('renders nothing when section not found (404)', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const { container } = render(<AziCard section="bloodwork" />)
    await waitFor(() =>
      expect(container.querySelector('[data-azi-card]')).toBeEmptyDOMElement()
    )
  })

  test('shows skeleton while loading', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))  // never resolves
    render(<AziCard section="recovery" />)
    expect(screen.getByTestId('azi-skeleton')).toBeInTheDocument()
  })
})
