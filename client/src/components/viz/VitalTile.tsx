import { COLORS, FONT_MONO, type CardInfo } from '../../theme'
import { Bracket } from '../primitives/Bracket'
import { Sparkline } from '../primitives/Sparkline'
import { Delta } from './Delta'
import { useCardInfoOverlay, InfoOverlay } from '../../lib/InfoCardContext'

interface VitalTileProps {
  label: string
  value: string | number
  unit?: string
  sub?: string
  data?: number[]
  accent: string
  delta?: number
  lowerBetter?: boolean
  id?: string
  info?: CardInfo
  goal?: number
}

function fmtGoal(g: number): string {
  if (g >= 1000) {
    const k = g / 1000
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`
  }
  return `${g}`
}

export function VitalTile({ label, value, unit, sub, data, accent, delta, lowerBetter, id, info, goal }: VitalTileProps) {
  const cardId = id ?? `vt-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  const { isOpen, handleTap } = useCardInfoOverlay(cardId, info, accent)

  if (goal != null) {
    const progress = Math.min(Number(value) / goal, 1)
    const met = Number(value) >= goal
    const ringColor = met ? COLORS.mx4Green : accent
    const sz = 46, sw = 4
    const r = (sz - sw) / 2
    const C = 2 * Math.PI * r
    const arc = 0.75
    const rot = 90 + (1 - arc) * 180

    return (
      <div
        onClick={info ? handleTap : undefined}
        style={{
          position: 'relative', background: COLORS.surface,
          border: `1px solid ${COLORS.line}`, borderRadius: 8,
          padding: '10px 12px', overflow: 'hidden',
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: info ? 'pointer' : 'default',
        }}
      >
        <Bracket color={accent} size={9} inset={5} op={0.35} radius={3} />
        <div style={{ position: 'relative', width: sz, height: sz, flexShrink: 0 }}>
          <svg width={sz} height={sz} style={{ display: 'block' }}>
            <g transform={`rotate(${rot} ${sz / 2} ${sz / 2})`}>
              <circle cx={sz / 2} cy={sz / 2} r={r} fill="none"
                stroke="rgba(255,255,255,0.07)" strokeWidth={sw}
                strokeDasharray={`${arc * C} ${C}`} strokeLinecap="round" />
              <circle cx={sz / 2} cy={sz / 2} r={r} fill="none"
                stroke={ringColor} strokeWidth={sw}
                strokeDasharray={`${arc * progress * C} ${C}`} strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 3px ${ringColor}40)`, transition: 'stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)' }} />
            </g>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 700, color: ringColor }}>
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: COLORS.textMuted, fontWeight: 600, marginBottom: 3 }}>
            {label}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {value}
            </span>
            {unit && <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>{unit}</span>}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted, marginTop: 2 }}>
            /{fmtGoal(goal)}{unit ? ' ' + unit : ''} goal
          </div>
        </div>
        {isOpen && info && <InfoOverlay info={info} accent={accent} radius={8} compact onClick={handleTap} />}
      </div>
    )
  }

  return (
    <div
      onClick={info ? handleTap : undefined}
      style={{
        position: 'relative', background: COLORS.surface,
        border: `1px solid ${COLORS.line}`, borderRadius: 8,
        padding: '10px 11px 9px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 6,
        cursor: info ? 'pointer' : 'default',
      }}
    >
      <Bracket color={accent} size={9} inset={5} op={0.35} radius={3} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: COLORS.textMuted, fontWeight: 600,
        }}>
          {label}
        </span>
        {delta !== undefined && <Delta value={delta} lowerBetter={lowerBetter} size={8.5} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{unit}</span>}
      </div>
      {sub && <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>{sub}</span>}
      {data && <Sparkline data={data} accent={accent} w={120} h={18} sw={1.5} dot={false} fill={false} />}
      {isOpen && info && <InfoOverlay info={info} accent={accent} radius={8} compact onClick={handleTap} />}
    </div>
  )
}
