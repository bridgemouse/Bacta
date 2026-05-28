import { COLORS, SECTION_ACCENTS, SECTION_LABELS, SECTION_ICONS } from '../theme'
import type { SectionKey } from '../theme'
import { MX4Card, type MX4Insight } from '../components/MX4Card'

const MOCK_HOME_INSIGHT: MX4Insight = {
  generated_at: new Date().toISOString(),
  summary: 'Recovery looking solid. Training load on track. Nutrition close — protein slightly under target. MX-4 standing by.',
  tone: 'positive',
  flags: [],
}

const MOCK_TILES: Array<{ section: SectionKey; status: string; metric: string }> = [
  { section: 'recovery',  status: 'Good',       metric: 'HRV ↑ · Battery 74' },
  { section: 'training',  status: 'On track',   metric: 'Load: Moderate' },
  { section: 'sleep',     status: '8.1h',        metric: 'Score: 82' },
  { section: 'nutrition', status: 'On target',  metric: '2,340 / 2,500 kcal' },
  { section: 'bloodwork', status: 'No flags',   metric: 'Last panel: —' },
  { section: 'dailylog',  status: 'Logged',     metric: 'Readiness: 4/5' },
]

interface HomePageProps {
  onMenuOpen: () => void
}

export function HomePage({ onMenuOpen }: HomePageProps) {
  return (
    <div style={{ minHeight: '100dvh', background: COLORS.base, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        paddingTop: 'calc(14px + env(safe-area-inset-top))',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
      }}>
        <button
          data-testid="menu-button"
          onClick={onMenuOpen}
          style={{ background: 'none', border: 'none', color: COLORS.textSecondary, fontSize: 20, cursor: 'pointer', padding: 4 }}
        >
          ☰
        </button>
        <span style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600 }}>Bacta</span>
        <div style={{ width: 28 }} />
      </div>

      <div style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' }}>
        <MX4Card insight={MOCK_HOME_INSIGHT} section="home" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          {MOCK_TILES.map(({ section, status, metric }) => (
            <div
              key={section}
              style={{
                background: COLORS.surfaceElevated,
                borderRadius: 10,
                padding: '10px 12px',
                borderLeft: `3px solid ${SECTION_ACCENTS[section]}`,
              }}
            >
              <div style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {SECTION_ICONS[section]} {SECTION_LABELS[section]}
              </div>
              <div style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600 }}>{status}</div>
              <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>{metric}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
