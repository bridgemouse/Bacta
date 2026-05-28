// tests/client/TrendChart.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { TrendChart } from '../../client/src/components/TrendChart'

// Recharts uses ResizeObserver which jsdom doesn't have
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('TrendChart', () => {
  test('renders chart container after data loads', async () => {
    const rows = [
      { date: '2026-04-21', metric: 'hrv', value: 55, unit: 'ms' },
      { date: '2026-04-22', metric: 'hrv', value: 58, unit: 'ms' },
    ]
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ metric: 'hrv', rows }),
    })
    render(<TrendChart metric="hrv" days={7} />)
    await waitFor(() =>
      expect(screen.getByTestId('trend-chart')).toBeInTheDocument()
    )
  })

  test('renders empty state when no data', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    render(<TrendChart metric="vo2max" days={7} />)
    await waitFor(() =>
      expect(screen.getByTestId('trend-chart-empty')).toBeInTheDocument()
    )
  })
})
