import type { CSSProperties } from 'react'
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
import { BodyBattery } from '../components/viz/BodyBattery'
import { Delta } from '../components/viz/Delta'
import { Rail } from '../components/viz/Rail'
import { TrendRow } from '../components/viz/TrendRow'
import { Bars7 } from '../components/viz/Bars7'
import { Sparkline } from '../components/primitives/Sparkline'
import { Bracket } from '../components/primitives/Bracket'
import { StatusCore } from '../components/primitives/StatusCore'
import { hexA } from '../lib/hexA'

const A = SECTION_ACCENTS.recovery

const SCORE_INFO: CardInfo = {
  title: 'Recovery Score',
  description: "Garmin's Training Readiness index (0–100). Synthesizes overnight HRV, sleep quality, Body Battery, acute load, and stress history. 60+ = ready for hard work · 40–59 = moderate effort · below 40 = rest or light activity.",
  source: 'Garmin Venu 4 · nightly compute',
}
const HRV_INFO: CardInfo = {
  title: 'Heart Rate Variability',
  description: 'Millisecond variation between heartbeats measured overnight. Higher vs your baseline = better recovered. Trend direction shows 7-day slope.',
  source: 'Garmin Venu 4 · overnight RMSSD',
}
const BATTERY_INFO: CardInfo = {
  title: 'Body Battery',
  description: "Garmin's energy reserve model computed from HRV, stress, and activity. Charges during deep low-stress sleep; depletes with physical and mental exertion.",
  source: 'Garmin Venu 4 · continuous HRV + stress',
}
const RECOVERY_TIME_INFO: CardInfo = {
  title: 'Recovery Time',
  description: "Garmin's estimate of hours until you're fully recovered from accumulated training stress. Appears after workouts; resets as you recover. A shorter window = ready sooner.",
  source: 'Garmin Venu 4 · Training Readiness algorithm',
}
const SLEEP_STRESS_INFO: CardInfo = {
  title: 'Sleep Stress',
  description: 'HRV-derived stress score measured only during the sleep window. Below 26 is the Rest zone — the strongest signal that overnight recovery is working.',
  source: 'Garmin Venu 4 · overnight HRV',
}

type TrendSection = { railLabel: string; period: string; subtext: string; info: CardInfo }

const TREND_SECTIONS: Record<string, TrendSection> = {
  score:  { railLabel: 'RECOVERY SCORE', period: '7 DAYS', subtext: '60+ = cleared for intensity · 40–59 = moderate · below 40 = recovery day', info: SCORE_INFO },
  hrv:    { railLabel: 'HRV',            period: '7 DAYS', subtext: 'higher vs your baseline = better recovered · trend direction shows adaptation', info: HRV_INFO },
  battery:{ railLabel: 'BODY BATTERY',   period: '7 DAYS', subtext: 'wake-up value — how fully recharged sleep restored your energy reserve', info: BATTERY_INFO },
  rhr:    { railLabel: 'RESTING HR',     period: '7 DAYS', subtext: 'lower = better · measured during deepest sleep · downward trend = improving fitness', info: { title: 'Resting Heart Rate', description: 'Measured during your deepest sleep. A downward trend over weeks is a reliable signal of growing cardiovascular fitness.', source: 'Garmin Venu 4 · sleep detection' } },
  stress:      { railLabel: 'OVERNIGHT STRESS', period: '7 DAYS', subtext: 'below 26 = rest zone · consistently low = strongest recovery signal', info: { title: 'Stress Score', description: '0–25 rest, 26–50 low, 51–75 medium, 76–100 high. Consistently low overnight stress is one of the strongest recovery signals.', source: 'Garmin Venu 4 · HRV-derived' } },
  sleepStress: { railLabel: 'SLEEP STRESS',     period: '7 DAYS', subtext: 'HRV-derived during sleep only · below 26 = rest zone · best overnight recovery signal', info: SLEEP_STRESS_INFO },
  resp:        { railLabel: 'RESPIRATION',       period: '7 DAYS', subtext: '12–20 br/m normal · a rise of 1–2 above baseline often signals illness early', info: { title: 'Respiration Rate', description: 'Breaths per minute at rest. A rise of 1–2 above your baseline often signals illness before other symptoms appear.', source: 'Garmin Venu 4 · optical sensor' } },
  recovTime:   { railLabel: 'RECOVERY TIME',     period: '7 DAYS', subtext: 'hours until fully recovered · 0 = ready now · drops as you rest', info: RECOVERY_TIME_INFO },
}

const BESPOKE_CARD: CSSProperties = {
  position: 'relative', background: COLORS.surface,
  border: `1px solid ${COLORS.line}`, borderRadius: 10,
  padding: '13px 14px 11px', overflow: 'hidden', cursor: 'pointer',
}

const SUBTEXT: CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted, padding: '0 4px',
}

function RecoveryOverview() {
  const { data: rec } = useRecoveryData()
  const { isOpen: scoreOpen, handleTap: scoreTap } = useCardInfoOverlay('rec-score', SCORE_INFO, A)
  const { isOpen: hrvOpen, handleTap: hrvTap } = useCardInfoOverlay('rec-hrv', HRV_INFO, A)
  const { isOpen: battOpen, handleTap: battTap } = useCardInfoOverlay('rec-battery', BATTERY_INFO, A)
  const { isOpen: recovTimeOpen, handleTap: recovTimeTap } = useCardInfoOverlay('rec-recov-time', RECOVERY_TIME_INFO, A)

  const inHRVRange = rec.hrvBaselineLow != null && rec.hrvBaselineHigh != null
    ? rec.hrv.value >= rec.hrvBaselineLow && rec.hrv.value <= rec.hrvBaselineHigh
    : true
  const dirColor = rec.hrv.direction?.direction === 'up' ? COLORS.green
    : rec.hrv.direction?.direction === 'down' ? COLORS.mx4Red : COLORS.amber
  const stressLabelColor =
    rec.stress.value < 26 ? COLORS.green :
    rec.stress.value < 51 ? COLORS.amber :
    COLORS.mx4Red

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

      {/* Body Battery */}
      {rec.battery.max != null && rec.battery.max > 0 && (
        <div onClick={battTap} style={{ ...BESPOKE_CARD, marginBottom: 9 }}>
          <Bracket color={A} inset={6} op={0.28} radius={4} />
          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.7 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, paddingLeft: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>BODY BATTERY · TODAY</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: COLORS.text }}>{rec.battery.now}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>now</span>
              {rec.batteryConsumed != null && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.amber }}>−{rec.batteryConsumed}</span>
              )}
            </div>
          </div>
          <BodyBattery now={rec.battery.now} max={rec.battery.max} min={rec.battery.min} accent={A} height={15} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted, marginTop: 7, paddingLeft: 2 }}>
            wake {rec.battery.max}% → now {rec.battery.now}%
          </div>
          {battOpen && <InfoOverlay info={BATTERY_INFO} accent={A} radius={11} compact onClick={battTap} />}
        </div>
      )}

      {/* Recovery Time */}
      {rec.recoveryTimeH != null && (
        <div onClick={recovTimeTap} style={{ ...BESPOKE_CARD, marginBottom: 9 }}>
          <Bracket color={A} inset={6} op={0.28} radius={4} />
          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.7 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>RECOVERY TIME</span>
            {rec.recoveryTimeH === 0 ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5, background: hexA(COLORS.green, 0.12), border: `1px solid ${hexA(COLORS.green, 0.42)}` }}>
                <StatusCore accent={COLORS.green} size={5} />
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: COLORS.green }}>READY NOW</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 24, fontWeight: 700, color: COLORS.text }}>{rec.recoveryTimeH}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted }}>h to full recovery</span>
              </div>
            )}
          </div>
          {recovTimeOpen && <InfoOverlay info={RECOVERY_TIME_INFO} accent={A} radius={11} compact onClick={recovTimeTap} />}
        </div>
      )}

      {/* RHR + Stress pair */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <HeadlineCard accent={A} label="Resting HR"
          info={{ title: 'Resting Heart Rate', description: 'Measured during your deepest sleep. A downward trend over weeks is a reliable signal of growing cardiovascular fitness.', source: 'Garmin Venu 4 · sleep detection' }}
          foot={<Delta value={rec.rhr.value - (rec.rhr.avg ?? rec.rhr.value)} unit=" bpm" lowerBetter size={9.5} />}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{rec.rhr.value}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted }}>bpm</span>
          </div>
          <Sparkline data={rec.rhr.trend} accent={A} h={20} sw={1.5} />
        </HeadlineCard>
        <HeadlineCard accent={A} label="Stress"
          info={{ title: 'Stress Score', description: '0–25 rest, 26–50 low, 51–75 medium, 76–100 high. Consistently low overnight is one of the strongest recovery signals.', source: 'Garmin Venu 4 · HRV-derived' }}
          foot={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {rec.stress.avg != null && <Delta value={rec.stress.value - rec.stress.avg} lowerBetter size={9.5} />}
              {rec.stressLabel && <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: stressLabelColor }}>{rec.stressLabel}</span>}
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
        {rec.sleepStress != null && (
          <HealthStatusTile label="Sleep Stress" value={rec.sleepStress} unit="avg" accent={A}
            inRange={rec.sleepStress < 26}
            sub={rec.sleepStress < 26 ? 'LOW · rest zone' : rec.sleepStress < 51 ? 'LOW–MODERATE' : 'ELEVATED'}
            data={rec.sleepStressTrend}
            info={SLEEP_STRESS_INFO} />
        )}
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
  const { isOpen: scoreTrendOpen, handleTap: scoreTrendTap } = useCardInfoOverlay('rec-score-trend', TREND_SECTIONS.score.info, A)
  const { isOpen: hrvTrendOpen, handleTap: hrvTrendTap } = useCardInfoOverlay('rec-hrv-trend', TREND_SECTIONS.hrv.info, A)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>

      {rec.score.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.score.railLabel} accent={A} right={TREND_SECTIONS.score.period} />
          <div onClick={scoreTrendTap} style={BESPOKE_CARD}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>TRAINING READINESS · 7 DAYS</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: COLORS.text }}>{rec.score.value}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: A }}>{rec.score.state.toUpperCase()}</span>
              </span>
            </div>
            <Bars7 data={rec.score.trend} accent={A} h={80} avg />
            {scoreTrendOpen && <InfoOverlay info={TREND_SECTIONS.score.info} accent={A} radius={10} compact onClick={scoreTrendTap} />}
          </div>
          <div style={SUBTEXT}>{TREND_SECTIONS.score.subtext}</div>
        </>
      )}

      {rec.hrv.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.hrv.railLabel} accent={A} right={TREND_SECTIONS.hrv.period} />
          <div onClick={hrvTrendTap} style={BESPOKE_CARD}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>MS · OVERNIGHT RMSSD</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: COLORS.text }}>{rec.hrv.value}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>ms</span>
                {rec.hrv.avg != null && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: rec.hrv.value >= rec.hrv.avg ? COLORS.green : COLORS.red }}>
                    {rec.hrv.value >= rec.hrv.avg ? '+' : ''}{(rec.hrv.value - rec.hrv.avg).toFixed(0)}
                  </span>
                )}
              </div>
            </div>
            <Sparkline data={rec.hrv.trend} accent={A} w={350} h={50} sw={1.8} />
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
            {hrvTrendOpen && <InfoOverlay info={TREND_SECTIONS.hrv.info} accent={A} radius={10} compact onClick={hrvTrendTap} />}
          </div>
          <div style={SUBTEXT}>{TREND_SECTIONS.hrv.subtext}</div>
        </>
      )}

      {rec.battery.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.battery.railLabel} accent={A} right={TREND_SECTIONS.battery.period} />
          <TrendRow label="Body Battery" value={rec.battery.now} data={rec.battery.trend} accent={A} kind="bars" avg info={TREND_SECTIONS.battery.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.battery.subtext}</div>
        </>
      )}

      {rec.rhr.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.rhr.railLabel} accent={A} right={TREND_SECTIONS.rhr.period} />
          <TrendRow label="Resting HR" value={rec.rhr.value} unit="bpm" data={rec.rhr.trend} accent={A} delta={rec.rhr.avg != null ? rec.rhr.value - rec.rhr.avg : undefined} lowerBetter info={TREND_SECTIONS.rhr.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.rhr.subtext}</div>
        </>
      )}

      {rec.stress.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.stress.railLabel} accent={A} right={TREND_SECTIONS.stress.period} />
          <TrendRow label="Stress" value={rec.stress.value} unit="avg" data={rec.stress.trend} accent={A} delta={rec.stress.avg != null ? rec.stress.value - rec.stress.avg : undefined} lowerBetter info={TREND_SECTIONS.stress.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.stress.subtext}</div>
        </>
      )}

      {rec.sleepStressTrend.length > 0 && rec.sleepStress != null && (
        <>
          <Rail label={TREND_SECTIONS.sleepStress.railLabel} accent={A} right={TREND_SECTIONS.sleepStress.period} />
          <TrendRow label="Sleep Stress" value={rec.sleepStress} unit="avg" data={rec.sleepStressTrend} accent={A} lowerBetter info={TREND_SECTIONS.sleepStress.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.sleepStress.subtext}</div>
        </>
      )}

      {rec.recoveryTimeTrend.length > 0 && rec.recoveryTimeH != null && (
        <>
          <Rail label={TREND_SECTIONS.recovTime.railLabel} accent={A} right={TREND_SECTIONS.recovTime.period} />
          <TrendRow label="Recov. Time" value={`${rec.recoveryTimeH}h`} data={rec.recoveryTimeTrend} accent={A} lowerBetter info={TREND_SECTIONS.recovTime.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.recovTime.subtext}</div>
        </>
      )}

      {rec.resp.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.resp.railLabel} accent={A} right={TREND_SECTIONS.resp.period} />
          <TrendRow label="Respiration" value={rec.resp.value} unit="br/m" data={rec.resp.trend} accent={A} lowerBetter info={TREND_SECTIONS.resp.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.resp.subtext}</div>
        </>
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
