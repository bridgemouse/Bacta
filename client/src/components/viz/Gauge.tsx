import { hexA } from '../../lib/hexA'

interface GaugeProps {
  value: number
  max?: number
  accent: string
  size?: number
  stroke?: number
  glow?: boolean
  children?: React.ReactNode
}

/** 270° instrument arc gauge with centered children. */
export function Gauge({ value, max = 100, accent, size = 116, stroke = 7, glow = true, children }: GaugeProps) {
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const arc = 0.74
  const prog = Math.max(0, Math.min(1, value / max))
  const rot = 90 + (1 - arc) * 180

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        <g transform={`rotate(${rot} ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
            strokeDasharray={`${arc * C} ${C}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={accent}
            strokeWidth={stroke}
            strokeDasharray={`${arc * prog * C} ${C}`}
            strokeLinecap="round"
            style={{
              filter: glow ? `drop-shadow(0 0 5px ${hexA(accent, 0.5)})` : 'none',
              transition: 'stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1)',
            }}
          />
        </g>
      </svg>
      {children && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 1,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
