// tests/client/LogForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { LogForm } from '../../client/src/components/LogForm'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('LogForm', () => {
  test('pre-populates readiness and caffeine from today entry', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          entry: { readiness: 3, caffeine_mg: 200, supplements: '["creatine"]' },
        }),
    })
    render(<LogForm />)
    await waitFor(() => {
      const btn3 = screen.getByRole('button', { name: '3' })
      expect(btn3).toHaveClass('bg-blue-500')
    })
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('200')
  })

  test('pre-populates supplements checkboxes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          entry: { readiness: null, caffeine_mg: null, supplements: '["creatine","vitamin_d"]' },
        }),
    })
    render(<LogForm />)
    await waitFor(() => {
      expect((screen.getByRole('checkbox', { name: /creatine/i }) as HTMLInputElement).checked).toBe(true)
      expect((screen.getByRole('checkbox', { name: /vitamin d/i }) as HTMLInputElement).checked).toBe(true)
      expect((screen.getByRole('checkbox', { name: /omega/i }) as HTMLInputElement).checked).toBe(false)
    })
  })

  test('submits correct payload on save', async () => {
    // First call: GET /api/manual/today (no entry)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry: null }),
    })
    // Second call: POST /api/manual
    mockFetch.mockResolvedValueOnce({ ok: true })

    render(<LogForm />)
    await waitFor(() => screen.getByRole('button', { name: '4' }))

    await userEvent.click(screen.getByRole('button', { name: '4' }))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(mockFetch).toHaveBeenLastCalledWith('/api/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readiness: 4, caffeine_mg: undefined, supplements: [] }),
    })
  })

  test('shows logged confirmation after save', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry: null }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })

    render(<LogForm />)
    await waitFor(() => screen.getByRole('button', { name: /save/i }))

    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/logged/i)).toBeInTheDocument()
  })
})
