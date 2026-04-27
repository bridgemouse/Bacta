// client/src/components/StatTile.tsx

type Props = {
  label: string
  value: number | string | undefined
  unit?: string
  color: string
}

export function StatTile({ label, value, unit, color }: Props) {
  const display = value !== undefined && value !== null ? String(value) : '—'

  return (
    <div className="flex flex-col items-center justify-center rounded-xl p-3 bg-gray-700">
      <span className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color }}>
        {label}
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-xl font-bold text-gray-50">{display}</span>
        {unit && value !== undefined && (
          <span className="text-xs text-gray-400">{unit}</span>
        )}
      </div>
    </div>
  )
}
