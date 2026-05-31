import { COLORS } from '../../theme'
import { hexA } from '../../lib/hexA'

interface BodyBatteryProps {
  now: number
  max: number
  min: number
  accent: string
  height?: number
}

/** Charge-cell bar: min→max band + current fill marker + ticks at 25/50/75. */
export function BodyBattery({ now, max, min, accent, height = 13 }: BodyBatteryProps) {
  const lo = (min / 100) * 100
  const span = ((max - min) / 100) * 100

  return (
    <div style={{
      position: 'relative', width: '100%', height,
      borderRadius: height / 2,
      background: COLORS.base,
      border: `1px solid ${COLORS.line}`,
      overflow: 'hidden',
    }}>
      {/* depletion-to-peak band */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: `${lo}%`, width: `${span}%`,
        background: `linear-gradient(90deg, ${hexA(accent, 0.25)}, ${hexA(accent, 0.6)})`,
      }} />
      {/* current fill */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: 0, width: `${now}%`,
        background: `linear-gradient(90deg, ${hexA(accent, 0.15)}, ${accent})`,
        boxShadow: `0 0 8px ${hexA(accent, 0.5)}`,
      }} />
      {/* tick marks */}
      {[25, 50, 75].map(t => (
        <span key={t} style={{
          position: 'absolute', top: 2, bottom: 2,
          left: `${t}%`, width: 1,
          background: 'rgba(0,0,0,0.4)',
        }} />
      ))}
    </div>
  )
}
