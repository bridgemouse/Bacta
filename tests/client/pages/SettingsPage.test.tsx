import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SettingsPage } from '../../../client/src/pages/SettingsPage'

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function mockFetch() {
  return vi.fn((url: string) => {
    if (url === '/api/settings') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    if (url === '/api/settings/custom-skills') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ skills: [] }) })
    }
    if (url === '/api/integrations/status') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
}

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsPage />
    </MemoryRouter>
  )
}

describe('SettingsPage — Restart Bacta', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch())
  })

  // #134: window.confirm() appears to silently no-op in the iOS home-screen
  // PWA, so restartBacta()'s fetch never fires — clicking RESTART does
  // nothing, with no error surfaced, because the confirm() gate itself is
  // the failure point. Replacing it with an in-app dialog must not depend
  // on window.confirm at all — this test doesn't stub it, so if the
  // component still calls it, jsdom's real (no-op-ish) confirm would return
  // undefined/false and the fetch would never happen, failing this test.
  test('clicking RESTART then confirming in the in-app dialog calls the restart endpoint', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(await screen.findByText('INSTANCE'))
    const restartButton = await screen.findByText('RESTART ›')
    await user.click(restartButton)

    const confirmButton = await screen.findByText('CONFIRM')
    await user.click(confirmButton)

    expect(fetch).toHaveBeenCalledWith('/api/settings/restart', { method: 'POST' })
  })

  test('clicking RESTART then cancelling in the in-app dialog does not call the restart endpoint', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(await screen.findByText('INSTANCE'))
    const restartButton = await screen.findByText('RESTART ›')
    await user.click(restartButton)

    const cancelButton = await screen.findByText('CANCEL')
    await user.click(cancelButton)

    expect(fetch).not.toHaveBeenCalledWith('/api/settings/restart', { method: 'POST' })
  })

  // Every other overlay in the app (Sheet, used by BottomSheet/AskSheet) dismisses
  // on Escape — ConfirmDialog should match that convention rather than trap the
  // user with only CANCEL/CONFIRM as exits.
  test('pressing Escape dismisses the in-app dialog without calling the restart endpoint', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(await screen.findByText('INSTANCE'))
    const restartButton = await screen.findByText('RESTART ›')
    await user.click(restartButton)

    await screen.findByText('CONFIRM')
    await user.keyboard('{Escape}')

    expect(screen.queryByText('CONFIRM')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalledWith('/api/settings/restart', { method: 'POST' })
  })
})

describe('SettingsPage — Application logs row (#190)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch())
  })

  test('the Application logs row is keyboard-operable — reachable via getByRole and navigates with Enter', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/logs" element={<div>LOGS PAGE</div>} />
        </Routes>
      </MemoryRouter>
    )
    const user = userEvent.setup()
    await user.click(await screen.findByText('DIAGNOSTICS'))
    const row = await screen.findByRole('button', { name: /application logs/i })
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(await screen.findByText('LOGS PAGE')).toBeInTheDocument()
  })
})

describe('SettingsPage — iOS zoom-on-focus (#178)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch())
  })

  test('AI provider API key input uses font-size 16', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByText('AI PROVIDER'))
    expect(screen.getByPlaceholderText('Enter key…')).toHaveStyle({ fontSize: '16px' })
  })

  test('MX-4 briefing model select and chat compression threshold input use font-size 16', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByText('MX-4 INTELLIGENCE'))
    const selects = screen.getAllByRole('combobox')
    expect(selects[0]).toHaveStyle({ fontSize: '16px' })
    expect(screen.getByRole('spinbutton')).toHaveStyle({ fontSize: '16px' })
  })

  test('Instance base URL input and Garmin background-sync select use font-size 16', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByText('INSTANCE'))
    expect(screen.getByPlaceholderText('http://bacta.home')).toHaveStyle({ fontSize: '16px' })
    await user.click(await screen.findByText('GARMIN'))
    expect(screen.getByDisplayValue('Every hour')).toHaveStyle({ fontSize: '16px' })
  })
})
