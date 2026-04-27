// client/src/components/TabBar.tsx

export type TabId = 'home' | 'recovery' | 'sleep' | 'training' | 'fitness'

type Tab = { id: TabId; label: string; icon: string }

const TABS: Tab[] = [
  { id: 'home',     label: 'Home',     icon: '🏠' },
  { id: 'recovery', label: 'Recovery', icon: '💙' },
  { id: 'sleep',    label: 'Sleep',    icon: '😴' },
  { id: 'training', label: 'Training', icon: '🏃' },
  { id: 'fitness',  label: 'Fitness',  icon: '📈' },
]

type Props = {
  active: TabId
  onChange: (tab: TabId) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 pb-safe z-50">
      <div className="flex h-14">
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
