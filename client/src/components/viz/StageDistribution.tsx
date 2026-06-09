import { COLORS, FONT_MONO, FONT_UI } from '../../theme'

interface Stage {
  key: string
  label: string
  mins: number
  pct: number
  color: string
}

interface StageDistributionProps {
  stages: Stage[]
}

export function StageDistribution({ stages }: StageDistributionProps) {
  const rawTotal = stages.reduce((s, st) => s + st.mins, 0)
  if (rawTotal === 0) return null

  // Recalculate pct including awake (hook sets awake.pct = 0)
  const rows = stages.map(st => ({
    ...st,
    barPct: Math.round((st.mins / rawTotal) * 100),
  }))

  const deep = rows.find(s => s.key === 'deep')
  const rem = rows.find(s => s.key === 'rem')

  return (
    <div>
      <div style={{ display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 13 }}>
        {rows.filter(s => s.barPct > 0).map(s => (
          <div key={s.key} style={{ width: `${s.barPct}%`, background: s.color, borderRadius: 3, flexShrink: 0 }} />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map(s => {
          const active = s.mins > 0
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                background: s.color, flexShrink: 0, opacity: active ? 1 : 0.25,
              }} />
              <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: COLORS.textSecondary, flex: 1, minWidth: 0 }}>
                {s.label}
              </span>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 10, fontWeight: active ? 700 : 400,
                color: active ? COLORS.text : COLORS.textMuted,
                minWidth: 34, textAlign: 'right', flexShrink: 0,
              }}>
                {active ? `${s.mins}m` : '—'}
              </span>
              <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${s.barPct}%`, height: '100%', background: s.color, borderRadius: 2, opacity: active ? 1 : 0.15 }} />
              </div>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted,
                minWidth: 26, textAlign: 'right', flexShrink: 0,
              }}>
                {active ? `${s.barPct}%` : ''}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 14 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
          TOTAL{' '}
          <span style={{ color: COLORS.textSecondary, fontWeight: 700 }}>{Math.round(rawTotal)} min</span>
        </span>
        {deep && deep.mins > 0 && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
            DEEP{' '}
            <span style={{ color: deep.color, fontWeight: 700 }}>{deep.barPct}%</span>
          </span>
        )}
        {rem && rem.mins > 0 && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
            REM{' '}
            <span style={{ color: rem.color, fontWeight: 700 }}>{rem.barPct}%</span>
          </span>
        )}
      </div>
    </div>
  )
}
