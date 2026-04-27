// tests/client/App.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { App } from '../../client/src/App'

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Silence all fetches in App tests — components handle their own data
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
})

describe('App', () => {
  test('renders tab bar with 5 tabs', () => {
    render(<App />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
    expect(screen.getByText('Sleep')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Fitness')).toBeInTheDocument()
  })

  test('shows Home content on initial render', () => {
    render(<App />)
    // Home tab content mounts on first render
    expect(screen.getByTestId('home-tab')).toBeInTheDocument()
  })

  test('lazy-mounts Recovery tab only on first visit', async () => {
    render(<App />)
    expect(screen.queryByTestId('recovery-tab')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Recovery'))
    expect(screen.getByTestId('recovery-tab')).toBeInTheDocument()
  })

  test('keeps tab mounted after switching away', async () => {
    render(<App />)
    await userEvent.click(screen.getByText('Recovery'))
    expect(screen.getByTestId('recovery-tab')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Home'))
    // Recovery tab is still in DOM, just hidden
    expect(screen.getByTestId('recovery-tab')).toBeInTheDocument()
  })
})
