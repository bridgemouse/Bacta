import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SecurityRail } from '../../../client/src/components/SecurityRail'

function mockFetch(configured: boolean) {
  return vi.fn((url: string) => {
    if (url === '/api/auth/status') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
}

describe('SecurityRail — accessible labels (#191)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch(true))
  })

  it('the Current PIN and New PIN fields are reachable via getByLabelText, not placeholder alone', async () => {
    render(<SecurityRail />)
    await waitFor(() => expect(screen.getByLabelText('Current PIN')).toBeInTheDocument())
    expect(screen.getByLabelText('New PIN')).toBeInTheDocument()
  })
})
