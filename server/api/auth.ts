import { Router } from 'express'
import {
  isAuthConfigured, isValidPinFormat, setPin, verifyPin,
  issueToken, verifyToken, parseCookies, SESSION_COOKIE,
} from '../lib/auth'

const authRouter = Router()

// 30-day httpOnly session cookie. Not Secure: the LAN is plaintext HTTP until
// TLS/Tailscale lands (see SECURITY.md). SameSite=Lax + httpOnly still prevent
// JS access and cross-site sends.
function setSessionCookie(res: import('express').Response): void {
  res.cookie(SESSION_COOKIE, issueToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
}

authRouter.get('/status', (req, res) => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  res.json({ configured: isAuthConfigured(), authed: verifyToken(token) })
})

authRouter.post('/login', (req, res) => {
  const { pin } = req.body as { pin?: string }
  if (typeof pin !== 'string' || !verifyPin(pin)) {
    return res.status(401).json({ ok: false, error: 'Incorrect PIN' })
  }
  setSessionCookie(res)
  res.json({ ok: true })
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.json({ ok: true })
})

// Set or change the PIN. If one is already configured, the current PIN is
// required; otherwise this is first-time setup and also logs the device in.
authRouter.post('/set-pin', (req, res) => {
  const { pin, currentPin } = req.body as { pin?: string; currentPin?: string }
  if (typeof pin !== 'string' || !isValidPinFormat(pin)) {
    return res.status(400).json({ ok: false, error: 'PIN must be 4–12 digits' })
  }
  if (isAuthConfigured()) {
    if (typeof currentPin !== 'string' || !verifyPin(currentPin)) {
      return res.status(401).json({ ok: false, error: 'Current PIN incorrect' })
    }
  }
  setPin(pin)
  setSessionCookie(res)
  res.json({ ok: true })
})

export default authRouter
