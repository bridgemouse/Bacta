import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { useTab } from '../lib/TabContext'
import { COLORS, FONT_MONO, FONT_UI, SECTION_ACCENTS } from '../theme'
import { BRIEFS } from '../lib/stubData'
import { useRecoveryData } from '../hooks/useRecoveryData'
import { Gauge } from '../components/viz/Gauge'
import { HeadlineCard } from '../components/viz/HeadlineCard'
import { BodyBattery } from '../components/viz/BodyBattery'
import { Delta } from '../components/viz/Delta'
import { Rail } from '../components/viz/Rail'
import { VitalTile } from '../components/viz/VitalTile'
import { TrendRow } from '../components/viz/TrendRow'
import { Sparkline } from '../components/primitives/Sparkline'
import { Bracket } from '../components/primitives/Bracket'
import { StatusCore } from '../components/primitives/StatusCore'
import { hexA } from '../lib/hexA'

const A = SECTION_ACCENTS.recovery

function RecoveryOverview() {
  const { data: rec } = useRecoveryData()
  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.recovery} />

      <Rail label="READINESS" accent={A} right="SYNTHESIZED" />

      <div style={{
        position: 'relative',
        background: `linear-gradient(135deg, ${hexA(A, 0.08)}, ${COLORS.surface} 60%)`,
        border: `1px solid ${hexA(A, 0.25)}`,
        borderRadius: 12,
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 9,
        overflow: 'hidden',
      }}>
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.85 }} />
        <Bracket color={A} inset={7} op={0.35} radius={4} />
        <Gauge value={rec.score.value} max={100} accent={A} size={108}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
            {rec.score.value}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>/ 100</span>
        </Gauge>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{
            alignSelf: 'flex-start',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
            padding: '4px 11px', borderRadius: 20,
            background: hexA(A, 0.15), border: `1px solid ${hexA(A, 0.45)}`, color: A,
          }}>
            <StatusCore accent={A} size={6} />
            {rec.score.state.toUpperCase()}
          </span>
          <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 13.5, lineHeight: 1.5, color: COLORS.textSecondary }}>
            Systems are restored. Cleared for a{' '}
            <strong style={{ color: COLORS.text, fontWeight: 700 }}>high-intensity</strong>{' '}
            session today.
          </p>
        </div>
      </div>

      {/* HRV + Body Battery side by side */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <HeadlineCard
          accent={A}
          label="HRV · Last Night"
          foot={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Delta value={rec.hrv.value - rec.hrv.avg} unit="ms" size={10} />
              {rec.hrvBaselineLow != null && rec.hrvBaselineHigh != null && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>
                  baseline {rec.hrvBaselineLow}–{rec.hrvBaselineHigh}ms
                </span>
              )}
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {rec.hrv.value}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted }}>ms</span>
          </div>
          <Sparkline data={rec.hrv.trend} accent={A} w={130} h={26} />
        </HeadlineCard>

        <HeadlineCard
          accent={A}
          label="Body Battery"
          foot={<BodyBattery now={rec.battery.now} max={rec.battery.max} min={rec.battery.min} accent={A} height={12} />}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {rec.battery.max}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted }}>at wake</span>
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
            NOW {rec.battery.min}
          </span>
        </HeadlineCard>
      </div>

      <Rail label="VITALS" accent={A} right="LAST NIGHT" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <VitalTile label="Resting HR" value={rec.rhr.value} unit="bpm" data={rec.rhr.trend} accent={A} delta={rec.rhr.value - rec.rhr.avg} lowerBetter />
        <VitalTile label="Stress" value={rec.stress.value} unit="avg" data={rec.stress.trend} accent={A} delta={rec.stress.value - rec.stress.avg} lowerBetter />
        <VitalTile label="SpO₂" value={rec.spo2.value} unit="%" data={rec.spo2.trend} accent={A} delta={rec.spo2.value - rec.spo2.avg} />
        <VitalTile label="Respiration" value={rec.resp.value} unit="br/m" data={rec.resp.trend} accent={A} delta={rec.resp.value - rec.resp.avg} lowerBetter />
      </div>
    </>
  )
}

function RecoveryTrends() {
  const { data: rec } = useRecoveryData()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <TrendRow
        label="Score" value={rec.score.value}
        data={rec.score.trend} accent={A}
      />
      <TrendRow
        label="HRV" value={rec.hrv.value} unit="ms"
        data={rec.hrv.trend} accent={A}
        delta={rec.hrv.value - rec.hrv.avg}
      />
      <TrendRow
        label="Body Battery" value={rec.battery.now}
        data={rec.battery.trend} accent={A} kind="bars"
      />
      <TrendRow
        label="Resting HR" value={rec.rhr.value} unit="bpm"
        data={rec.rhr.trend} accent={A}
        delta={rec.rhr.value - rec.rhr.avg} lowerBetter
      />
      <TrendRow
        label="Stress" value={rec.stress.value} unit="avg"
        data={rec.stress.trend} accent={A}
        delta={rec.stress.value - rec.stress.avg} lowerBetter
      />
      <TrendRow
        label="SpO₂" value={rec.spo2.value} unit="%"
        data={rec.spo2.trend} accent={A}
      />
      <TrendRow
        label="Respiration" value={rec.resp.value} unit="br/m"
        data={rec.resp.trend} accent={A} lowerBetter
      />
    </div>
  )
}

function RecoveryContent() {
  const tab = useTab()
  return tab === 'overview' ? <RecoveryOverview /> : <RecoveryTrends />
}

export function RecoveryPage() {
  return (
    <AppShell section="recovery" hasTabs>
      <RecoveryContent />
    </AppShell>
  )
}
