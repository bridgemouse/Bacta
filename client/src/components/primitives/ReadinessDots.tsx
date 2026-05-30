interface ReadinessDotsProps {
  value: number
  total?: number
  accent: string
  size?: number
}

export function ReadinessDots({ value, total = 5, accent, size = 7 }: ReadinessDotsProps) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: i < value ? accent : 'transparent',
            border: `1.5px solid ${i < value ? accent : 'rgba(255,255,255,0.18)'}`,
            boxShadow: i < value ? `0 0 5px ${accent}66` : 'none',
          }}
        />
      ))}
    </span>
  )
}
