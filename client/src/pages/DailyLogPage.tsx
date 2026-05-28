import { PageShell } from '../components/PageShell'
import { COLORS, SECTION_ACCENTS } from '../theme'

interface DailyLogPageProps { onMenuOpen: () => void }

export function DailyLogPage({ onMenuOpen }: DailyLogPageProps) {
  return (
    <PageShell section="dailylog" tabs={[]} onMenuOpen={onMenuOpen}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Readiness */}
        <div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>Readiness</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: COLORS.surfaceElevated,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  color: COLORS.textSecondary,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Caffeine */}
        <div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>Caffeine (mg)</div>
          <input
            type="number"
            placeholder="0"
            style={{
              width: '100%',
              background: COLORS.surfaceElevated,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: COLORS.textPrimary,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Notes */}
        <div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>Notes</div>
          <textarea
            placeholder="Anything worth noting today..."
            rows={3}
            style={{
              width: '100%',
              background: COLORS.surfaceElevated,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: COLORS.textPrimary,
              fontSize: 14,
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button style={{
          background: SECTION_ACCENTS.dailylog,
          border: 'none',
          borderRadius: 10,
          padding: '12px',
          color: '#000',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
        }}>
          Log Today
        </button>
      </div>
    </PageShell>
  )
}
