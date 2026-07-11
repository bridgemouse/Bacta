import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
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
})
