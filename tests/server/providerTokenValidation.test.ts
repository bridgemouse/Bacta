import { describe, it, expect } from 'vitest'
import { validateTokenFields } from '../../server/lib/integrations/shared/types'

describe('validateTokenFields (#197)', () => {
  it('returns the object unchanged when all required fields are present', () => {
    const d = { access_token: 'a', refresh_token: 'r', expires_at: 123 }
    expect(validateTokenFields(d, ['access_token', 'refresh_token', 'expires_at'], 'test')).toBe(d)
  })

  it('throws when a required field is missing', () => {
    const d = { access_token: 'a' }
    expect(() => validateTokenFields(d, ['access_token', 'refresh_token'], 'MyProvider exchangeCode'))
      .toThrow(/MyProvider exchangeCode.*refresh_token/)
  })

  it('throws when a required field is null', () => {
    const d = { access_token: 'a', refresh_token: null }
    expect(() => validateTokenFields(d, ['access_token', 'refresh_token'], 'ctx')).toThrow()
  })

  it('throws when the response is not an object', () => {
    expect(() => validateTokenFields(null, ['access_token'], 'ctx')).toThrow()
    expect(() => validateTokenFields(undefined, ['access_token'], 'ctx')).toThrow()
  })

  it('does not throw for an empty-string field — a legitimately empty value, not a missing one', () => {
    const d = { access_token: 'a', refresh_token: '' }
    expect(() => validateTokenFields(d, ['access_token', 'refresh_token'], 'ctx')).not.toThrow()
  })
})
