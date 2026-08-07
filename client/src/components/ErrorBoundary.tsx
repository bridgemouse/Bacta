import { Component, type ReactNode, type ErrorInfo } from 'react'
import { COLORS, FONT_MONO, FONT_UI, MX4_COLOR } from '../theme'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] caught render error:', error)
    const message = error instanceof Error ? error.message : String(error)
    // Best-effort — the whole point is to survive a crash, so a failed log call
    // must never throw or surface to the user on top of the original error.
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, componentStack: errorInfo.componentStack ?? undefined }),
    }).catch(() => {})
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
          background: COLORS.base, color: COLORS.text, textAlign: 'center',
        }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', color: MX4_COLOR }}>
            SYSTEM ERROR
          </span>
          <p style={{ fontFamily: FONT_UI, fontSize: 14, color: COLORS.textSecondary, maxWidth: 320, margin: 0 }}>
            Something went wrong rendering this screen.
          </p>
          <button
            onClick={() => { window.location.href = '/' }}
            style={{
              fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.1em', color: COLORS.base,
              background: MX4_COLOR, border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer',
            }}
          >
            RETURN HOME
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
