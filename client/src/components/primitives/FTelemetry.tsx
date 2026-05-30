import { MX4_COLOR } from '../../theme'

interface FTelemetryProps {
  color?: string
  bars?: number
}

export function FTelemetry({ color = MX4_COLOR, bars = 5 }: FTelemetryProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 2,
            background: color,
            borderRadius: 1,
            transformOrigin: 'bottom',
            height: 12,
            animation: `mx4tele 1.${3 + i}s ease-in-out ${i * 0.12}s infinite`,
            opacity: 0.85,
          }}
        />
      ))}
    </span>
  )
}
