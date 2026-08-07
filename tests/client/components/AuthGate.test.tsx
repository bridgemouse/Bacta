import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthGate } from '../../../client/src/components/AuthGate'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ configured: true, authed: false }),
  }))
})

describe('AuthGate — PIN input accessibility (#188)', () => {
  it('the PIN input has an accessible name, reachable via getByLabelText', async () => {
    render(<AuthGate><div>App content</div></AuthGate>)
    expect(await screen.findByLabelText('PIN')).toBeInTheDocument()
  })
})
