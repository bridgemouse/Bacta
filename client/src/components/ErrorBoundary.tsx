import { Component, type ReactNode } from 'react'
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

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary] caught render error:', error)
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
