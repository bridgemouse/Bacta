import { useToast } from '../lib/ToastContext'
import { COLORS, FONT_MONO, FONT_UI } from '../theme'
import { hexA } from '../lib/hexA'

export function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        left: 10,
        right: 10,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => {
        const accent = toast.level === 'error' ? COLORS.mx4Red : COLORS.mx4Green
        return (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: COLORS.surfaceElevated,
              border: `1px solid ${hexA(accent, 0.4)}`,
              borderLeft: `3px solid ${accent}`,
              borderRadius: 10,
              padding: '10px 12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text, flex: 1, lineHeight: 1.4 }}>
              {toast.message}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted, flexShrink: 0 }}>
              ✕
            </span>
          </div>
        )
      })}
    </div>
  )
}
