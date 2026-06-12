# Sleep & Recovery Page Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `SleepPage.tsx` and `RecoveryPage.tsx` to full structural parity with the polished `TrainingPage.tsx` — same code scaffold, same trends pattern (bespoke rich cards for top metrics + TrendRow for the rest), uniform named CardInfo constants, and Rails/subtexts throughout.

**Architecture:** Two self-contained page rewrites. No new files, no new components, no data layer changes. Sleep is the larger job (missing all Trends structure); Recovery is smaller (BESPOKE_CARD fix + two bespoke trend cards). Each page is verified independently with type check + Playwright before committing.

**Tech Stack:** React 19 + TypeScript, inline styles only, `COLORS`/`SECTION_ACCENTS` from `theme.ts`, `hexA()` from `lib/hexA.ts`, existing viz components (`Bars7`, `Sparkline`, `TrendRow`, `Rail`, `Bracket`).

**Spec:** `docs/superpowers/specs/2026-06-12-sleep-recovery-standardization-design.md`

---

## Files

| File | Change |
|---|---|
| `client/src/pages/SleepPage.tsx` | Major rewrite — imports, constants, pair cards, full Trends rewrite |
| `client/src/pages/RecoveryPage.tsx` | Targeted — Bars7 import, BESPOKE_CARD fix, Score + HRV bespoke trend cards |

---

## Task 1: SleepPage — add imports and all structural constants

**Files:**
- Modify: `client/src/pages/SleepPage.tsx:1-18` (imports)
- Modify: `client/src/pages/SleepPage.tsx:19-31` (after `const A = ...`, add constants)

- [ ] **Step 1: Add `CSSProperties` import and missing viz imports**

Replace the import block at the top of `SleepPage.tsx`. Current line 1:
```ts
import { AppShell } from '../components/AppShell'
```

Add `import type { CSSProperties } from 'react'` as the first line, and add `Sparkline` and `Bars7` to the existing viz imports:

```ts
import type { CSSProperties } from 'react'
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
import { Bars7 } from '../components/viz/Bars7'
import { Bracket } from '../components/primitives/Bracket'
import { Sparkline } from '../components/primitives/Sparkline'
import { StatusCore } from '../components/primitives/StatusCore'
import { hexA } from '../lib/hexA'
```

- [ ] **Step 2: Add new named CardInfo constants after `const A = SECTION_ACCENTS.sleep`**

After `const A = SECTION_ACCENTS.sleep` and the existing `HERO_INFO` and `ARCH_INFO`, add the following. Keep `HERO_INFO` and `ARCH_INFO` exactly as they are — they're used in the Overview and must not change.

```ts
const SCORE_INFO: CardInfo = {
  title: 'Sleep Score',
  description: "Garmin's composite sleep quality index (0–100) combining duration, stage distribution, and recovery value. 85+ excellent · 70–84 good · 60–69 fair · below 60 needs attention.",
  source: 'Garmin Venu 4 · accelerometer + HRV',
}
const DURATION_INFO: CardInfo = {
  title: 'Sleep Duration',
  description: 'Total time actually asleep — not time in bed. Target 7–9 hours. Under 7h for 3+ consecutive nights compounds cognitive and metabolic deficits.',
  source: 'Garmin Venu 4 · accelerometer',
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
```

- [ ] **Step 3: Add `TrendSection` type, `TREND_SECTIONS` record, `BESPOKE_CARD` and `SUBTEXT` constants**

Add these after the CardInfo constants, before `function SleepOverview()`:

```ts
type TrendSection = { railLabel: string; period: string; subtext: string; info: CardInfo }

const TREND_SECTIONS: Record<string, TrendSection> = {
  score:    { railLabel: 'SLEEP SCORE',      period: '7 DAYS', subtext: '85+ excellent · 70–84 good · 60–69 fair · below 60 = address recovery deficits', info: SCORE_INFO },
  duration: { railLabel: 'SLEEP DURATION',   period: '7 DAYS', subtext: 'target 7–9 hours · under 7h for 3+ nights compounds cognitive and metabolic debt', info: DURATION_INFO },
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
```

- [ ] **Step 4: Run type check to verify no errors from structural changes**

```bash
cd /opt/bacta && npx tsc --noEmit
```

Expected: passes (or only pre-existing errors unrelated to these files). If new errors appear, fix them before continuing.

---

## Task 2: SleepOverview — standardize pair cards and Rail

**Files:**
- Modify: `client/src/pages/SleepPage.tsx` — `SleepOverview` function

- [ ] **Step 1: Add `right` label to the first Rail**

Find: `<Rail label="LAST NIGHT" accent={A} />`
Replace with: `<Rail label="LAST NIGHT" accent={A} right="SYNTHESIZED" />`

- [ ] **Step 2: Update `useCardInfoOverlay` calls to use named constants**

In `SleepOverview`, find the two inline `useCardInfoOverlay` calls and replace with named constants:

```ts
// find:
const { isOpen: effOpen, handleTap: effTap } = useCardInfoOverlay('slp-efficiency', { description: 'Time asleep ÷ time in bed. Above 85% is healthy; below 80% suggests fragmentation or difficulty falling asleep.' }, A)
const { isOpen: debtOpen, handleTap: debtTap } = useCardInfoOverlay('slp-debt', { description: 'Shortfall vs your 8h target. Short-term debt is partially recoverable; chronic debt compounds across cognition and metabolism.' }, A)

// replace with:
const { isOpen: effOpen, handleTap: effTap } = useCardInfoOverlay('slp-efficiency', EFFICIENCY_INFO, A)
const { isOpen: debtOpen, handleTap: debtTap } = useCardInfoOverlay('slp-debt', DEBT_INFO, A)
```

- [ ] **Step 3: Rewrite the Efficiency card to use Bracket + gradient pattern**

Find the entire Efficiency card div (the first child of the `display: 'flex'` pair container, the one with `borderLeft: \`3px solid ${A}\``). Replace it with:

```tsx
<div onClick={effTap} style={{
  flex: 1, position: 'relative', background: COLORS.surface,
  border: `1px solid ${COLORS.line}`, borderRadius: 10,
  padding: '12px 13px 11px', minHeight: CARD_SIZES.pair,
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
```

- [ ] **Step 4: Rewrite the Sleep Debt card to use Bracket + gradient pattern**

Find the Sleep Debt card div (second child, also with `borderLeft`). Replace it with:

```tsx
<div onClick={debtTap} style={{
  flex: 1, position: 'relative', background: COLORS.surface,
  border: `1px solid ${COLORS.line}`, borderRadius: 10,
  padding: '12px 13px 11px', minHeight: CARD_SIZES.pair,
  cursor: 'pointer', overflow: 'hidden',
}}>
  <Bracket color={A} inset={6} op={0.35} radius={4} />
  <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.7 }} />
  <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 5, paddingLeft: 3 }}>Sleep Debt</div>
  <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: COLORS.text, lineHeight: 1, marginBottom: 5, paddingLeft: 3 }}>
    {slp.sleepDebt == null || slp.sleepDebt === 0 ? '0 min' : debtH > 0 ? `${debtH}h ${String(debtM).padStart(2, '0')}m` : `${debtM}m`}
  </div>
  <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: slp.sleepDebt === 0 ? COLORS.green : COLORS.amber, fontWeight: 700, letterSpacing: '0.06em', paddingLeft: 3 }}>
    {slp.sleepDebt == null || slp.sleepDebt === 0 ? 'FULLY RESTORED' : 'BELOW 8H GOAL'}
  </div>
  {debtOpen && <InfoOverlay info={DEBT_INFO} accent={A} radius={10} compact onClick={debtTap} />}
</div>
```

- [ ] **Step 5: Update HealthStatusTile `info` props to use named constants**

In `SleepOverview`, find the four `HealthStatusTile` components. Update the inline `info` objects to named constants:

```tsx
// Heart Rate tile — replace info prop:
info={SLEEP_HR_INFO}

// Respiration tile — replace info prop:
info={RESP_INFO}

// Sleep Stress tile — replace info prop:
info={{ description: 'HRV-derived stress while asleep. Below 26 is the Rest zone. Elevated overnight stress suppresses next-morning HRV.' }}
// becomes:
info={SLEEP_STRESS_INFO}

// SpO₂ tile — replace info prop:
info={{ description: 'Percentage of hemoglobin carrying oxygen. Above 95% normal, 97%+ excellent. Drops below 90% may indicate sleep-disordered breathing.' }}
// becomes:
info={SPO2_INFO}
```

- [ ] **Step 6: Type check**

```bash
cd /opt/bacta && npx tsc --noEmit
```

Expected: clean.

---

## Task 3: SleepTrends — complete rewrite

**Files:**
- Modify: `client/src/pages/SleepPage.tsx` — replace entire `SleepTrends` function

- [ ] **Step 1: Replace the entire `SleepTrends` function**

Find the entire `function SleepTrends()` block (currently lines ~181–203) and replace with:

```tsx
function SleepTrends() {
  const { data: slp } = useSleepData()
  const { isOpen: durOpen, handleTap: durTap } = useCardInfoOverlay('slp-dur-trend', TREND_SECTIONS.duration.info, A)
  const { isOpen: scoreTrendOpen, handleTap: scoreTrendTap } = useCardInfoOverlay('slp-score-trend', TREND_SECTIONS.score.info, A)

  const scoreTrendDir = slp.score.trend.length > 1
    ? slp.score.trend[slp.score.trend.length - 1] >= slp.score.trend[0] ? '↑' : '↓'
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>

      {slp.duration.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.duration.railLabel} accent={A} right={TREND_SECTIONS.duration.period} />
          <div onClick={durTap} style={BESPOKE_CARD}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>HOURS ASLEEP</span>
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
                <span style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 700, color: scoreTrendDir === '↑' ? COLORS.green : scoreTrendDir === '↓' ? COLORS.mx4Red : COLORS.text }}>
                  {slp.score.value}
                </span>
              </div>
            </div>
            <Sparkline data={slp.score.trend} accent={A} w={350} h={50} sw={1.8} />
            {scoreTrendOpen && <InfoOverlay info={TREND_SECTIONS.score.info} accent={A} radius={10} compact onClick={scoreTrendTap} />}
          </div>
          <div style={SUBTEXT}>{TREND_SECTIONS.score.subtext}</div>
        </>
      )}

      {slp.sleepHrTrend.length > 0 && slp.sleepHr != null && (
        <>
          <Rail label={TREND_SECTIONS.hr.railLabel} accent={A} right={TREND_SECTIONS.hr.period} />
          <TrendRow label="Sleep HR" value={slp.sleepHr} unit="bpm" data={slp.sleepHrTrend} accent={A} lowerBetter info={TREND_SECTIONS.hr.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.hr.subtext}</div>
        </>
      )}

      {slp.sleepRespTrend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.resp.railLabel} accent={A} right={TREND_SECTIONS.resp.period} />
          <TrendRow label="Respiration" value={slp.resp.avg} unit="br/m" data={slp.sleepRespTrend} accent={A} lowerBetter info={TREND_SECTIONS.resp.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.resp.subtext}</div>
        </>
      )}

      {slp.sleepStressTrend.length > 0 && slp.sleepStress != null && (
        <>
          <Rail label={TREND_SECTIONS.stress.railLabel} accent={A} right={TREND_SECTIONS.stress.period} />
          <TrendRow label="Sleep Stress" value={slp.sleepStress} unit="avg" data={slp.sleepStressTrend} accent={A} lowerBetter info={TREND_SECTIONS.stress.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.stress.subtext}</div>
        </>
      )}

    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd /opt/bacta && npx tsc --noEmit
```

Expected: clean.

---

## Task 4: Visual verify Sleep + commit

- [ ] **Step 1: Start dev server**

```bash
cd /opt/bacta && npm run dev:client &
```

Wait ~3s for Vite to start.

- [ ] **Step 2: Screenshot Sleep Overview**

```
browser_navigate → http://localhost:5173
Navigate to Sleep section
browser_take_screenshot
```

Verify: pair cards have Bracket + top gradient (no left border stripe), Rail has "SYNTHESIZED" right label.

- [ ] **Step 3: Screenshot Sleep Trends**

```
Switch to Trends tab
browser_take_screenshot
```

Verify: Duration bespoke card (Bars7) present with Rail header, Score bespoke card (Sparkline + IMPROVING/DECLINING label) present, three TrendRow entries each with Rail above and subtext below.

- [ ] **Step 4: Close browser and commit**

```bash
browser_close
```

```bash
cd /opt/bacta && git add client/src/pages/SleepPage.tsx && git commit -m "feat: standardize SleepPage to match Training pattern — TREND_SECTIONS, bespoke trend cards, uniform info cards"
```

---

## Task 5: RecoveryPage — structural fixes and bespoke trend cards

**Files:**
- Modify: `client/src/pages/RecoveryPage.tsx`

- [ ] **Step 1: Add `Bars7` import**

Find the existing viz imports in `RecoveryPage.tsx`. Add `Bars7`:

```ts
// Find this import block and add Bars7:
import { Gauge } from '../components/viz/Gauge'
import { HeadlineCard } from '../components/viz/HeadlineCard'
import { HealthStatusTile } from '../components/viz/HealthStatusTile'
import { BodyBattery } from '../components/viz/BodyBattery'
import { Delta } from '../components/viz/Delta'
import { Rail } from '../components/viz/Rail'
import { TrendRow } from '../components/viz/TrendRow'
import { Bars7 } from '../components/viz/Bars7'
```

- [ ] **Step 2: Fix BESPOKE_CARD `borderRadius`**

Find:
```ts
const BESPOKE_CARD: CSSProperties = {
  position: 'relative', background: COLORS.surface,
  border: `1px solid ${COLORS.line}`, borderRadius: 11,
  padding: '13px 14px 11px', overflow: 'hidden', cursor: 'pointer',
}
```

Replace `borderRadius: 11` with `borderRadius: 10`.

- [ ] **Step 3: Replace the entire `RecoveryTrends` function**

Find the entire `function RecoveryTrends()` block and replace with:

```tsx
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
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: rec.hrv.value >= rec.hrv.avg ? COLORS.green : COLORS.mx4Red }}>
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
```

- [ ] **Step 4: Type check**

```bash
cd /opt/bacta && npx tsc --noEmit
```

Expected: clean.

---

## Task 6: Visual verify Recovery + commit

- [ ] **Step 1: Screenshot Recovery Overview**

```
browser_navigate → http://localhost:5173
Navigate to Recovery section
browser_take_screenshot
```

Verify: Overview unchanged from before (Body Battery and Recovery Time cards still present).

- [ ] **Step 2: Screenshot Recovery Trends**

```
Switch to Trends tab
browser_take_screenshot
```

Verify: Score bespoke card (Bars7 + state badge) at top, HRV bespoke card (Sparkline + baseline legend) second, remaining 6 TrendRows each with Rail above and subtext below.

- [ ] **Step 3: Close browser and commit**

```bash
browser_close
```

```bash
cd /opt/bacta && git add client/src/pages/RecoveryPage.tsx && git commit -m "feat: standardize RecoveryPage to match Training pattern — bespoke Score+HRV trend cards, BESPOKE_CARD fix"
```
