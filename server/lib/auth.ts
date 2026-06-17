import crypto from 'crypto'
import { getSetting, setSetting } from './settings'

// Single-user app auth: a numeric PIN, hashed with scrypt; sessions are
// stateless HMAC-signed tokens in an httpOnly cookie. No cleartext password is
// ever replayed. Auth is ENFORCED only once a PIN is configured (so tests and a
// fresh box stay open until the user sets one — see startup warning in index.ts).

const PIN_KEY     = 'auth_pin_hash'
const SECRET_KEY  = 'auth_session_secret'
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000  // 30 days
export const SESSION_COOKIE = 'bacta_session'

export function isAuthConfigured(): boolean {
  const h = getSetting(PIN_KEY)
  return !!h && h.length > 0
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,12}$/.test(pin)
}

export function setPin(pin: string): void {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pin, salt, 64).toString('hex')
  setSetting(PIN_KEY, `${salt}:${hash}`)
}

export function verifyPin(pin: string): boolean {
  const stored = getSetting(PIN_KEY)
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(pin, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

function getSessionSecret(): string {
  let secret = getSetting(SECRET_KEY)
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex')
    setSetting(SECRET_KEY, secret)
  }
  return secret
}

export function issueToken(): string {
  const iat = Date.now().toString()
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(iat).digest('base64url')
  return `${iat}.${sig}`
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false
  const [iat, sig] = token.split('.')
  if (!iat || !sig) return false
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(iat).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  return Date.now() - Number(iat) < SESSION_MAX_AGE_MS
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}
