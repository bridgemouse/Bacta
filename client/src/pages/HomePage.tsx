import { AppShell } from '../components/AppShell'
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
  { section: 'recovery',  status: 'Good',      metric: 'HRV ↑ · Battery 74' },
  { section: 'training',  status: 'On track',  metric: 'Load: Moderate' },
  { section: 'sleep',     status: '8.1h',       metric: 'Score: 82' },
  { section: 'nutrition', status: 'On target', metric: '2,340 / 2,500 kcal' },
  { section: 'bloodwork', status: 'No flags',  metric: 'Last panel: —' },
  { section: 'dailylog',  status: 'Logged',    metric: 'Readiness: 4/5' },
]

export function HomePage() {
  return (
    <AppShell section="home">
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
            <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{status}</div>
            <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>{metric}</div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
