import { COLORS, FONT_MONO, FONT_UI } from '../../theme'

interface Zone {
  zone: number
  label: string
  mins: number
  pct: number
  color: string
}

interface ZoneDistributionProps {
  zones: Zone[]
  accent: string
}

export function ZoneDistribution({ zones, accent }: ZoneDistributionProps) {
  const totalMins = Math.round(zones.reduce((s, z) => s + z.mins, 0))
  const z2PlusMins = zones.filter(z => z.zone >= 2).reduce((s, z) => s + z.mins, 0).toFixed(1)

  if (totalMins === 0) return null

  return (
    <div>
      <div style={{
        display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden',
        gap: 2, marginBottom: 13,
      }}>
        {zones.filter(z => z.pct > 0).map(z => (
          <div key={z.zone} style={{
            width: `${z.pct}%`, background: z.color, borderRadius: 3, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {z.pct >= 13 && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, color: '#0b0d12' }}>
                Z{z.zone}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {zones.map(z => {
          const active = z.mins > 0
          return (
            <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: z.color,
                flexShrink: 0, opacity: active ? 1 : 0.25,
              }} />
              <span style={{
                fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, minWidth: 16, flexShrink: 0,
              }}>
                Z{z.zone}
              </span>
              <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: COLORS.textSecondary, flex: 1, minWidth: 0 }}>
                {z.label}
              </span>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 10, fontWeight: active ? 700 : 400,
                color: active ? COLORS.text : COLORS.textMuted,
                minWidth: 34, textAlign: 'right', flexShrink: 0,
              }}>
                {active ? `${z.mins}m` : '—'}
              </span>
              <div style={{
                width: 48, height: 4, borderRadius: 2,
                background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0,
              }}>
                <div style={{
                  width: `${z.pct}%`, height: '100%', background: z.color, borderRadius: 2,
                  opacity: active ? 1 : 0.15,
                }} />
              </div>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted,
                minWidth: 26, textAlign: 'right', flexShrink: 0,
              }}>
                {active ? `${z.pct}%` : ''}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 14 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
          TOTAL{' '}
          <span style={{ color: COLORS.textSecondary, fontWeight: 700 }}>{totalMins} min</span>
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
          Z2+{' '}
          <span style={{ color: accent, fontWeight: 700 }}>{z2PlusMins} min</span>
        </span>
      </div>
    </div>
  )
}
