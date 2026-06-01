// All imports at top
import { MX4Sigil } from './primitives/MX4Sigil'
import type { MX4Mood } from './primitives/MX4Sigil'
import { FTelemetry } from './primitives/FTelemetry'
import { StatusCore } from './primitives/StatusCore'
import { hexA } from '../lib/hexA'
import { COLORS, FONT_MONO, FONT_UI, toneColor } from '../theme'
import type { Brief } from '../lib/stubData'

// ─── Temporary compatibility stub — removed in Task 3 / Task 5 ───
export interface MX4Insight {
  generated_at: string
  summary: string
  tone: 'positive' | 'caution' | 'flag'
  flags: string[]
}

/** @deprecated Use TransmissionPanel instead. This stub returns null until pages are updated in Tasks 3 and 5. */
export function MX4Card(_props: { insight: MX4Insight | null; section: string; isGenerating?: boolean }): null {
  return null
}
// ────────────────────────────────────────────────────────────────

// ─── New API ─────────────────────────────────────────────────────
interface TransmissionPanelProps {
  accent: string
  mood?: MX4Mood
  label?: string
  meta?: string
  assessment: string
  chips?: [string, string][]
}

const DEFAULT_CHIPS: [string, string][] = [
  ['TONE', 'POSITIVE'],
  ['FLAGS', '0'],
  ['SYNC', 'OK'],
]

// ─── MX4Briefing — section accent card with verdict badge ────────────────────
interface MX4BriefingProps {
  accent: string
  brief: Brief
}

export function MX4Briefing({ accent, brief }: MX4BriefingProps) {
  const tc = toneColor(brief.tone)
  const verdictLabel = brief.tone === 'flag' ? 'FLAG' : brief.tone === 'caution' ? 'CAUTION' : 'POSITIVE'

  return (
    <div
      style={{
        position: 'relative',
        background: `linear-gradient(160deg, ${hexA(accent, 0.10)}, ${COLORS.surface} 55%)`,
        border: `1px solid ${hexA(accent, 0.35)}`,
        borderRadius: 14,
        boxShadow: `0 0 32px ${hexA(accent, 0.08)}`,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px 11px' }}>
        <MX4Sigil color={accent} size={19} spin mood={brief.mood} />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: accent,
            flex: 1,
            minWidth: 0,
          }}
        >
          INCOMING // MX-4
        </span>
        {brief.meta && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', color: COLORS.textMuted, flexShrink: 0 }}>
            {brief.meta}
          </span>
        )}
        {/* Verdict badge — tone color only appears here */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: FONT_MONO,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            padding: '3px 9px',
            borderRadius: 20,
            background: hexA(tc, 0.18),
            color: tc,
            border: `1px solid ${hexA(tc, 0.4)}`,
            flexShrink: 0,
          }}
        >
          <StatusCore accent={tc} size={5} />
          {verdictLabel}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '0 15px 13px' }}>
        <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 16, lineHeight: 1.55, color: '#eef4fb' }}>
          {brief.line}
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 7,
              height: '0.9em',
              background: accent,
              marginLeft: 3,
              verticalAlign: 'middle',
              animation: 'mx4blink 1.1s step-end infinite',
            }}
          />
        </p>
      </div>

      {/* Chips */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 15px 13px',
          borderTop: `1px solid ${hexA(accent, 0.18)}`,
        }}
      >
        {brief.chips.map(([key, val]) => (
          <span key={key} style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
            {key}{' '}
            <span style={{ color: accent }}>{val}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          <FTelemetry color={accent} bars={4} />
        </span>
      </div>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export function TransmissionPanel({
  accent,
  mood = 'transmit',
  label = 'INCOMING // MX-4',
  meta,
  assessment,
  chips = DEFAULT_CHIPS,
}: TransmissionPanelProps) {
  return (
    <div
      style={{
        position: 'relative',
        background: `linear-gradient(160deg, ${hexA(accent, 0.10)}, ${COLORS.surface} 50%)`,
        border: `1px solid ${hexA(accent, 0.35)}`,
        borderRadius: 14,
        boxShadow: `0 0 32px ${hexA(accent, 0.08)}`,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px 11px' }}>
        <MX4Sigil color={accent} size={19} spin mood={mood} />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: accent,
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </span>
        {meta && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 8.5,
              letterSpacing: '0.08em',
              color: COLORS.textMuted,
              flexShrink: 0,
            }}
          >
            {meta}
          </span>
        )}
      </div>

      <div style={{ padding: '0 15px 13px' }}>
        <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 16.5, lineHeight: 1.5, color: '#eef4fb' }}>
          {assessment}
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 7,
              height: '0.9em',
              background: accent,
              marginLeft: 3,
              verticalAlign: 'middle',
              animation: 'mx4blink 1.1s step-end infinite',
            }}
          />
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 15px 13px',
          borderTop: `1px solid ${hexA(accent, 0.18)}`,
        }}
      >
        {chips.map(([key, val]) => (
          <span key={key} style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
            {key}{' '}
            <span style={{ color: accent }}>{val}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          <FTelemetry color={accent} bars={4} />
        </span>
      </div>
    </div>
  )
}
