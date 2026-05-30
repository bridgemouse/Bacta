interface NavIconProps {
  color?: string
  size?: number
}

export function NavIcon({ color = '#94a3b8', size = 22 }: NavIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
    >
      <polygon points="12,2.8 20.3,7.6 20.3,16.4 12,21.2 3.7,16.4 3.7,7.6" strokeOpacity="0.5" />
      <line x1="8.6" y1="9.6" x2="15.4" y2="9.6" />
      <line x1="8.6" y1="12" x2="15.4" y2="12" />
      <line x1="8.6" y1="14.4" x2="12.8" y2="14.4" />
    </svg>
  )
}
