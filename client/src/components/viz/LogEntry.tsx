import { COLORS, FONT_MONO, FONT_UI } from '../../theme'
import { hexA } from '../../lib/hexA'
import type { Activity } from '../../lib/stubData'

function ActivityGlyph({ name, color, size = 16 }: { name: 'run' | 'strength'; color: string; size?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {name === 'run' ? (
        <g {...p}>
          <circle cx="15.5" cy="5" r="1.8" />
          <path d="M14 9.5 L10 12 L12.5 14.5 L11 20" />
          <path d="M14 9.5 L17.5 11.5 L20 10" />
          <path d="M12.5 14.5 L16 16 L18 21" />
          <path d="M10 12 L6 11.5" />
        </g>
      ) : (
        <g {...p}>
          <line x1="4" y1="9" x2="4" y2="15" />
          <line x1="20" y1="9" x2="20" y2="15" />
          <line x1="7" y1="7" x2="7" y2="17" />
          <line x1="17" y1="7" x2="17" y2="17" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </g>
      )}
    </svg>
  )
}

interface LogEntryProps {
  activity: Activity
  accent: string
}

/** Activity log line — reads like a log entry, not a data row. */
export function LogEntry({ activity: a, accent }: LogEntryProps) {
  const stats = [a.dist, a.dur, a.kcal + ' kcal', a.hr + ' bpm'].filter(Boolean)
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 11,
      background: COLORS.surface, border: `1px solid ${COLORS.line}`,
      borderRadius: 8, padding: '10px 12px', overflow: 'hidden',
    }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: accent, marginRight: -4 }}>›</span>
      <span style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hexA(accent, 0.13), border: `1px solid ${hexA(accent, 0.3)}`,
      }}>
        <ActivityGlyph name={a.sigil} color={accent} size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 650, color: COLORS.text }}>
            {a.type}
          </span>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 8.5, color: accent,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {a.feel}
          </span>
        </div>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textSecondary,
          marginTop: 3, letterSpacing: '0.02em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {stats.join('  ·  ')}
        </div>
      </div>
      <span style={{
        fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted,
        flexShrink: 0, textAlign: 'right', letterSpacing: '0.04em',
      }}>
        {a.when}
      </span>
    </div>
  )
}
