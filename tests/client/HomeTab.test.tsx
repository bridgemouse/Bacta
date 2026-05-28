// tests/client/HomeTab.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { HomeTab } from '../../client/src/tabs/HomeTab'

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  // Default: all fetches return empty/null
  mockFetch.mockResolvedValue({ ok: false })
})

function mockSummary(data = {}) {
  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/garmin/summary') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
    }
    return Promise.resolve({ ok: false })
  })
}

describe('HomeTab', () => {
  test('renders stat grid after summary loads', async () => {
    mockSummary({ recovery_score: 74, hrv: 58, sleep_duration: 432 })
    render(<HomeTab />)
    await waitFor(() => expect(screen.getByText('74')).toBeInTheDocument())
    expect(screen.getByText('58')).toBeInTheDocument()
  })

  test('renders steps progress bar when steps available', async () => {
    mockSummary({ steps: 7813 })
    render(<HomeTab />)
    await waitFor(() => expect(screen.getByText('7,813')).toBeInTheDocument())
    expect(screen.getByText(/steps/i)).toBeInTheDocument()
  })

  test('poll button triggers POST /api/poll/force', async () => {
    mockSummary({ steps: 1000 })
    render(<HomeTab />)
    await waitFor(() => screen.getByRole('button', { name: /sync/i }))
    await userEvent.click(screen.getByRole('button', { name: /sync/i }))
    expect(mockFetch).toHaveBeenCalledWith('/api/poll/force', { method: 'POST' })
  })

  test('regenerate button triggers POST /api/azi3/run', async () => {
    mockSummary({ steps: 1000 })
    render(<HomeTab />)
    await waitFor(() => screen.getByRole('button', { name: /regenerate/i }))
    await userEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    expect(mockFetch).toHaveBeenCalledWith('/api/azi3/run', { method: 'POST' })
  })
})
