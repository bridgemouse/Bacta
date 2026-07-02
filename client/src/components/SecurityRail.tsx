import { useEffect, useState } from 'react'
import { COLORS, MX4_COLOR, FONT_MONO, FONT_UI } from '../theme'
import { hexA } from '../lib/hexA'

// Settings SECURITY content: set or change the app PIN, and lock the device.
// Self-contained so it can drop into the large SettingsPage with one line.
// Renders content only (no Rail label) — SettingsPage wraps it in a CollapsibleSection.
export function SecurityRail() {
  const [configured, setConfigured] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const s = await (await fetch('/api/auth/status')).json()
      setConfigured(!!s.configured)
    } catch { /* leave as-is */ }
  }
  useEffect(() => { refresh() }, [])

  async function savePin() {
    if (busy || !/^\d{4,12}$/.test(newPin)) { setErr(true); setMsg('PIN must be 4–12 digits'); return }
    setBusy(true); setErr(false); setMsg('')
    try {
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin, ...(configured ? { currentPin } : {}) }),
      })
      if (res.ok) {
        setMsg(configured ? 'PIN changed' : 'PIN set — app is now secured')
        setErr(false); setNewPin(''); setCurrentPin(''); setConfigured(true)
      } else {
        const d = await res.json().catch(() => ({}))
        setErr(true); setMsg(d.error ?? 'Could not set PIN')
      }
    } catch {
      setErr(true); setMsg('Connection error')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.reload()
  }

  const card: React.CSSProperties = {
    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
    borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
  }
  const input: React.CSSProperties = {
    fontFamily: FONT_MONO, fontSize: 16, letterSpacing: 4, color: COLORS.text,
    background: COLORS.base, border: `1px solid ${COLORS.line}`, borderRadius: 8,
    padding: '10px 12px', outline: 'none', width: '100%',
  }

  return (
    <>
      <div style={card}>
        <div style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.textSecondary }}>
          {configured
            ? 'A PIN is set. Reaching bacta.local requires unlocking.'
            : 'No PIN set — anyone on the network can open the app. Set a PIN to secure it.'}
        </div>
        {configured && (
          <input style={input} type="password" inputMode="numeric" placeholder="Current PIN"
            value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 12))} />
        )}
        <input style={input} type="password" inputMode="numeric" placeholder={configured ? 'New PIN' : 'Set PIN (4–12 digits)'}
          value={newPin} onChange={e => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12)); setMsg('') }} />
        {msg && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: err ? COLORS.red : COLORS.green }}>{msg}</div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={savePin} disabled={busy} style={{
            flex: 1, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.08em', padding: '8px 12px',
            borderRadius: 8, border: `1px solid ${MX4_COLOR}`, background: hexA(MX4_COLOR, 0.12),
            color: MX4_COLOR, cursor: 'pointer',
          }}>{configured ? 'CHANGE PIN ›' : 'SET PIN ›'}</button>
          {configured && (
            <button onClick={logout} style={{
              flex: 1, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.08em', padding: '8px 12px',
              borderRadius: 8, border: `1px solid ${hexA(COLORS.mx4Red, 0.5)}`, background: hexA(COLORS.mx4Red, 0.1),
              color: COLORS.mx4Red, cursor: 'pointer',
            }}>LOCK NOW ›</button>
          )}
        </div>
      </div>
    </>
  )
}
