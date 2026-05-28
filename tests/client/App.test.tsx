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
  test('renders home page with Bacta header on /', () => {
    renderApp('/')
    expect(screen.getByText('Bacta')).toBeInTheDocument()
  })

  test('renders menu button on home page', () => {
    renderApp('/')
    expect(screen.getByTestId('menu-button')).toBeInTheDocument()
  })

  test('opens drawer when menu button is clicked', async () => {
    renderApp('/')
    const menuBtn = screen.getByTestId('menu-button')
    await userEvent.click(menuBtn)
    // Drawer nav links should appear
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
  })

  test('renders recovery page on /recovery route', () => {
    renderApp('/recovery')
    const matches = screen.getAllByText('Body Battery')
    expect(matches.length).toBeGreaterThan(0)
  })

  test('renders sleep page on /sleep route', () => {
    renderApp('/sleep')
    expect(screen.getByText('Sleep Score')).toBeInTheDocument()
  })
})
