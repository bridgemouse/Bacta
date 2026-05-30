import { COLORS, FONT_MONO, FONT_UI } from '../theme'
import { Sheet, SheetShell, SheetHeader } from './Sheet'
import { MX4Sigil } from './primitives/MX4Sigil'
import { hexA } from '../lib/hexA'

const SUGGESTED_PROMPTS = [
  'How is my recovery trending?',
  "Plan today's training",
  'Why is my HRV up?',
  'Summarize my week',
]

interface AskSheetProps {
  open: boolean
  onClose: () => void
  accent: string
}

export function AskSheet({ open, onClose, accent }: AskSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} maxHeight="88%">
      <SheetShell accent={accent}>
        <SheetHeader
          accent={accent}
          title="MX-4"
          sub="ASK ANYTHING · MEDICAL & PROTOCOL"
          sigil={<MX4Sigil color={accent} size={30} spin glow mood="transmit" />}
          onClose={onClose}
        />

        <div style={{ position: 'relative', overflowY: 'auto', padding: '4px 18px 8px' }}>
          {/* Greeting bubble */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}>
              <MX4Sigil color={accent} size={26} mood="pleased" />
            </span>
            <div
              style={{
                background: hexA(accent, 0.08),
                border: `1px solid ${hexA(accent, 0.22)}`,
                borderRadius: '4px 14px 14px 14px',
                padding: '11px 14px',
              }}
            >
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#eef4fb' }}>
                Standing by, Commander. Ask me about any system, or I can walk your latest readouts. What do you need?
              </p>
            </div>
          </div>

          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.16em',
              color: COLORS.textMuted,
              marginBottom: 10,
            }}
          >
            SUGGESTED
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTED_PROMPTS.map(prompt => (
              <span
                key={prompt}
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 12.5,
                  color: COLORS.textSecondary,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 18,
                  padding: '8px 13px',
                  cursor: 'pointer',
                }}
              >
                {prompt}
              </span>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '12px 16px 28px',
            borderTop: `1px solid ${COLORS.line}`,
            marginTop: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: COLORS.surface,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 11,
              padding: '11px 13px',
            }}
          >
            <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: COLORS.textMuted, letterSpacing: '0.02em' }}>
              Message MX-4
            </span>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 14,
                background: accent,
                animation: 'mx4blink 1.1s step-end infinite',
              }}
            />
          </div>
          <button
            aria-label="Send"
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 11,
              border: `1px solid ${hexA(accent, 0.5)}`,
              background: hexA(accent, 0.14),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" y1="18" x2="18" y2="6" />
              <polyline points="9,6 18,6 18,15" />
            </svg>
          </button>
        </div>
      </SheetShell>
    </Sheet>
  )
}
