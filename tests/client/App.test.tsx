// tests/client/App.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../client/src/App'

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
})

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  )
}

describe('App', () => {
  test('renders home page with BACTA header on /', () => {
    renderApp('/')
    expect(screen.getByText('BACTA')).toBeInTheDocument()
  })

  test('renders nav button on home page', () => {
    renderApp('/')
    expect(screen.getByTestId('nav-button')).toBeInTheDocument()
  })

  test('opens nav sheet when nav button is clicked', async () => {
    renderApp('/')
    const navBtn = screen.getByTestId('nav-button')
    await userEvent.click(navBtn)
    expect(screen.getByText('ALL SYSTEMS')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
  })

  test('renders recovery page on /recovery route', () => {
    renderApp('/recovery')
    expect(screen.getAllByText('RECOVERY').length).toBeGreaterThan(0)
  })

  test('renders sleep page on /sleep route', () => {
    renderApp('/sleep')
    expect(screen.getAllByText('SLEEP').length).toBeGreaterThan(0)
  })

  test('renders recovery content on /recovery route', () => {
    renderApp('/recovery')
    expect(screen.getByText(/READINESS/)).toBeInTheDocument()
  })

  test('renders sleep content on /sleep route', () => {
    renderApp('/sleep')
    expect(screen.getByText(/OVERNIGHT VITALS/)).toBeInTheDocument()
  })

  test('does not render SpO2 tile on /recovery when watch data unavailable', () => {
    renderApp('/recovery')
    expect(screen.queryByText(/SpO₂/)).not.toBeInTheDocument()
  })

  test('does not render SpO2 tiles on /sleep when watch data unavailable', () => {
    renderApp('/sleep')
    expect(screen.queryByText(/SpO₂ avg/)).not.toBeInTheDocument()
    expect(screen.queryByText(/SpO₂ low/)).not.toBeInTheDocument()
  })

  test('renders DAILY ACTIVITY section on /training route', () => {
    renderApp('/training')
    expect(screen.getByText(/DAILY ACTIVITY/)).toBeInTheDocument()
  })

  test('does not render HR ZONES panel on /training when no zone data', () => {
    renderApp('/training')
    expect(screen.queryByText(/HR ZONES/)).not.toBeInTheDocument()
  })
})
