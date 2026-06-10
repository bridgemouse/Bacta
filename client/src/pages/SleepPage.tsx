import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { useTab } from '../lib/TabContext'
import { COLORS, FONT_MONO, SECTION_ACCENTS, CARD_SIZES, type CardInfo } from '../theme'
import { BRIEFS, fmtDur } from '../lib/stubData'
import { useSleepData } from '../hooks/useSleepData'
import { InfoCardProvider, useCardInfoOverlay, InfoOverlay } from '../lib/InfoCardContext'
import { Gauge } from '../components/viz/Gauge'
import { Rail } from '../components/viz/Rail'
import { TrendRow } from '../components/viz/TrendRow'
import { SleepDepth } from '../components/viz/SleepDepth'
import { StageDistribution } from '../components/viz/StageDistribution'
import { HealthStatusTile } from '../components/viz/HealthStatusTile'
import { Bracket } from '../components/primitives/Bracket'
import { StatusCore } from '../components/primitives/StatusCore'
import { hexA } from '../lib/hexA'

const A = SECTION_ACCENTS.sleep

const HERO_INFO: CardInfo = {
  title: 'Sleep Score & Duration',
  description: "Your Sleep Score (0–100) is Garmin's composite of duration, stage quality, and recovery value. Duration shown is time actually asleep — not time in bed.",
  source: 'Garmin Venu 4 · accelerometer + HRV',
}
const ARCH_INFO: CardInfo = {
  title: 'Sleep Architecture',
  description: 'How your sleep distributes across Deep, Light, REM, and Awake. Ideal: ~20% deep, ~22% REM, <5% awake. The Architecture Score is Bacta-computed from how close your night matches these ideals.',
  source: 'Garmin Venu 4 · accelerometer + HRV',
}

function SleepOverview() {
  const { data: slp } = useSleepData()
  const { isOpen: heroOpen, handleTap: heroTap } = useCardInfoOverlay('slp-hero', HERO_INFO, A)
  const { isOpen: archOpen, handleTap: archTap } = useCardInfoOverlay('slp-arch', ARCH_INFO, A)
  const { isOpen: effOpen, handleTap: effTap } = useCardInfoOverlay('slp-efficiency', { description: 'Time asleep ÷ time in bed. Above 85% is healthy; below 80% suggests fragmentation or difficulty falling asleep.' }, A)
  const { isOpen: debtOpen, handleTap: debtTap } = useCardInfoOverlay('slp-debt', { description: 'Shortfall vs your 8h target. Short-term debt is partially recoverable; chronic debt compounds across cognition and metabolism.' }, A)

  const efficiencyPct = slp.duration.inBed > 0
    ? Math.min(100, Math.round((slp.duration.mins / slp.duration.inBed) * 100)) : 0
  const awakeInBed = slp.duration.inBed - slp.duration.mins
  const debtH = slp.sleepDebt != null ? Math.floor(slp.sleepDebt / 60) : 0
  const debtM = slp.sleepDebt != null ? slp.sleepDebt % 60 : 0
  const totalMins = slp.stages.reduce((s, st) => s + st.mins, 0) || slp.duration.mins
  const archColor = slp.archScore != null
    ? slp.archScore >= 80 ? COLORS.green : slp.archScore >= 60 ? COLORS.amber : COLORS.mx4Red
    : COLORS.textMuted

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.sleep} />
      <Rail label="LAST NIGHT" accent={A} />

      {/* Hero */}
      <div
        onClick={heroTap}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 14,
          background: `linear-gradient(150deg, ${hexA(A, 0.1)}, ${COLORS.surface} 60%)`,
          border: `1px solid ${hexA(A, 0.32)}`, borderRadius: 13,
          padding: '15px 16px', overflow: 'hidden',
          minHeight: CARD_SIZES.hero, marginBottom: 9, cursor: 'pointer',
        }}
      >
        <Bracket color={A} inset={7} op={0.4} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.14em', color: COLORS.textMuted, marginBottom: 6 }}>TIME ASLEEP</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 38, fontWeight: 700, color: COLORS.text, lineHeight: 0.9, letterSpacing: '-0.02em' }}>{slp.duration.h}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 15, color: COLORS.textMuted, marginRight: 4 }}>h</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 38, fontWeight: 700, color: COLORS.text, lineHeight: 0.9, letterSpacing: '-0.02em' }}>{String(slp.duration.m).padStart(2, '0')}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 15, color: COLORS.textMuted }}>m</span>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textMuted, marginTop: 8 }}>
            {fmtDur(slp.duration.inBed)} in bed
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.green, fontWeight: 600 }}>{efficiencyPct}% efficient</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{awakeInBed}m awake</span>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
            {slp.stages.filter(s => s.key !== 'awake').map(s => (
              <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, background: hexA(s.color, 0.13), border: `1px solid ${hexA(s.color, 0.32)}` }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 7, letterSpacing: '0.06em', color: s.color, fontWeight: 700 }}>{s.label.toUpperCase()}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 700, color: COLORS.text }}>{s.mins}m</span>
              </span>
            ))}
          </div>
        </div>
        <Gauge value={slp.score.value} max={100} accent={A} size={98} stroke={6}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{slp.score.value}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: '0.12em', color: A, marginTop: 2 }}>{slp.score.state.toUpperCase()}</span>
        </Gauge>
        {heroOpen && <InfoOverlay info={HERO_INFO} accent={A} radius={13} onClick={heroTap} />}
      </div>

      {/* Efficiency + Debt pair */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 9, alignItems: 'stretch' }}>
        <div onClick={effTap} style={{ flex: 1, position: 'relative', background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderLeft: `3px solid ${A}`, borderRadius: 9, padding: '10px 12px', minHeight: CARD_SIZES.pair, cursor: 'pointer', overflow: 'hidden' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 5 }}>Efficiency</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: COLORS.text, lineHeight: 1, marginBottom: 5 }}>{efficiencyPct}%</div>
          <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: `${efficiencyPct}%`, height: '100%', background: A, borderRadius: 2 }} />
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted }}>{awakeInBed}m awake in bed</div>
          {effOpen && <InfoOverlay info={{ description: 'Time asleep ÷ time in bed. Above 85% is healthy; below 80% suggests fragmentation or difficulty falling asleep.' }} accent={A} radius={9} compact onClick={effTap} />}
        </div>
        <div onClick={debtTap} style={{ flex: 1, position: 'relative', background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderLeft: `3px solid ${A}`, borderRadius: 9, padding: '10px 12px', minHeight: CARD_SIZES.pair, cursor: 'pointer', overflow: 'hidden' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 5 }}>Sleep Debt</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: COLORS.text, lineHeight: 1, marginBottom: 5 }}>
            {slp.sleepDebt == null || slp.sleepDebt === 0 ? '0 min' : debtH > 0 ? `${debtH}h ${String(debtM).padStart(2, '0')}m` : `${debtM}m`}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: slp.sleepDebt === 0 ? COLORS.green : COLORS.amber, fontWeight: 700, letterSpacing: '0.06em' }}>
            {slp.sleepDebt == null || slp.sleepDebt === 0 ? 'FULLY RESTORED' : 'BELOW 8H GOAL'}
          </div>
          {debtOpen && <InfoOverlay info={{ description: 'Shortfall vs your 8h target. Short-term debt is partially recoverable; chronic debt compounds across cognition and metabolism.' }} accent={A} radius={9} compact onClick={debtTap} />}
        </div>
      </div>

      {/* Architecture */}
      <div
        onClick={archTap}
        style={{
          position: 'relative', background: COLORS.surface,
          border: `1px solid ${COLORS.line}`, borderRadius: 12,
          padding: '13px 14px 13px', overflow: 'hidden',
          minHeight: CARD_SIZES.chart, marginBottom: 9, cursor: 'pointer',
        }}
      >
        <Bracket color={A} inset={6} op={0.32} />
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.7 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 600 }}>Sleep Architecture</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>{fmtDur(totalMins)} cycled</span>
            {slp.archScore != null && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5, background: hexA(archColor, 0.12), border: `1px solid ${hexA(archColor, 0.42)}` }}>
                <StatusCore accent={archColor} size={5} />
                <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: archColor }}>ARCH {slp.archScore}</span>
              </div>
            )}
          </div>
        </div>
        <SleepDepth hypno={slp.hypno} accent={A} h={80} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 }}>
          {['23:00', '01:00', '03:00', '05:00', '07:00'].map(t => (
            <span key={t} style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted }}>{t}</span>
          ))}
        </div>
        <StageDistribution stages={slp.stages} />
        {archOpen && <InfoOverlay info={ARCH_INFO} accent={A} radius={12} onClick={archTap} />}
      </div>

      <Rail label="OVERNIGHT VITALS" accent={A} right="WHILE ASLEEP" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {slp.sleepHr != null && (
          <HealthStatusTile label="Heart Rate" value={slp.sleepHr} unit="bpm" accent={A}
            data={slp.sleepHrTrend}
            info={{ description: 'Average HR while asleep. Lower signals better cardiovascular efficiency. Elevation above your norm often flags alcohol or illness.' }} />
        )}
        <HealthStatusTile label="Respiration" value={slp.resp.avg} unit="br/m" accent={A}
          inRange={slp.resp.avg >= 12 && slp.resp.avg <= 20}
          sub="12–20 normal" data={slp.sleepRespTrend}
          info={{ description: 'Breaths per minute at rest. A rise of 1–2 above your baseline often precedes illness by 12–24 hours.' }} />
        {slp.sleepStress != null && (
          <HealthStatusTile label="Sleep Stress" value={slp.sleepStress} unit="avg" accent={A}
            inRange={slp.sleepStress < 26}
            sub={slp.sleepStress < 26 ? 'LOW · restful' : 'ELEVATED'} data={slp.sleepStressTrend}
            info={{ description: 'HRV-derived stress while asleep. Below 26 is the Rest zone. Elevated overnight stress suppresses next-morning HRV.' }} />
        )}
        {slp.spo2.avg != null && (
          <HealthStatusTile label="SpO₂" value={slp.spo2.avg} unit="%" accent={A}
            inRange={slp.spo2.avg >= 95}
            sub={slp.spo2.avg >= 97 ? 'excellent' : 'normal'}
            info={{ description: 'Oxygen saturation while asleep. Above 95% normal. Repeated drops below 90% may indicate sleep apnea.' }} />
        )}
      </div>
    </>
  )
}

function SleepTrends() {
  const { data: slp } = useSleepData()
  const fmtH = (mins: number) => `${(mins / 60).toFixed(1)}h`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {slp.duration.trend.length > 0 && (
        <TrendRow label="Duration" value={`${slp.duration.h}h ${String(slp.duration.m).padStart(2, '0')}m`} data={slp.duration.trend} accent={A} kind="bars" fmt={fmtH} />
      )}
      {slp.score.trend.length > 0 && (
        <TrendRow label="Score" value={slp.score.value} data={slp.score.trend} accent={A} />
      )}
      {slp.sleepRespTrend.length > 0 && (
        <TrendRow label="Respiration" value={slp.resp.avg} unit="br/m" data={slp.sleepRespTrend} accent={A} lowerBetter />
      )}
      {slp.sleepHrTrend.length > 0 && slp.sleepHr != null && (
        <TrendRow label="Heart Rate" value={slp.sleepHr} unit="bpm" data={slp.sleepHrTrend} accent={A} lowerBetter />
      )}
      {slp.sleepStressTrend.length > 0 && slp.sleepStress != null && (
        <TrendRow label="Stress" value={slp.sleepStress} unit="avg" data={slp.sleepStressTrend} accent={A} lowerBetter />
      )}
    </div>
  )
}

function SleepContent() {
  const tab = useTab()
  return (
    <InfoCardProvider>
      {tab === 'overview' ? <SleepOverview /> : <SleepTrends />}
    </InfoCardProvider>
  )
}

export function SleepPage() {
  return (
    <AppShell section="sleep" hasTabs>
      <SleepContent />
    </AppShell>
  )
}
