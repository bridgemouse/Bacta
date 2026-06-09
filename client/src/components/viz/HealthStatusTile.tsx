import { COLORS, FONT_MONO, type CardInfo } from '../../theme'
import { hexA } from '../../lib/hexA'
import { Sparkline } from '../primitives/Sparkline'
import { Bracket } from '../primitives/Bracket'
import { Delta } from './Delta'
import { useCardInfoOverlay, InfoOverlay } from '../../lib/InfoCardContext'

interface HealthStatusTileProps {
  label: string
  value: string | number
  unit?: string
  sub?: string
  data?: number[]
  accent: string
  delta?: number
  lowerBetter?: boolean
  inRange?: boolean
  id?: string
  info?: CardInfo
}

export function HealthStatusTile({
  label, value, unit, sub, data, accent,
  delta, lowerBetter, inRange, id, info,
}: HealthStatusTileProps) {
  const cardId = id ?? `hst-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  const { isOpen, handleTap } = useCardInfoOverlay(cardId, info, accent)
  const statusColor = inRange === undefined ? accent : inRange ? COLORS.green : COLORS.amber

  return (
    <div
      onClick={info ? handleTap : undefined}
      style={{
        position: 'relative',
        background: hexA(accent, 0.05),
        border: `1px solid ${COLORS.line}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
        padding: '10px 11px 9px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 6,
        cursor: info ? 'pointer' : 'default',
      }}
    >
      <Bracket color={accent} size={9} sw={1.2} op={0.3} inset={5} />
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
      {sub && (
        <span style={{
          fontFamily: FONT_MONO, fontSize: 8.5,
          color: inRange !== undefined ? statusColor : COLORS.textMuted,
          fontWeight: inRange !== undefined ? 600 : 400,
        }}>
          {sub}
        </span>
      )}
      {data && <Sparkline data={data} accent={accent} w={120} h={18} sw={1.5} dot={false} fill={false} />}
      {isOpen && info && <InfoOverlay info={info} accent={accent} radius={8} compact onClick={handleTap} />}
    </div>
  )
}
