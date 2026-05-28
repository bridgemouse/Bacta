import { useNavigate } from 'react-router-dom'
import { COLORS } from '../theme'

interface DrawerItemProps {
  section: string
  label: string
  icon: string
  accent: string
  isActive: boolean
  onNavigate: () => void
}

export function DrawerItem({ section, label, icon, accent, isActive, onNavigate }: DrawerItemProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(section === 'home' ? '/' : `/${section}`)
    onNavigate()
  }

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 12px',
        background: isActive ? accent + '18' : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span
        style={{
          color: isActive ? accent : COLORS.textSecondary,
          fontSize: 14,
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {label}
      </span>
    </button>
  )
}
