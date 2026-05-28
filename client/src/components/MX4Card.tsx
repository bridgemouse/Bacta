import { COLORS, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'

export interface MX4Insight {
  generated_at: string
  summary: string
  tone: 'positive' | 'caution' | 'flag'
  flags: string[]
}

interface MX4CardProps {
  insight: MX4Insight | null
  section: SectionKey
  isGenerating?: boolean
}

const TONE_COLORS: Record<string, string> = {
  positive: COLORS.mx4Green,
  caution:  COLORS.mx4Amber,
  flag:     COLORS.mx4Red,
}

export function MX4Card({ insight, section, isGenerating = false }: MX4CardProps) {
  const accent = SECTION_ACCENTS[section]
  const label = SECTION_LABELS[section]

  if (!insight) {
    return (
      <div
        data-testid="mx4-loading"
        style={{
          background: 'linear-gradient(135deg, #0d2818, #0a1929)',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 12,
        }}
      >
        <div style={{ color: COLORS.textMuted, fontSize: 12 }}>MX-4 · loading…</div>
      </div>
    )
  }

  const pulseColor = TONE_COLORS[insight.tone] ?? COLORS.mx4Green

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0d2818, #0a1929)',
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: pulseColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: pulseColor,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          MX-4 · {label.toUpperCase()}
        </span>
        {isGenerating && (
          <span
            data-testid="mx4-generating"
            style={{ marginLeft: 'auto', color: COLORS.textMuted, fontSize: 10 }}
          >
            updating…
          </span>
        )}
      </div>

      <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
        {insight.summary}
      </p>

      {insight.flags.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {insight.flags.map((flag, i) => (
            <span
              key={i}
              style={{
                background: COLORS.mx4Red + '22',
                color: COLORS.mx4Red,
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 20,
                border: `1px solid ${COLORS.mx4Red}44`,
              }}
            >
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
