import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { useTab } from '../lib/TabContext'
import { COLORS, FONT_MONO, FONT_UI, SECTION_ACCENTS, CARD_SIZES, type CardInfo } from '../theme'
import { BRIEFS } from '../lib/stubData'
import { useRecoveryData } from '../hooks/useRecoveryData'
import { InfoCardProvider, useCardInfoOverlay, InfoOverlay } from '../lib/InfoCardContext'
import { Gauge } from '../components/viz/Gauge'
import { HeadlineCard } from '../components/viz/HeadlineCard'
import { HealthStatusTile } from '../components/viz/HealthStatusTile'
import { Delta } from '../components/viz/Delta'
import { Rail } from '../components/viz/Rail'
import { TrendRow } from '../components/viz/TrendRow'
import { Sparkline } from '../components/primitives/Sparkline'
import { Bracket } from '../components/primitives/Bracket'
import { StatusCore } from '../components/primitives/StatusCore'
import { hexA } from '../lib/hexA'

const A = SECTION_ACCENTS.recovery

const SCORE_INFO: CardInfo = {
  title: 'Recovery Score',
  description: "Garmin's composite daily readiness index (0–100). Synthesizes overnight HRV, resting HR, sleep quality, and recent training load. 70+ = cleared for intensity.",
  source: 'Garmin Fenix 7X · nightly compute',
}
const HRV_INFO: CardInfo = {
  title: 'Heart Rate Variability',
  description: 'Millisecond variation between heartbeats measured overnight. Higher vs your baseline = better recovered. Trend direction shows 7-day slope.',
  source: 'Garmin Fenix 7X · overnight RMSSD',
}

function RecoveryOverview() {
  const { data: rec } = useRecoveryData()
  const { isOpen: scoreOpen, handleTap: scoreTap } = useCardInfoOverlay('rec-score', SCORE_INFO, A)
  const { isOpen: hrvOpen, handleTap: hrvTap } = useCardInfoOverlay('rec-hrv', HRV_INFO, A)

  const inHRVRange = rec.hrvBaselineLow != null && rec.hrvBaselineHigh != null
    ? rec.hrv.value >= rec.hrvBaselineLow && rec.hrv.value <= rec.hrvBaselineHigh
    : true
  const dirColor = rec.hrv.direction?.direction === 'up' ? COLORS.green
    : rec.hrv.direction?.direction === 'down' ? COLORS.mx4Red : COLORS.amber

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.recovery} />
      <Rail label="READINESS" accent={A} right="SYNTHESIZED" />

      {/* Recovery Score hero */}
      <div
        onClick={scoreTap}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 16,
          background: `linear-gradient(150deg, ${hexA(A, 0.1)}, ${COLORS.surface} 60%)`,
          border: `1px solid ${hexA(A, 0.32)}`, borderRadius: 13,
          padding: '15px 16px', overflow: 'hidden',
          minHeight: CARD_SIZES.hero, marginBottom: 9, cursor: 'pointer',
        }}
      >
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.85 }} />
        <Bracket color={A} inset={7} op={0.4} radius={4} />
        <Gauge value={rec.score.value} max={100} accent={A} size={108}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{rec.score.value}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>/ 100</span>
        </Gauge>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 9px', borderRadius: 6,
            background: hexA(A, 0.14), border: `1px solid ${hexA(A, 0.4)}`, marginBottom: 9,
          }}>
            <StatusCore accent={A} size={6} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: A }}>{rec.score.state.toUpperCase()}</span>
          </div>
          <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 13.5, lineHeight: 1.5, color: COLORS.textSecondary }}>
            Systems restored. Cleared for a{' '}
            <strong style={{ color: COLORS.text, fontWeight: 700 }}>high-intensity</strong>{' '}
            session today.
          </p>
        </div>
        {scoreOpen && <InfoOverlay info={SCORE_INFO} accent={A} radius={13} onClick={scoreTap} />}
      </div>

      {/* HRV — full-width chart */}
      <div
        onClick={hrvTap}
        style={{
          position: 'relative', background: COLORS.surface,
          border: `1px solid ${COLORS.line}`, borderRadius: 11,
          padding: '13px 14px 12px', overflow: 'hidden',
          minHeight: CARD_SIZES.chart, marginBottom: 9, cursor: 'pointer',
        }}
      >
        <Bracket color={A} inset={6} op={0.35} radius={4} />
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.85 }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 3 }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 5 }}>HRV · LAST NIGHT</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 32, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{rec.hrv.value}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textMuted }}>ms</span>
              {rec.hrv.avg != null && <Delta value={rec.hrv.value - rec.hrv.avg} unit=" ms" size={10} />}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginTop: 4 }}>vs {rec.hrv.avg}ms week avg</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 160 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5,
              background: hexA(inHRVRange ? COLORS.green : COLORS.amber, 0.12),
              border: `1px solid ${hexA(inHRVRange ? COLORS.green : COLORS.amber, 0.42)}`,
            }}>
              <StatusCore accent={inHRVRange ? COLORS.green : COLORS.amber} size={5} />
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: inHRVRange ? COLORS.green : COLORS.amber }}>
                {inHRVRange ? 'IN RANGE' : 'BELOW'}
              </span>
            </div>
            {rec.hrv.direction && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5,
                background: hexA(dirColor, 0.11), border: `1px solid ${hexA(dirColor, 0.38)}`,
              }}>
                <StatusCore accent={dirColor} size={5} />
                <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: dirColor }}>
                  {rec.hrv.direction.label}
                </span>
              </div>
            )}
          </div>
        </div>
        <Sparkline data={rec.hrv.trend} accent={A} w={280} h={36} />
        {rec.hrvBaselineLow != null && rec.hrvBaselineHigh != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, paddingLeft: 2 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 14, height: 7, background: hexA(A, 0.13), border: `1px dashed ${hexA(A, 0.42)}`, borderRadius: 1 }} />
              <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted }}>baseline {rec.hrvBaselineLow}–{rec.hrvBaselineHigh}ms</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 14, borderTop: `1px dashed ${hexA(COLORS.textSecondary, 0.35)}` }} />
              <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted }}>7d avg {rec.hrv.avg}ms</span>
            </span>
          </div>
        )}
        {hrvOpen && <InfoOverlay info={HRV_INFO} accent={A} radius={11} onClick={hrvTap} />}
      </div>

      {/* RHR + Stress pair */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <HeadlineCard accent={A} label="Resting HR"
          info={{ title: 'Resting Heart Rate', description: 'Measured during your deepest sleep. A downward trend over weeks is a reliable signal of growing cardiovascular fitness.', source: 'Garmin Fenix 7X · sleep detection' }}
          foot={<Delta value={rec.rhr.value - (rec.rhr.avg ?? rec.rhr.value)} unit=" bpm" lowerBetter size={9.5} />}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{rec.rhr.value}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted }}>bpm</span>
          </div>
          <Sparkline data={rec.rhr.trend} accent={A} h={20} sw={1.5} />
        </HeadlineCard>
        <HeadlineCard accent={A} label="Stress"
          info={{ title: 'Stress Score', description: '0–25 rest, 26–50 low, 51–75 medium, 76–100 high. Consistently low overnight is one of the strongest recovery signals.', source: 'Garmin Fenix 7X · HRV-derived' }}
          foot={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {rec.stress.avg != null && <Delta value={rec.stress.value - rec.stress.avg} lowerBetter size={9.5} />}
              {rec.stressLabel && <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.green }}>{rec.stressLabel}</span>}
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{rec.stress.value}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted }}>avg</span>
          </div>
          <Sparkline data={rec.stress.trend} accent={A} h={20} sw={1.5} />
        </HeadlineCard>
      </div>

      <Rail label="OVERNIGHT VITALS" accent={A} right="HEALTH STATUS" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <HealthStatusTile label="Stress avg" value={rec.stress.value} unit="avg" accent={A}
          inRange={rec.stress.value < 51}
          sub={rec.stress.value < 26 ? 'LOW · rest zone' : 'LOW–MODERATE'}
          info={{ description: 'HRV-derived stress while asleep. Below 26 is the Rest zone — staying calm directly supports HRV recovery.' }} />
        <HealthStatusTile label="Peak Stress" value={rec.stressMax ?? '—'} unit="max" accent={A}
          inRange={rec.stressMax != null ? rec.stressMax < 60 : undefined}
          sub={rec.stressMax != null && rec.stressMax >= 60 ? 'elevated' : 'within range'}
          data={rec.stressMaxTrend}
          info={{ description: 'Highest single stress reading in 24h. Peaks above 60 during sleep fragment recovery and suppress next-morning HRV.' }} />
        <HealthStatusTile label="Respiration" value={rec.resp.value} unit="br/m" accent={A}
          inRange={rec.resp.value >= 12 && rec.resp.value <= 20}
          sub="12–20 normal"
          info={{ description: 'Breaths per minute at rest. A rise of 1–2 above your baseline often signals illness before other symptoms appear.' }} />
        {rec.spo2.value != null && (
          <HealthStatusTile label="SpO₂" value={rec.spo2.value} unit="%" accent={A}
            inRange={rec.spo2.value >= 95}
            sub={rec.spo2.value >= 97 ? 'excellent' : 'normal'}
            info={{ description: 'Percentage of hemoglobin carrying oxygen. Above 95% normal, 97%+ excellent. Drops below 90% may indicate sleep-disordered breathing.' }} />
        )}
      </div>
    </>
  )
}

function RecoveryTrends() {
  const { data: rec } = useRecoveryData()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rec.score.trend.length > 0 && (
        <TrendRow label="Score" value={rec.score.value} data={rec.score.trend} accent={A} />
      )}
      {rec.hrv.trend.length > 0 && (
        <TrendRow label="HRV" value={rec.hrv.value} unit="ms" data={rec.hrv.trend} accent={A} delta={rec.hrv.avg != null ? rec.hrv.value - rec.hrv.avg : undefined} />
      )}
      {rec.battery.trend.length > 0 && (
        <TrendRow label="Body Battery" value={rec.battery.now} data={rec.battery.trend} accent={A} kind="bars" />
      )}
      {rec.rhr.trend.length > 0 && (
        <TrendRow label="Resting HR" value={rec.rhr.value} unit="bpm" data={rec.rhr.trend} accent={A} delta={rec.rhr.avg != null ? rec.rhr.value - rec.rhr.avg : undefined} lowerBetter />
      )}
      {rec.stress.trend.length > 0 && (
        <TrendRow label="Stress" value={rec.stress.value} unit="avg" data={rec.stress.trend} accent={A} delta={rec.stress.avg != null ? rec.stress.value - rec.stress.avg : undefined} lowerBetter />
      )}
      {rec.resp.trend.length > 0 && (
        <TrendRow label="Respiration" value={rec.resp.value} unit="br/m" data={rec.resp.trend} accent={A} lowerBetter />
      )}
    </div>
  )
}

function RecoveryContent() {
  const tab = useTab()
  return (
    <InfoCardProvider>
      {tab === 'overview' ? <RecoveryOverview /> : <RecoveryTrends />}
    </InfoCardProvider>
  )
}

export function RecoveryPage() {
  return (
    <AppShell section="recovery" hasTabs>
      <RecoveryContent />
    </AppShell>
  )
}
