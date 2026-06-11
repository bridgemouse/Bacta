import { DAY } from '../../lib/stubData'
import { COLORS, FONT_MONO } from '../../theme'
import { hexA } from '../../lib/hexA'

interface Bars7Props {
  data: number[]
  accent: string
  labels?: readonly string[]
  h?: number
  goal?: number
  fmt?: (v: number) => string
  avg?: boolean
}

/** 7-day bar chart, today (last bar) highlighted, optional goal line + value fmt. */
export function Bars7({ data, accent, labels = DAY, h = 70, goal, fmt, avg }: Bars7Props) {
  const avgVal = avg && data.length > 0 ? data.reduce((s, v) => s + v, 0) / data.length : null
  const max = Math.max(...data, goal ?? 0, avgVal ?? 0) * 1.12 || 1
  const min = 0

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: h }}>
        {data.map((v, i) => {
          const last = i === data.length - 1
          const hp = ((v - min) / (max - min)) * 100
          return (
            <div key={i} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              height: '100%', gap: 4,
            }}>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 7.5,
                color: last ? accent : 'transparent',
                fontWeight: 600,
              }}>
                {fmt ? fmt(v) : v}
              </span>
              <div style={{
                width: '100%',
                height: `${Math.max(hp, 3)}%`,
                borderRadius: 3,
                background: last ? accent : hexA(accent, 0.28),
                boxShadow: last ? `0 0 8px ${hexA(accent, 0.5)}` : 'none',
                transition: 'height .8s cubic-bezier(.4,0,.2,1)',
              }} />
            </div>
          )
        })}
      </div>

      {goal != null && (
        <div style={{
          position: 'absolute', left: 0, right: 0,
          bottom: `${((goal - min) / (max - min)) * h + 18}px`,
          borderTop: `1px dashed ${hexA(COLORS.textSecondary, 0.45)}`,
        }} />
      )}

      {avgVal != null && (
        <div style={{
          position: 'absolute', left: 0, right: 0,
          bottom: `${((avgVal - min) / (max - min)) * h + 18}px`,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          borderTop: `1px solid ${hexA(COLORS.textMuted, 0.3)}`,
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingBottom: 2, paddingRight: 1 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 7, color: COLORS.textMuted, lineHeight: 1 }}>
              {fmt ? fmt(avgVal) : Math.round(avgVal)}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 6, color: COLORS.textMuted, lineHeight: 1.2, opacity: 0.65 }}>
              AVG
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
        {labels.map((l, i) => (
          <span key={i} style={{
            flex: 1, textAlign: 'center',
            fontFamily: FONT_MONO, fontSize: 8,
            color: i === labels.length - 1 ? accent : COLORS.textMuted,
            fontWeight: i === labels.length - 1 ? 700 : 400,
          }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}
