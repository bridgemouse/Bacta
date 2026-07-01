import { AppShell } from '../components/AppShell'
import { Rail } from '../components/viz/Rail'
import { COLORS, FONT_MONO, MX4_COLOR } from '../theme'
import { hexA } from '../lib/hexA'
import { useLogs } from '../hooks/useLogs'
import type { LogEntry } from '../hooks/useLogs'

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info:  COLORS.mx4Green,
  warn:  COLORS.mx4Amber,
  error: COLORS.mx4Red,
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
}

export function LogsPage() {
  const { sources, activeSource, setActiveSource, logs, loading } = useLogs()

  return (
    <AppShell section="settings">
      <Rail label="LOGS" accent={MX4_COLOR} right={loading ? 'LOADING' : `${logs.length} ENTRIES`} />

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          onClick={() => setActiveSource('')}
          style={{
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${activeSource === '' ? MX4_COLOR : COLORS.line}`,
            background: activeSource === '' ? hexA(MX4_COLOR, 0.15) : 'none',
            color: activeSource === '' ? MX4_COLOR : COLORS.textSecondary,
          }}
        >
          ALL
        </button>
        {sources.map(source => (
          <button
            key={source}
            onClick={() => setActiveSource(source)}
            style={{
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              padding: '6px 12px', borderRadius: 20, cursor: 'pointer', textTransform: 'uppercase',
              border: `1px solid ${activeSource === source ? MX4_COLOR : COLORS.line}`,
              background: activeSource === source ? hexA(MX4_COLOR, 0.15) : 'none',
              color: activeSource === source ? MX4_COLOR : COLORS.textSecondary,
            }}
          >
            {source}
          </button>
        ))}
      </div>

      {!loading && logs.length === 0 && (
        <div style={{
          fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textMuted,
          textAlign: 'center', padding: '30px 0',
        }}>
          NO LOG ENTRIES
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {logs.map((log, i) => (
          <div
            key={i}
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.line}`,
              borderLeft: `3px solid ${LEVEL_COLOR[log.level]}`,
              borderRadius: 8,
              padding: '9px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: LEVEL_COLOR[log.level],
              }}>
                {log.level}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: '0.08em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
                {log.source}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginLeft: 'auto' }}>
                {formatTimestamp(log.created_at)}
              </span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: COLORS.text, lineHeight: 1.4, wordBreak: 'break-word' }}>
              {log.message}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
