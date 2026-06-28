import { describe, it, expect, beforeEach } from 'vitest'

const TEST_KEY = 'a'.repeat(64) // 64 hex chars = valid 32-byte key

describe('encryption', () => {
  beforeEach(() => {
    process.env.BACTA_ENCRYPTION_KEY = TEST_KEY
  })

  it('encrypt/decrypt roundtrip returns original plaintext', async () => {
    const { encrypt, decrypt } = await import('../../server/lib/integrations/shared/encryption')
    const plain = 'super-secret-token-abc123'
    const cipher = encrypt(plain)
    expect(cipher).not.toBe(plain)
    expect(decrypt(cipher)).toBe(plain)
  })

  it('each encrypt call produces a different ciphertext (random IV)', async () => {
    const { encrypt } = await import('../../server/lib/integrations/shared/encryption')
    const a = encrypt('same')
    const b = encrypt('same')
    expect(a).not.toBe(b)
  })

  it('encrypt(null) returns empty string', async () => {
    const { encrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(encrypt(null)).toBe('')
  })

  it('encrypt(undefined) returns empty string', async () => {
    const { encrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(encrypt(undefined)).toBe('')
  })

  it('decrypt(null) returns null', async () => {
    const { decrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(decrypt(null)).toBeNull()
  })

  it('decrypt empty string returns null', async () => {
    const { decrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(decrypt('')).toBeNull()
  })

  it('decrypt garbage returns null without throwing', async () => {
    const { decrypt } = await import('../../server/lib/integrations/shared/encryption')
    expect(decrypt('not-valid-json')).toBeNull()
  })

  it('stored format is JSON with e, iv, tag fields', async () => {
    const { encrypt } = await import('../../server/lib/integrations/shared/encryption')
    const cipher = encrypt('test')
    const parsed = JSON.parse(cipher)
    expect(parsed).toHaveProperty('e')
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('tag')
  })
})
