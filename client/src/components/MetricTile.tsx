import { COLORS } from '../theme'

interface MetricTileProps {
  value: string
  unit?: string
  label: string
  accent: string
  progress?: number  // 0–1
  trend?: string
}

export function MetricTile({ value, unit, label, accent, progress, trend }: MetricTileProps) {
  return (
    <div
      style={{
        background: COLORS.surfaceElevated,
        borderRadius: 10,
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ color: accent, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ color: COLORS.textMuted, fontSize: 11 }}>{unit}</span>
        )}
      </div>

      <div style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>{label}</div>

      {trend && (
        <div style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 2 }}>{trend}</div>
      )}

      {progress !== undefined && (
        <div
          data-testid="metric-progress"
          style={{
            height: 2,
            background: COLORS.surface,
            borderRadius: 1,
            marginTop: 6,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(progress * 100, 100)}%`,
              background: accent,
              borderRadius: 1,
            }}
          />
        </div>
      )}
    </div>
  )
}
