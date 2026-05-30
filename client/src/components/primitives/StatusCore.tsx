interface StatusCoreProps {
  accent?: string
  size?: number
  active?: boolean
}

export function StatusCore({ accent = '#4ade80', size = 8, active = true }: StatusCoreProps) {
  return (
    <span
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-block',
        flexShrink: 0,
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: accent,
            animation: 'mx4ping 2.6s cubic-bezier(0,0,.2,1) infinite',
          }}
        />
      )}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: accent,
          boxShadow: active ? `0 0 7px ${accent}` : 'none',
          opacity: active ? 1 : 0.45,
          animation: active ? 'mx4breathe 2.6s ease-in-out infinite' : 'none',
        }}
      />
    </span>
  )
}
