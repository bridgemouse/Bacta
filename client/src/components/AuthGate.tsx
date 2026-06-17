import { useEffect, useState, type ReactNode } from 'react'
import { COLORS, MX4_COLOR, FONT_UI, FONT_MONO } from '../theme'
import { hexA } from '../lib/hexA'

type Phase = 'checking' | 'locked' | 'open'

/**
 * Gates the whole app behind a PIN once one is configured server-side.
 * If no PIN is set (fresh box / tests), the API is open and this renders children.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function check() {
    try {
      const res = await fetch('/api/auth/status')
      const s = await res.json()
      setPhase(!s.configured || s.authed ? 'open' : 'locked')
    } catch {
      setPhase('open') // never hard-lock the user out on a transient error
    }
  }

  useEffect(() => { check() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || pin.length < 4) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        setPin('')
        setPhase('open')
      } else {
        setError('Incorrect PIN')
        setPin('')
      }
    } catch {
      setError('Connection error')
    } finally {
      setBusy(false)
    }
  }

  // Children are always mounted; the lock screen is a full-viewport overlay shown
  // only when the server reports a configured-but-unauthenticated session. All
  // data endpoints are server-enforced (401) regardless of this overlay.
  if (phase !== 'locked') return <>{children}</>

  return (
    <div style={{
      position: 'fixed', inset: 0, background: COLORS.base,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 28, padding: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 13, letterSpacing: 4, color: MX4_COLOR,
          textTransform: 'uppercase',
        }}>BACTA·OS</div>
        <div style={{
          fontFamily: FONT_UI, fontSize: 15, color: COLORS.textSecondary, marginTop: 8,
        }}>Locked — enter PIN</div>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 12)); setError('') }}
          placeholder="••••"
          style={{
            width: 200, textAlign: 'center',
            fontFamily: FONT_MONO, fontSize: 16, letterSpacing: 8, color: COLORS.text,
            background: COLORS.surface,
            border: `1px solid ${error ? COLORS.red : COLORS.line}`,
            borderRadius: 12, padding: '14px 16px', outline: 'none',
          }}
        />
        <div style={{
          minHeight: 16, fontFamily: FONT_MONO, fontSize: 12, color: COLORS.red,
        }}>{error}</div>
        <button
          type="submit"
          disabled={busy || pin.length < 4}
          style={{
            width: 200, padding: '12px 0',
            fontFamily: FONT_MONO, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
            color: pin.length < 4 ? COLORS.textMuted : COLORS.base,
            background: pin.length < 4 ? COLORS.surface : MX4_COLOR,
            border: `1px solid ${pin.length < 4 ? COLORS.line : MX4_COLOR}`,
            borderRadius: 12, cursor: pin.length < 4 ? 'default' : 'pointer',
            boxShadow: pin.length < 4 ? 'none' : `0 0 20px ${hexA(MX4_COLOR, 0.25)}`,
          }}
        >{busy ? 'Verifying' : 'Unlock'}</button>
      </form>
    </div>
  )
}
