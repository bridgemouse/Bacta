import { AppShell } from '../components/AppShell'
import { MX4Card } from '../components/MX4Card'
import { COLORS } from '../theme'

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: "No panels uploaded yet. Upload your lab results to get MX-4's read on your blood work.",
  tone: 'caution' as const,
  flags: [],
}

export function BloodWorkPage() {
  return (
    <AppShell section="bloodwork">
      <MX4Card insight={MOCK_INSIGHT} section="bloodwork" />
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
    </AppShell>
  )
}
