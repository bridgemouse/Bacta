import type { CSSProperties } from 'react'
import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { useTab } from '../lib/TabContext'
import { COLORS, FONT_MONO, FONT_UI, SECTION_ACCENTS, CARD_SIZES, type CardInfo } from '../theme'
import { BRIEFS, fmtDur } from '../lib/stubData'
import { useSleepData } from '../hooks/useSleepData'
import { InfoCardProvider, useCardInfoOverlay, InfoOverlay } from '../lib/InfoCardContext'
import { Gauge } from '../components/viz/Gauge'
import { Rail } from '../components/viz/Rail'
import { TrendRow } from '../components/viz/TrendRow'
import { SleepDepth } from '../components/viz/SleepDepth'
import { StageDistribution } from '../components/viz/StageDistribution'
import { HealthStatusTile } from '../components/viz/HealthStatusTile'
import { Bars7 } from '../components/viz/Bars7'
import { Bracket } from '../components/primitives/Bracket'
import { Sparkline } from '../components/primitives/Sparkline'

import { hexA } from '../lib/hexA'

const A = SECTION_ACCENTS.sleep

const HERO_INFO: CardInfo = {
  title: 'Sleep Score & Duration',
  description: "Your Sleep Score (0–100) is Garmin's composite of duration, stage quality, and recovery value. Duration shown is time actually asleep — not time in bed.",
  source: 'Garmin Venu 4 · accelerometer + HRV',
}
const ARCH_INFO: CardInfo = {
  title: 'Sleep Architecture',
  description: 'The hypnogram traces your journey through sleep stages across the night. Lower on the chart = deeper sleep. Bars above show time distribution across stages.',
  source: 'Garmin Venu 4 · accelerometer + HRV',
  content: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 11, fontStyle: 'italic', lineHeight: 1.45, color: 'rgba(255,255,255,0.88)', textAlign: 'center' }}>
        The hypnogram traces your journey through sleep stages across the night. Lower on the chart = deeper sleep.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '6px 0' }}>
        {([
          { pos: 'TOP',    stage: 'AWAKE', target: '< 5%',  note: 'Brief awakenings are normal. Excessive waking fragments recovery and suppresses restoration.' },
          { pos: 'UPPER',  stage: 'REM',   target: '~22%',  note: 'Dreaming, memory consolidation, emotional regulation. Increases in later sleep cycles.' },
          { pos: 'LOWER',  stage: 'LIGHT', target: '~50%',  note: 'Transitional stage. Normal to spend the majority of the night here.' },
          { pos: 'BOTTOM', stage: 'DEEP',  target: '~20%',  note: 'Most restorative. Growth hormone release, physical repair. Peaks in early sleep cycles.' },
        ] as const).map(({ pos, stage, target, note }) => (
          <div key={stage} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 7, color: hexA(A, 0.5), width: 36, flexShrink: 0 }}>{pos}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.95)', width: 38, flexShrink: 0 }}>{stage}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: A, width: 34, flexShrink: 0 }}>{target}</span>
            <span style={{ fontFamily: FONT_UI, fontSize: 9.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.25 }}>{note}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 9.5, fontStyle: 'italic', color: 'rgba(255,255,255,0.48)', textAlign: 'center', lineHeight: 1.35 }}>
        The bars above show total time per stage. The Architecture Score card below grades how closely your night matched these targets.
      </p>
    </div>
  ),
}
const SCORE_INFO: CardInfo = {
  title: 'Sleep Score',
  description: "Garmin's composite sleep quality index (0–100) combining duration, stage distribution, and recovery value. 85+ excellent · 70–84 good · 60–69 fair · below 60 needs attention.",
  source: 'Garmin Venu 4 · accelerometer + HRV',
}
const DURATION_INFO: CardInfo = {
  title: 'Deep Sleep',
  description: 'Deepest, most restorative sleep stage. Target ~20% of total sleep (~90–100 min for a 7–8h night). Supports physical recovery, memory consolidation, and growth hormone release.',
  source: 'Garmin Venu 4 · accelerometer + HRV',
}
const EFFICIENCY_INFO: CardInfo = {
  title: 'Sleep Efficiency',
  description: 'Time asleep ÷ time in bed. Above 85% is healthy; below 80% suggests fragmentation or difficulty falling asleep.',
  source: 'Garmin Venu 4 · accelerometer',
}
const DEBT_INFO: CardInfo = {
  title: 'Sleep Debt',
  description: 'Shortfall vs your 8h target. Short-term debt is partially recoverable; chronic debt compounds across cognition and metabolism.',
  source: 'Bacta-computed · Garmin sleep duration',
}
const SLEEP_HR_INFO: CardInfo = {
  title: 'Sleep Heart Rate',
  description: 'Average HR while asleep. Lower signals better cardiovascular efficiency. Elevation above your norm often flags alcohol, illness, or overtraining.',
  source: 'Garmin Venu 4 · optical HR',
}
const RESP_INFO: CardInfo = {
  title: 'Respiration Rate',
  description: 'Breaths per minute at rest. A rise of 1–2 above your baseline often precedes illness by 12–24 hours.',
  source: 'Garmin Venu 4 · optical sensor',
}
const SLEEP_STRESS_INFO: CardInfo = {
  title: 'Sleep Stress',
  description: 'HRV-derived stress while asleep. Below 26 is the Rest zone — the strongest overnight recovery signal. Elevated overnight stress suppresses next-morning HRV.',
  source: 'Garmin Venu 4 · overnight HRV',
}
const SPO2_INFO: CardInfo = {
  title: 'Blood Oxygen (SpO₂)',
  description: 'Oxygen saturation while asleep. Above 95% normal, 97%+ excellent. Repeated drops below 90% may indicate sleep apnea.',
  source: 'Garmin Venu 4 · optical sensor',
}
const ARCH_SCORE_INFO: CardInfo = {
  title: 'Architecture Score',
  description: 'Bacta-computed index scoring Deep (40%), REM (40%), and Awake efficiency (20%). Outer arc = Deep, middle = REM, inner = Awake. Fuller arc = closer to target.',
  source: 'Bacta-computed · Garmin Venu 4 stage data',
  content: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 11, fontStyle: 'italic', lineHeight: 1.45, color: 'rgba(255,255,255,0.88)', textAlign: 'center' }}>
        Bacta's own quality index — independent of Garmin's sleep score. Scores the three stages that have evidence-based clinical targets.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '7px 0' }}>
        {([
          { pos: 'OUTER',  stage: 'DEEP',  target: '≥ 20%', note: '~90m for 8h · physical recovery, growth hormone release' },
          { pos: 'MIDDLE', stage: 'REM',   target: '≥ 22%', note: '~105m for 8h · memory consolidation, emotional regulation' },
          { pos: 'INNER',  stage: 'AWAKE', target: '< 5%',  note: 'in bed awake · fuller arc = more time-efficient' },
        ] as const).map(({ pos, stage, target, note }) => (
          <div key={stage} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 7, color: hexA(A, 0.5), width: 36, flexShrink: 0 }}>{pos}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.95)', width: 38, flexShrink: 0 }}>{stage}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: A, width: 34, flexShrink: 0 }}>{target}</span>
            <span style={{ fontFamily: FONT_UI, fontSize: 10, color: 'rgba(255,255,255,0.72)', lineHeight: 1.25 }}>{note}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 9.5, fontStyle: 'italic', color: 'rgba(255,255,255,0.48)', textAlign: 'center', lineHeight: 1.35 }}>
        Light sleep has no fixed clinical target — it fills the remainder naturally and is excluded from scoring.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
        {([['80+', 'OPTIMAL'], ['60–79', 'FAIR'], ['<60', 'NEEDS WORK']] as const).map(([range, tier]) => (
          <div key={range} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{range}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 7, color: hexA(A, 0.7), letterSpacing: '0.05em' }}>{tier}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 7, color: 'rgba(255,255,255,0.32)', textAlign: 'center', letterSpacing: '0.07em' }}>
        WEIGHTS · DEEP 40% · REM 40% · AWAKE 20%
      </div>
    </div>
  ),
}

type TrendSection = { railLabel: string; period: string; subtext: string; info: CardInfo }

const TREND_SECTIONS: Record<string, TrendSection> = {
  score:    { railLabel: 'SLEEP SCORE',      period: '7 DAYS', subtext: '85+ excellent · 70–84 good · 60–69 fair · below 60 · address recovery deficits', info: SCORE_INFO },
  duration: { railLabel: 'DEEP SLEEP',       period: '7 DAYS', subtext: '~20% of total sleep · foundation for physical recovery, memory consolidation, and hormone regulation', info: DURATION_INFO },
  hr:       { railLabel: 'SLEEP HEART RATE', period: '7 DAYS', subtext: 'lower = better · elevation above your norm often flags alcohol, illness, or overtraining', info: SLEEP_HR_INFO },
  resp:     { railLabel: 'RESPIRATION',      period: '7 DAYS', subtext: '12–20 br/m normal · a rise of 1–2 above baseline often precedes illness by 12–24h', info: RESP_INFO },
  stress:   { railLabel: 'SLEEP STRESS',     period: '7 DAYS', subtext: 'below 26 = rest zone · consistently low = strongest overnight recovery signal', info: SLEEP_STRESS_INFO },
}

const BESPOKE_CARD: CSSProperties = {
  position: 'relative', background: COLORS.surface,
  border: `1px solid ${COLORS.line}`, borderRadius: 10,
  padding: '13px 14px 11px', overflow: 'hidden', cursor: 'pointer',
}

const SUBTEXT: CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted, padding: '0 4px',
}

function SleepOverview() {
  const { data: slp } = useSleepData()
  const { isOpen: heroOpen, handleTap: heroTap } = useCardInfoOverlay('slp-hero', HERO_INFO, A)
  const { isOpen: archOpen, handleTap: archTap } = useCardInfoOverlay('slp-arch', ARCH_INFO, A)
  const { isOpen: effOpen, handleTap: effTap } = useCardInfoOverlay('slp-efficiency', EFFICIENCY_INFO, A)
  const { isOpen: debtOpen, handleTap: debtTap } = useCardInfoOverlay('slp-debt', DEBT_INFO, A)
  const { isOpen: archScoreOpen, handleTap: archScoreTap } = useCardInfoOverlay('slp-arch-score', ARCH_SCORE_INFO, A)

  const efficiencyPct = slp.duration.inBed > 0
    ? Math.min(100, Math.round((slp.duration.mins / slp.duration.inBed) * 100)) : 0
  const awakeInBed = slp.duration.inBed - slp.duration.mins
  const debtH = slp.sleepDebt != null ? Math.floor(slp.sleepDebt / 60) : 0
  const debtM = slp.sleepDebt != null ? slp.sleepDebt % 60 : 0
  const totalMins = slp.stages.reduce((s, st) => s + st.mins, 0) || slp.duration.mins
  const deepMins = slp.stages.find(s => s.key === 'deep')?.mins ?? 0
  const remMins = slp.stages.find(s => s.key === 'rem')?.mins ?? 0
  const awakeStageMins = slp.stages.find(s => s.key === 'awake')?.mins ?? 0
  const awakeTargetMins = Math.round(totalMins * 0.05)
  const archColor = slp.archScore != null
    ? slp.archScore >= 80 ? COLORS.green : slp.archScore >= 60 ? COLORS.amber : COLORS.mx4Red
    : COLORS.textMuted
  const archCx = 150, archCy = 150
  const archArc = (r: number, pct: number) => {
    const p = Math.max(0.001, Math.min(0.999, pct))
    const ex = archCx - r * Math.cos(p * Math.PI)
    const ey = archCy - r * Math.sin(p * Math.PI)
    return `M ${archCx - r} ${archCy} A ${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`
  }
  const deepStageColor = slp.stages.find(s => s.key === 'deep')?.color ?? '#7c5cff'
  const remStageColor = slp.stages.find(s => s.key === 'rem')?.color ?? '#c4b5fd'
  const awakeStageColor = slp.stages.find(s => s.key === 'awake')?.color ?? COLORS.textMuted
  const awakeArcOk = (slp.archAwakePenalty ?? 1) >= 0.8
  const awakeArcColor = awakeArcOk ? awakeStageColor : hexA(COLORS.mx4Red, 0.55)

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.sleep} />
      <Rail label="LAST NIGHT" accent={A} right="SYNTHESIZED" />

      {/* Hero */}
      <div
        onClick={heroTap}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 14,
          background: `linear-gradient(150deg, ${hexA(A, 0.1)}, ${COLORS.surface} 60%)`,
          border: `1px solid ${hexA(A, 0.32)}`, borderRadius: 13,
          padding: '15px 16px', overflow: 'hidden',
          marginBottom: 9, cursor: 'pointer',
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
        <div onClick={effTap} style={{
          flex: 1, position: 'relative', background: COLORS.surface,
          border: `1px solid ${COLORS.line}`, borderRadius: 10,
          padding: '12px 13px 11px',
          cursor: 'pointer', overflow: 'hidden',
        }}>
          <Bracket color={A} inset={6} op={0.35} radius={4} />
          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.7 }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 5, paddingLeft: 3 }}>Efficiency</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: COLORS.text, lineHeight: 1, marginBottom: 5, paddingLeft: 3 }}>{efficiencyPct}%</div>
          <div style={{ width: '100%', height: 4, borderRadius: 2, background: hexA(COLORS.textMuted, 0.12), overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: `${efficiencyPct}%`, height: '100%', background: A, borderRadius: 2 }} />
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted, paddingLeft: 3 }}>{awakeInBed}m awake in bed</div>
          {effOpen && <InfoOverlay info={EFFICIENCY_INFO} accent={A} radius={10} compact onClick={effTap} />}
        </div>
        <div onClick={debtTap} style={{
          flex: 1, position: 'relative', background: COLORS.surface,
          border: `1px solid ${COLORS.line}`, borderRadius: 10,
          padding: '12px 13px 11px',
          cursor: 'pointer', overflow: 'hidden',
        }}>
          <Bracket color={A} inset={6} op={0.35} radius={4} />
          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.7 }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 5, paddingLeft: 3 }}>Sleep Debt</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: COLORS.text, lineHeight: 1, marginBottom: 4, paddingLeft: 3 }}>
            {slp.sleepDebt == null || slp.sleepDebt === 0 ? '0 min' : debtH > 0 ? `${debtH}h ${String(debtM).padStart(2, '0')}m` : `${debtM}m`}
          </div>
          <div style={{ width: '100%', height: 4, borderRadius: 2, background: hexA(COLORS.textMuted, 0.12), overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: `${Math.min(100, Math.round((slp.duration.mins / 480) * 100))}%`, height: '100%', background: slp.sleepDebt === 0 ? COLORS.green : COLORS.amber, borderRadius: 2 }} />
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: slp.sleepDebt === 0 ? COLORS.green : COLORS.amber, fontWeight: 700, letterSpacing: '0.06em', paddingLeft: 3 }}>
            {slp.sleepDebt == null || slp.sleepDebt === 0 ? 'FULLY RESTORED' : 'BELOW 8H GOAL'}
          </div>
          {debtOpen && <InfoOverlay info={DEBT_INFO} accent={A} radius={10} compact onClick={debtTap} />}
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
          </div>
        </div>
        <SleepDepth hypno={slp.hypno} accent={A} h={80} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 }}>
          {(() => {
            const fallback = ['23:00', '01:00', '03:00', '05:00', '07:00']
            if (!slp.hypnoStartLocal || !slp.hypnoEndLocal) {
              return fallback.map(t => (
                <span key={t} style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted }}>{t}</span>
              ))
            }
            const startMs = new Date(slp.hypnoStartLocal).getTime()
            const endMs = new Date(slp.hypnoEndLocal).getTime()
            const labels = [0, 1, 2, 3, 4].map(i => {
              const ms = startMs + (i / 4) * (endMs - startMs)
              const d = new Date(ms)
              return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            })
            return labels.map(t => (
              <span key={t} style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted }}>{t}</span>
            ))
          })()}
        </div>
        <StageDistribution stages={slp.stages} />
        {archOpen && <InfoOverlay info={ARCH_INFO} accent={A} radius={12} onClick={archTap} />}
      </div>

      {slp.archScore != null && (
        <div onClick={archScoreTap} style={{ ...BESPOKE_CARD, marginBottom: 9 }}>
          <Bracket color={A} inset={6} op={0.32} radius={4} />
          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.7 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>ARCHITECTURE SCORE</span>
          </div>
          <svg viewBox="0 0 300 158" width="100%" style={{ display: 'block' }}>
            {/* Tracks */}
            <path d={archArc(130, 0.999)} fill="none" stroke={hexA(A, 0.1)} strokeWidth={11} strokeLinecap="round" />
            <path d={archArc(108, 0.999)} fill="none" stroke={hexA(A, 0.1)} strokeWidth={11} strokeLinecap="round" />
            <path d={archArc(86, 0.999)} fill="none" stroke={hexA(A, 0.1)} strokeWidth={11} strokeLinecap="round" />
            {/* Fills */}
            {slp.archDeepScore != null && (
              <path d={archArc(130, slp.archDeepScore)} fill="none" stroke={deepStageColor} strokeWidth={11} strokeLinecap="round" />
            )}
            {slp.archRemScore != null && (
              <path d={archArc(108, slp.archRemScore)} fill="none" stroke={remStageColor} strokeWidth={11} strokeLinecap="round" />
            )}
            {slp.archAwakePenalty != null && (
              <path d={archArc(86, slp.archAwakePenalty)} fill="none" stroke={awakeArcColor} strokeWidth={11} strokeLinecap="round" />
            )}
            {/* Score */}
            <text x={150} y={108} textAnchor="middle" fontFamily={FONT_MONO} fontSize={36} fontWeight={700} fill={COLORS.text}>{slp.archScore}</text>
            <text x={150} y={124} textAnchor="middle" fontFamily={FONT_MONO} fontSize={8} fontWeight={600} fill={archColor}>
              {slp.archScore >= 80 ? 'OPTIMAL' : slp.archScore >= 60 ? 'FAIR' : 'NEEDS WORK'}
            </text>
          </svg>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '2px 0 4px' }}>
            {[
              { label: 'DEEP', color: deepStageColor, actual: deepMins, goal: Math.round(totalMins * 0.20), limit: false },
              { label: 'REM', color: remStageColor, actual: remMins, goal: Math.round(totalMins * 0.22), limit: false },
              { label: 'AWAKE', color: awakeArcColor, actual: awakeStageMins, goal: awakeTargetMins, limit: true },
            ].map(({ label, color, actual, goal, limit }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: 22, height: 3, borderRadius: 2, background: color }} />
                <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted, letterSpacing: '0.06em' }}>{label}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textSecondary }}>
                  {actual}m <span style={{ color: COLORS.textMuted }}>/ {goal}m{limit ? ' lim' : ''}</span>
                </span>
              </div>
            ))}
          </div>
          {archScoreOpen && <InfoOverlay info={ARCH_SCORE_INFO} accent={A} radius={10} onClick={archScoreTap} />}
        </div>
      )}

      <Rail label="OVERNIGHT VITALS" accent={A} right="WHILE ASLEEP" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {slp.sleepHr != null && (
          <HealthStatusTile label="Heart Rate" value={slp.sleepHr} unit="bpm" accent={A}
            data={slp.sleepHrTrend}
            info={SLEEP_HR_INFO} />
        )}
        <HealthStatusTile label="Respiration" value={slp.resp.avg} unit="br/m" accent={A}
          inRange={slp.resp.avg >= 12 && slp.resp.avg <= 20}
          sub="12–20 normal" data={slp.sleepRespTrend}
          info={RESP_INFO} />
        {slp.sleepStress != null && (
          <HealthStatusTile label="Sleep Stress" value={slp.sleepStress} unit="avg" accent={A}
            inRange={slp.sleepStress < 26}
            sub={slp.sleepStress < 26 ? 'LOW · restful' : 'ELEVATED'} data={slp.sleepStressTrend}
            info={SLEEP_STRESS_INFO} />
        )}
        {slp.spo2.avg != null && (
          <HealthStatusTile label="SpO₂" value={slp.spo2.avg} unit="%" accent={A}
            inRange={slp.spo2.avg >= 95}
            sub={slp.spo2.avg >= 97 ? 'excellent' : 'normal'}
            data={slp.sleepSpo2Trend}
            info={SPO2_INFO} />
        )}
      </div>
    </>
  )
}

function SleepTrends() {
  const { data: slp } = useSleepData()
  const { isOpen: durOpen, handleTap: durTap } = useCardInfoOverlay('slp-dur-trend', TREND_SECTIONS.duration.info, A)
  const { isOpen: scoreTrendOpen, handleTap: scoreTrendTap } = useCardInfoOverlay('slp-score-trend', TREND_SECTIONS.score.info, A)

  const last = slp.score.trend[slp.score.trend.length - 1]
  const first = slp.score.trend[0]
  const scoreTrendDir = slp.score.trend.length > 1
    ? last - first > 3 ? '↑' : first - last > 3 ? '↓' : null
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>

      {slp.duration.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.duration.railLabel} accent={A} right={TREND_SECTIONS.duration.period} />
          <div onClick={durTap} style={BESPOKE_CARD}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>DEEP SLEEP · MINS</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: COLORS.text }}>
                {slp.duration.h}h {String(slp.duration.m).padStart(2, '0')}m
              </span>
            </div>
            <Bars7
              data={slp.duration.trend}
              accent={A} h={70}
              fmt={v => `${(v / 60).toFixed(1)}h`}
              avg
            />
            {durOpen && <InfoOverlay info={TREND_SECTIONS.duration.info} accent={A} radius={10} compact onClick={durTap} />}
          </div>
          <div style={SUBTEXT}>{TREND_SECTIONS.duration.subtext}</div>
        </>
      )}

      {slp.score.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.score.railLabel} accent={A} right={TREND_SECTIONS.score.period} />
          <div onClick={scoreTrendTap} style={BESPOKE_CARD}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>
                {scoreTrendDir ? (scoreTrendDir === '↑' ? 'IMPROVING ↑' : 'DECLINING ↓') : 'TREND'}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                {slp.score.trend.length > 1 && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>
                    {slp.score.trend[0]} →
                  </span>
                )}
                <span style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 700, color: scoreTrendDir === '↑' ? COLORS.green : scoreTrendDir === '↓' ? COLORS.red : COLORS.text }}>
                  {slp.score.value}
                </span>
              </div>
            </div>
            <Sparkline
              data={slp.score.trend}
              accent={A} w={350} h={50} sw={1.8}
              avgLine={slp.score.trend.length > 1
                ? Math.round(slp.score.trend.reduce((s, v) => s + v, 0) / slp.score.trend.length)
                : undefined}
            />
            {scoreTrendOpen && <InfoOverlay info={TREND_SECTIONS.score.info} accent={A} radius={10} compact onClick={scoreTrendTap} />}
          </div>
          <div style={SUBTEXT}>{TREND_SECTIONS.score.subtext}</div>
        </>
      )}

      {slp.sleepHrTrend.length > 0 && slp.sleepHr != null && (
        <>
          <Rail label={TREND_SECTIONS.hr.railLabel} accent={A} right={TREND_SECTIONS.hr.period} />
          <TrendRow label="Sleep HR" value={slp.sleepHr} unit="bpm" data={slp.sleepHrTrend} accent={A} lowerBetter avg info={TREND_SECTIONS.hr.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.hr.subtext}</div>
        </>
      )}

      {slp.sleepRespTrend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.resp.railLabel} accent={A} right={TREND_SECTIONS.resp.period} />
          <TrendRow label="Respiration" value={slp.resp.avg} unit="br/m" data={slp.sleepRespTrend} accent={A} lowerBetter avg info={TREND_SECTIONS.resp.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.resp.subtext}</div>
        </>
      )}

      {slp.sleepStressTrend.length > 0 && slp.sleepStress != null && (
        <>
          <Rail label={TREND_SECTIONS.stress.railLabel} accent={A} right={TREND_SECTIONS.stress.period} />
          <TrendRow label="Sleep Stress" value={slp.sleepStress} unit="avg" data={slp.sleepStressTrend} accent={A} lowerBetter avg info={TREND_SECTIONS.stress.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.stress.subtext}</div>
        </>
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
