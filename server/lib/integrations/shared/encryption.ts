import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

interface Encrypted { e: string; iv: string; tag: string }

function getKey(): Buffer {
  const raw = process.env.BACTA_ENCRYPTION_KEY ?? ''
  if (raw.length === 64) return Buffer.from(raw, 'hex')
  if (raw.length === 44) return Buffer.from(raw, 'base64')
  throw new Error('[encryption] BACTA_ENCRYPTION_KEY must be 64 hex chars or 44 base64 chars — generate with: openssl rand -hex 32')
}

export function encrypt(plaintext: string | null | undefined): string {
  if (!plaintext) return ''
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const e = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const result: Encrypted = {
    e:   e.toString('base64'),
    iv:  iv.toString('base64'),
    tag: tag.toString('base64'),
  }
  return JSON.stringify(result)
}

export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null
  try {
    const { e, iv, tag } = JSON.parse(ciphertext) as Encrypted
    const key = getKey()
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return decipher.update(Buffer.from(e, 'base64')).toString('utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}
