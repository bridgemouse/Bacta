import { PageShell } from '../components/PageShell'
import { COLORS } from '../theme'

const TABS = ['Overview', 'Results', 'Trends']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: 'No panels uploaded yet. Upload your lab results to get MX-4\'s read on your blood work.',
  tone: 'caution' as const,
  flags: [],
}

interface BloodWorkPageProps { onMenuOpen: () => void }

export function BloodWorkPage({ onMenuOpen }: BloodWorkPageProps) {
  return (
    <PageShell section="bloodwork" tabs={TABS} insight={MOCK_INSIGHT} onMenuOpen={onMenuOpen}>
      <div style={{
        background: COLORS.surfaceElevated,
        borderRadius: 10,
        padding: '20px 16px',
        textAlign: 'center',
        color: COLORS.textMuted,
        fontSize: 13,
      }}>
        No blood work panels uploaded yet.
      </div>
    </PageShell>
  )
}
