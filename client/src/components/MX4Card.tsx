// All imports at top
import ReactMarkdown from 'react-markdown'
import { MX4Sigil } from './primitives/MX4Sigil'
import type { MX4Mood } from './primitives/MX4Sigil'
import { FTelemetry } from './primitives/FTelemetry'
import { StatusCore } from './primitives/StatusCore'
import { hexA } from '../lib/hexA'
import { COLORS, FONT_MONO, FONT_UI, toneColor } from '../theme'
import type { Brief } from '../lib/stubData'
import type { BriefingResult } from '../lib/briefing'

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
  accent:    string
  brief:     Brief
  liveData?: BriefingResult
}

export function MX4Briefing({ accent, brief, liveData }: MX4BriefingProps) {
  const rawTone    = liveData ? liveData.tone.toLowerCase() as 'positive' | 'caution' | 'flag' : brief.tone
  const activeMood: MX4Mood = liveData
    ? (liveData.tone === 'POSITIVE' ? 'pleased' : 'alert')
    : brief.mood
  const activeMeta = liveData?.generated_at
    ? (() => {
        const d = new Date(liveData.generated_at)
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
      })()
    : brief.meta

  const tc = toneColor(rawTone)
  const verdictLabel = rawTone === 'flag' ? 'FLAG' : rawTone === 'caution' ? 'CAUTION' : 'POSITIVE'

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
        <MX4Sigil color={accent} size={19} spin mood={activeMood} />
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
        {activeMeta && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', color: COLORS.textMuted, flexShrink: 0 }}>
            {activeMeta}
          </span>
        )}
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

      {/* Body — live markdown or stub text */}
      <div style={{ padding: '0 15px 13px' }}>
        {liveData ? (
          <>
            <p style={{ margin: '0 0 7px 0', fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: accent }}>
              {liveData.headline}
            </p>
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p style={{ margin: '0 0 8px 0', fontFamily: FONT_UI, fontSize: 15, lineHeight: 1.55, color: '#eef4fb' }}>
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong style={{ color: accent, fontWeight: 600 }}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em style={{ color: COLORS.textSecondary, fontStyle: 'italic' }}>{children}</em>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: '0 0 8px 0', paddingLeft: 18 }}>{children}</ul>
                ),
                li: ({ children }) => (
                  <li style={{ fontFamily: FONT_UI, fontSize: 14, lineHeight: 1.5, color: '#eef4fb', marginBottom: 3 }}>{children}</li>
                ),
              }}
            >
              {liveData.body}
            </ReactMarkdown>
            <div
              style={{
                marginTop: 8,
                padding: '7px 10px',
                background: hexA(accent, 0.07),
                borderLeft: `2px solid ${hexA(accent, 0.5)}`,
                borderRadius: '0 6px 6px 0',
              }}
            >
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: accent, fontWeight: 700 }}>DIRECTIVE · </span>
              <span style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text, lineHeight: 1.4 }}>{liveData.recommendation}</span>
            </div>
          </>
        ) : (
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
        )}
      </div>

      {/* Footer chips */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 15px 13px',
          borderTop: `1px solid ${hexA(accent, 0.18)}`,
        }}
      >
        {liveData ? (
          <>
            <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
              FLAGS <span style={{ color: liveData.flags.length > 0 ? tc : accent }}>{liveData.flags.length}</span>
            </span>
            {liveData.flags.slice(0, 2).map((flag, i) => (
              <span key={i} style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: '0.08em', color: COLORS.textMuted }}>
                · {flag.toUpperCase()}
              </span>
            ))}
          </>
        ) : (
          brief.chips.map(([key, val]) => (
            <span key={key} style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
              {key}{' '}
              <span style={{ color: accent }}>{val}</span>
            </span>
          ))
        )}
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
