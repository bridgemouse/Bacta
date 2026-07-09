// tests/client/App.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
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

afterEach(() => {
  // @ts-expect-error test cleanup of a browser API not in jsdom's Document type
  delete document.startViewTransition
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

  test('uses a view transition when navigating via a Home section tile', async () => {
    // Regression: HomePage's own section tiles (RECOVERY/TRAINING/SLEEP/...) are
    // the primary way users move between sections, but used plain react-router
    // useNavigate() directly instead of useTransitionNavigate() — so every tile
    // click skipped the crossfade entirely, unlike AppShell's back-chevron and
    // BottomSheet's nav-sheet items which were correctly wired in #37/PR #47.
    const startViewTransition = vi.fn((cb: () => void) => cb())
    // @ts-expect-error jsdom does not implement the View Transitions API
    document.startViewTransition = startViewTransition

    renderApp('/')
    await userEvent.click(screen.getByRole('button', { name: /RECOVERY/ }))

    expect(startViewTransition).toHaveBeenCalledTimes(1)
  })

  test('prefetches recovery/sleep/training briefings on Home mount, so a first navigation there is never the stub-then-pop-in flash', () => {
    renderApp('/')

    const requestedUrls = vi.mocked(global.fetch).mock.calls.map(([url]) => url)
    expect(requestedUrls).toContain('/api/insights/recovery')
    expect(requestedUrls).toContain('/api/insights/sleep')
    expect(requestedUrls).toContain('/api/insights/training')
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

  test('does not show title/source text in Resting HR overlay on /recovery (compact pair card)', async () => {
    renderApp('/recovery')
    await userEvent.click(screen.getByText('48'))
    expect(screen.queryByText('RESTING HEART RATE')).not.toBeInTheDocument()
  })

  test('does not show title/source text in Stress overlay on /recovery (compact pair card)', async () => {
    renderApp('/recovery')
    await userEvent.click(screen.getByText('28'))
    expect(screen.queryByText('STRESS SCORE')).not.toBeInTheDocument()
  })

  // SettingsPage's mount-time fetches don't guard on res.ok before calling
  // .json() (pre-existing, unrelated to these tests), so the module-wide
  // { ok: false } default stub throws unhandled rejections on this route —
  // give it real, resolvable JSON responses instead.
  function stubSettingsFetch() {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }))
  }

  test('API key fields default to masked (password), not plaintext, on /settings', async () => {
    stubSettingsFetch()
    renderApp('/settings')
    await userEvent.click(screen.getByText('AI PROVIDER'))
    await userEvent.click(screen.getByText('WEB SEARCH'))

    const keyInputs = screen.getAllByPlaceholderText('Enter key…')
    expect(keyInputs).toHaveLength(2)
    for (const input of keyInputs) {
      expect(input).toHaveAttribute('type', 'password')
    }
  })

  test('custom skills add-form is collapsed behind "ADD SKILL" by default on /settings', async () => {
    stubSettingsFetch()
    renderApp('/settings')
    await userEvent.click(screen.getByText('CUSTOM SKILLS'))

    expect(screen.getByText(/ADD SKILL/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('LABEL')).not.toBeInTheDocument()
  })
})
