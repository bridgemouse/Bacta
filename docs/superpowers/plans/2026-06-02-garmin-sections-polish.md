# Garmin Sections Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface all unused Garmin metrics across Recovery, Sleep, and Training sections, fix shared bugs, and add real trend data — without touching the Python poller.

**Architecture:** Horizontal layers — (1) fix shared primitives, (2) expand data hooks + types, (3) update pages. Each layer is a prerequisite for the next.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, inline styles only.

---

## File Map

| File | Change |
|---|---|
| `client/src/components/viz/Delta.tsx` | Fix float precision |
| `client/src/components/viz/VitalTile.tsx` | Add `sub?: string` prop |
| `client/src/lib/garminApi.ts` | Expand `GarminSummary` with 10 new fields |
| `client/src/hooks/useRecoveryData.ts` | Real avgs, stressLabel, stressMax, respMax, batteryConsumed, null SpO2 |
| `client/src/hooks/useSleepData.ts` | sleepDebt, deepRatio, remRatio, 3 new trend fetches, null SpO2 |
| `client/src/hooks/useTrainingData.ts` | dailyActivity object, vo2max/steps/cal trends, vo2max type fix |
| `client/src/pages/RecoveryPage.tsx` | Battery consumed, stress sub-label, peak tiles, SpO2 gate |
| `client/src/pages/SleepPage.tsx` | Sleep debt, stage ratios, SpO2 gate, real trend sparklines, 3 Trend rows |
| `client/src/pages/TrainingPage.tsx` | Daily Activity panel, VO2 trend bug fix, steps+cal Trend rows |
| `tests/client/components/viz/Delta.test.tsx` | New — float precision tests |
| `tests/client/components/viz/VitalTile.test.tsx` | New — sub prop tests |
| `tests/client/App.test.tsx` | Add SpO2 absence + Daily Activity presence tests |

---

## Task 1: Fix Delta float precision

**Files:**
- Modify: `client/src/components/viz/Delta.tsx`
- Create: `tests/client/components/viz/Delta.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// tests/client/components/viz/Delta.test.tsx
import { render } from '@testing-library/react'
import { Delta } from '../../../../client/src/components/viz/Delta'

describe('Delta', () => {
  it('renders ±0 for zero', () => {
    const { container } = render(<Delta value={0} />)
    expect(container.textContent).toContain('±0')
  })

  it('renders ±0 for null', () => {
    const { container } = render(<Delta value={null} />)
    expect(container.textContent).toContain('±0')
  })

  it('rounds float to 1 decimal', () => {
    const { container } = render(<Delta value={-0.6999} />)
    expect(container.textContent).toContain('0.7')
    expect(container.textContent).not.toContain('0.6999')
  })

  it('drops trailing zero for whole numbers', () => {
    const { container } = render(<Delta value={1.0} />)
    expect(container.textContent).toContain('1')
    expect(container.textContent).not.toContain('1.0')
  })

  it('renders positive value with up arrow', () => {
    const { container } = render(<Delta value={5} />)
    expect(container.textContent).toContain('▲')
    expect(container.textContent).toContain('5')
  })
})
```

- [ ] **Step 2: Run — expect failures on the rounding tests**

```bash
cd /opt/bacta && npx vitest run tests/client/components/viz/Delta.test.tsx
```

Expected: 2 failures (rounds float, drops trailing zero).

- [ ] **Step 3: Fix Delta.tsx — replace the value render expression**

In `client/src/components/viz/Delta.tsx`, line 30, change:

```tsx
      {Math.abs(value)}{unit}
```

to:

```tsx
      {parseFloat(Math.abs(value).toFixed(1))}{unit}
```

- [ ] **Step 4: Run — expect all 5 pass**

```bash
npx vitest run tests/client/components/viz/Delta.test.tsx
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/viz/Delta.tsx tests/client/components/viz/Delta.test.tsx
git commit -m "fix: round Delta values to 1 decimal to prevent float display artifacts"
```

---

## Task 2: Add VitalTile sub prop

**Files:**
- Modify: `client/src/components/viz/VitalTile.tsx`
- Create: `tests/client/components/viz/VitalTile.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// tests/client/components/viz/VitalTile.test.tsx
import { render, screen } from '@testing-library/react'
import { VitalTile } from '../../../../client/src/components/viz/VitalTile'

describe('VitalTile', () => {
  it('renders label and value', () => {
    render(<VitalTile label="Stress" value={24} unit="avg" accent="#7c9af8" />)
    expect(screen.getByText('Stress')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('renders sub text when provided', () => {
    render(<VitalTile label="Stress" value={24} unit="avg" accent="#7c9af8" sub="LOW" />)
    expect(screen.getByText('LOW')).toBeInTheDocument()
  })

  it('does not render sub element when omitted', () => {
    render(<VitalTile label="Stress" value={24} unit="avg" accent="#7c9af8" />)
    expect(screen.queryByText('LOW')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect 1 failure (sub text)**

```bash
npx vitest run tests/client/components/viz/VitalTile.test.tsx
```

Expected: "renders sub text" fails.

- [ ] **Step 3: Update VitalTile.tsx — add sub prop**

Replace the full file:

```tsx
import { COLORS, FONT_MONO } from '../../theme'
import { Sparkline } from '../primitives/Sparkline'
import { Delta } from './Delta'

interface VitalTileProps {
  label: string
  value: string | number
  unit?: string
  sub?: string
  data?: number[]
  accent: string
  delta?: number
  lowerBetter?: boolean
}

export function VitalTile({ label, value, unit, sub, data, accent, delta, lowerBetter }: VitalTileProps) {
  return (
    <div style={{
      position: 'relative', background: COLORS.surface,
      border: `1px solid ${COLORS.line}`, borderRadius: 8,
      padding: '10px 11px 9px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: COLORS.textMuted, fontWeight: 600,
        }}>
          {label}
        </span>
        {delta !== undefined && <Delta value={delta} lowerBetter={lowerBetter} size={8.5} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{unit}</span>
        )}
      </div>
      {sub && (
        <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>{sub}</span>
      )}
      {data && <Sparkline data={data} accent={accent} w={120} h={18} sw={1.5} dot={false} fill={false} />}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all 3 pass**

```bash
npx vitest run tests/client/components/viz/VitalTile.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/viz/VitalTile.tsx tests/client/components/viz/VitalTile.test.tsx
git commit -m "feat: add optional sub label to VitalTile for secondary annotations"
```

---

## Task 3: Expand GarminSummary interface

**Files:**
- Modify: `client/src/lib/garminApi.ts`

- [ ] **Step 1: Add 10 new fields to GarminSummary**

In `client/src/lib/garminApi.ts`, replace the `GarminSummary` interface with:

```ts
export interface GarminSummary {
  hrv?: number
  hrv_week_avg?: number
  hrv_baseline_low?: number
  hrv_baseline_high?: number
  resting_hr?: number
  stress_avg?: number
  stress_max?: number
  resp_avg?: number
  resp_max?: number
  recovery_score?: number
  body_battery_wake?: number
  body_battery_current?: number
  body_battery_min?: number
  spo2_avg?: number
  spo2_min?: number
  sleep_score?: number
  sleep_deep_s?: number
  sleep_light_s?: number
  sleep_rem_s?: number
  sleep_awake_s?: number
  sleep_resp?: number
  sleep_hr?: number
  sleep_stress?: number
  sleep_spo2?: number
  training_load?: number
  training_load_min?: number
  training_load_max?: number
  training_status_n?: number
  intensity_mod_min?: number
  intensity_vig_min?: number
  vo2max?: number
  fitness_age?: number
  steps?: number
  distance_m?: number
  calories_total?: number
  calories_active?: number
  floors_up?: number
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/garminApi.ts
git commit -m "feat: expand GarminSummary interface with SpO2, stress peak, daily activity fields"
```

---

## Task 4: Expand useRecoveryData hook

**Files:**
- Modify: `client/src/hooks/useRecoveryData.ts`

- [ ] **Step 1: Replace the full hook file**

```ts
import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend } from '../lib/garminApi'
import { RECOVERY } from '../lib/stubData'

const arrAvg = (a: number[]) =>
  a.length ? a.reduce((s, v) => s + v, 0) / a.length : null

export type RecoveryData = Omit<typeof RECOVERY, 'spo2'> & {
  spo2: { value: number | null; unit: string; avg: number | null; trend: number[] }
  hrvBaselineLow?: number
  hrvBaselineHigh?: number
  stressLabel?: string
  stressMax?: number
  respMax?: number
  batteryConsumed?: number
}

const INITIAL: RecoveryData = {
  ...RECOVERY,
  spo2: { value: null, unit: '%', avg: null, trend: [] },
}

export function useRecoveryData(): { data: RecoveryData; loading: boolean } {
  const [data, setData] = useState<RecoveryData>(INITIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summary, hrvTrend, rhrTrend, battTrend, stressTrend, respTrend, scoreTrend] =
          await Promise.all([
            fetchSummary(),
            fetchTrend('hrv'),
            fetchTrend('resting_hr'),
            fetchTrend('body_battery_wake'),
            fetchTrend('stress_avg'),
            fetchTrend('resp_avg'),
            fetchTrend('recovery_score'),
          ])
        if (cancelled) return

        const stressAvg = summary.stress_avg ?? RECOVERY.stress.value
        const stressLabel =
          stressAvg < 26 ? 'LOW' :
          stressAvg < 51 ? 'MODERATE' :
          stressAvg < 76 ? 'HIGH' : 'VERY HIGH'

        const wake = summary.body_battery_wake
        const current = summary.body_battery_current
        const batteryConsumed = wake != null && current != null
          ? Math.max(0, wake - current)
          : undefined

        setData({
          score: {
            value: summary.recovery_score ?? RECOVERY.score.value,
            state: (summary.recovery_score ?? 0) >= 80 ? 'Optimal'
                 : (summary.recovery_score ?? 0) >= 67 ? 'Ready'
                 : 'Low',
            trend: scoreTrend.length ? scoreTrend : RECOVERY.score.trend,
          },
          hrv: {
            value: summary.hrv          ?? RECOVERY.hrv.value,
            unit:  'ms',
            avg:   summary.hrv_week_avg ?? RECOVERY.hrv.avg,
            trend: hrvTrend.length      ? hrvTrend : RECOVERY.hrv.trend,
          },
          battery: {
            now:   summary.body_battery_current ?? RECOVERY.battery.now,
            max:   summary.body_battery_wake    ?? RECOVERY.battery.max,
            min:   summary.body_battery_current ?? RECOVERY.battery.min,
            trend: battTrend.length ? battTrend : RECOVERY.battery.trend,
          },
          rhr: {
            value: summary.resting_hr ?? RECOVERY.rhr.value,
            unit:  'bpm',
            avg:   arrAvg(rhrTrend)   ?? RECOVERY.rhr.avg,
            trend: rhrTrend.length    ? rhrTrend : RECOVERY.rhr.trend,
            lowerBetter: true,
          },
          stress: {
            value: stressAvg,
            unit:  'avg',
            avg:   arrAvg(stressTrend) ?? RECOVERY.stress.avg,
            trend: stressTrend.length  ? stressTrend : RECOVERY.stress.trend,
            lowerBetter: true,
          },
          spo2: {
            value: summary.spo2_avg ?? null,
            unit:  '%',
            avg:   summary.spo2_avg ?? null,
            trend: [],
          },
          resp: {
            value: summary.resp_avg ?? RECOVERY.resp.value,
            unit:  'br/min',
            avg:   arrAvg(respTrend) ?? RECOVERY.resp.avg,
            trend: respTrend.length  ? respTrend : RECOVERY.resp.trend,
            lowerBetter: true,
          },
          hrvBaselineLow:  summary.hrv_baseline_low,
          hrvBaselineHigh: summary.hrv_baseline_high,
          stressLabel,
          stressMax:      summary.stress_max,
          respMax:        summary.resp_max,
          batteryConsumed,
        })
      } catch {
        // keep stub data on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useRecoveryData.ts
git commit -m "feat: useRecoveryData — real 7d avgs, stress label, peak values, null SpO2"
```

---

## Task 5: Expand useSleepData hook

**Files:**
- Modify: `client/src/hooks/useSleepData.ts`

- [ ] **Step 1: Replace the full hook file**

```ts
import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend } from '../lib/garminApi'
import { SLEEP } from '../lib/stubData'

export type SleepData = Omit<typeof SLEEP, 'spo2'> & {
  spo2: { avg: number | null; low: number | null; unit: string }
  sleepHr?: number | null
  sleepStress?: number | null
  sleepDebt?: number
  deepRatio?: number
  remRatio?: number
  sleepRespTrend: number[]
  sleepHrTrend: number[]
  sleepStressTrend: number[]
}

const INITIAL: SleepData = {
  ...SLEEP,
  spo2: { avg: null, low: null, unit: '%' },
  sleepRespTrend: [],
  sleepHrTrend: [],
  sleepStressTrend: [],
}

export function useSleepData(): { data: SleepData; loading: boolean } {
  const [data, setData] = useState<SleepData>(INITIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summary, scoreTrend, deepTrend, respTrend, hrTrend, stressTrend] =
          await Promise.all([
            fetchSummary(),
            fetchTrend('sleep_score'),
            fetchTrend('sleep_deep_s'),
            fetchTrend('sleep_resp'),
            fetchTrend('sleep_hr'),
            fetchTrend('sleep_stress'),
          ])
        if (cancelled) return

        const deepS  = summary.sleep_deep_s  ?? 0
        const lightS = summary.sleep_light_s ?? 0
        const remS   = summary.sleep_rem_s   ?? 0
        const awakeS = summary.sleep_awake_s ?? 0
        const totalMins = Math.round((deepS + lightS + remS) / 60)
        const deepMins  = Math.round(deepS  / 60)
        const lightMins = Math.round(lightS / 60)
        const remMins   = Math.round(remS   / 60)
        const awakeMins = Math.round(awakeS / 60)
        const totalForPct = deepMins + lightMins + remMins || 1
        const deepTrendMins = deepTrend.map(v => Math.round(v / 60))

        const sleepDebt = totalMins > 0 ? Math.max(0, 480 - totalMins) : undefined
        const deepRatio = totalMins > 0 ? Math.round(deepMins / totalMins * 100) : undefined
        const remRatio  = totalMins > 0 ? Math.round(remMins  / totalMins * 100) : undefined

        setData({
          ...SLEEP,
          duration: {
            h:     Math.floor(totalMins / 60),
            m:     totalMins % 60,
            mins:  totalMins,
            inBed: totalMins + awakeMins,
            trend: deepTrendMins.filter(v => v > 0).length
              ? deepTrendMins
              : SLEEP.duration.trend,
          },
          score: {
            value: summary.sleep_score ?? SLEEP.score.value,
            state: (summary.sleep_score ?? 0) >= 85 ? 'Excellent'
                 : (summary.sleep_score ?? 0) >= 70 ? 'Good'
                 : 'Fair',
            trend: scoreTrend.length ? scoreTrend : SLEEP.score.trend,
          },
          stages: deepMins > 0 ? [
            { key: 'deep' as const,  label: 'Deep',  mins: deepMins,  pct: Math.round(deepMins  / totalForPct * 100), color: '#7c5cff' },
            { key: 'light' as const, label: 'Light', mins: lightMins, pct: Math.round(lightMins / totalForPct * 100), color: '#a78bfa' },
            { key: 'rem' as const,   label: 'REM',   mins: remMins,   pct: Math.round(remMins   / totalForPct * 100), color: '#c4b5fd' },
            { key: 'awake' as const, label: 'Awake', mins: awakeMins, pct: 0, color: '#56657a' },
          ] : SLEEP.stages,
          spo2:        { avg: summary.sleep_spo2 ?? null, low: null, unit: '%' },
          resp:        { avg: summary.sleep_resp ?? SLEEP.resp.avg, unit: 'br/min' },
          sleepHr:     summary.sleep_hr     ?? null,
          sleepStress: summary.sleep_stress ?? null,
          sleepDebt,
          deepRatio,
          remRatio,
          sleepRespTrend:   respTrend,
          sleepHrTrend:     hrTrend,
          sleepStressTrend: stressTrend,
        })
      } catch {
        // keep stub on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useSleepData.ts
git commit -m "feat: useSleepData — sleep debt, stage ratios, 3 new trend fetches, null SpO2"
```

---

## Task 6: Expand useTrainingData hook

**Files:**
- Modify: `client/src/hooks/useTrainingData.ts`

- [ ] **Step 1: Replace the full hook file**

```ts
import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend, fetchActivities, TRAINING_STATUS, type GarminActivity } from '../lib/garminApi'
import { TRAINING } from '../lib/stubData'

export type TrainingData = Omit<typeof TRAINING, 'activities' | 'vo2max'> & {
  activities: GarminActivity[]
  vo2max: {
    value: number
    unit: string
    delta: number
    fitnessAge: number | string
    trend: number[]
  }
  dailyActivity: {
    steps: number | null
    distanceKm: number | null
    caloriesTotal: number | null
    caloriesActive: number | null
    floors: number | null
    stepsTrend: number[]
    calTrend: number[]
  }
}

const INITIAL: TrainingData = {
  ...TRAINING,
  activities: [],
  vo2max: { ...TRAINING.vo2max, trend: [] },
  dailyActivity: {
    steps: null, distanceKm: null, caloriesTotal: null,
    caloriesActive: null, floors: null, stepsTrend: [], calTrend: [],
  },
}

export function useTrainingData(): { data: TrainingData; loading: boolean } {
  const [data, setData] = useState<TrainingData>(INITIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summary, loadTrend, intensityTrend, vo2maxTrend, stepsTrend, calTrend, activities] =
          await Promise.all([
            fetchSummary(),
            fetchTrend('training_load'),
            fetchTrend('intensity_vig_min'),
            fetchTrend('vo2max', 30),
            fetchTrend('steps'),
            fetchTrend('calories_total'),
            fetchActivities(8),
          ])
        if (cancelled) return

        const statusN = summary.training_status_n ?? null
        const statusLabel = statusN != null
          ? (TRAINING_STATUS[Math.round(statusN)] ?? 'Maintaining')
          : TRAINING.status.value

        const trainingLoad = summary.training_load
        const loadMin  = summary.training_load_min ?? TRAINING.load.low
        const loadMax  = summary.training_load_max ?? TRAINING.load.high
        const loadState = trainingLoad != null
          ? trainingLoad < loadMin ? 'Under'
          : trainingLoad > loadMax ? 'High'
          : 'Optimal'
          : TRAINING.load.state

        const distanceKm = summary.distance_m != null
          ? Math.round(summary.distance_m / 100) / 10
          : null

        setData({
          ...TRAINING,
          status: {
            value: statusLabel,
            sub:   TRAINING.status.sub,
            trend: TRAINING.status.trend,
          },
          vo2max: {
            value:      summary.vo2max      ?? TRAINING.vo2max.value,
            unit:       'mL/kg/min',
            delta:      TRAINING.vo2max.delta,
            fitnessAge: summary.fitness_age ?? TRAINING.vo2max.fitnessAge,
            trend:      vo2maxTrend,
          },
          load: {
            value: trainingLoad ?? TRAINING.load.value,
            low:   loadMin,
            high:  loadMax,
            state: loadState,
            trend: loadTrend.length ? loadTrend : TRAINING.load.trend,
          },
          intensity: {
            moderate: summary.intensity_mod_min ?? TRAINING.intensity.moderate,
            vigorous: summary.intensity_vig_min ?? TRAINING.intensity.vigorous,
            goal:     150,
            trend:    intensityTrend.length ? intensityTrend : TRAINING.intensity.trend,
          },
          activities,
          dailyActivity: {
            steps:          summary.steps           ?? null,
            distanceKm,
            caloriesTotal:  summary.calories_total  ?? null,
            caloriesActive: summary.calories_active ?? null,
            floors:         summary.floors_up        ?? null,
            stepsTrend,
            calTrend,
          },
        })
      } catch {
        // keep stub on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useTrainingData.ts
git commit -m "feat: useTrainingData — dailyActivity panel data, vo2max trend, steps/cal trends"
```

---

## Task 7: Update RecoveryPage

**Files:**
- Modify: `client/src/pages/RecoveryPage.tsx`
- Modify: `tests/client/App.test.tsx`

- [ ] **Step 1: Add test for SpO2 absent with no real data**

In `tests/client/App.test.tsx`, add inside the `describe('App', ...)` block:

```ts
test('does not render SpO2 tile on /recovery when watch data unavailable', () => {
  renderApp('/recovery')
  expect(screen.queryByText(/SpO₂/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect this test passes immediately** (initial state already has null SpO2)

```bash
npx vitest run tests/client/App.test.tsx
```

Expected: all pass.

- [ ] **Step 3: Replace RecoveryOverview and RecoveryTrends**

Replace the full `RecoveryOverview` function:

```tsx
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
          foot={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <BodyBattery now={rec.battery.now} max={rec.battery.max} min={rec.battery.min} accent={A} height={12} />
              {rec.batteryConsumed != null && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
                  CONSUMED {rec.batteryConsumed}%
                </span>
              )}
            </div>
          }
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
        <VitalTile label="Stress" value={rec.stress.value} unit="avg" data={rec.stress.trend} accent={A} delta={rec.stress.value - rec.stress.avg} lowerBetter sub={rec.stressLabel} />
        {rec.stressMax != null && (
          <VitalTile label="Peak Stress" value={rec.stressMax} unit="max" accent={A} lowerBetter />
        )}
        <VitalTile label="Respiration" value={rec.resp.value} unit="br/m" data={rec.resp.trend} accent={A} delta={rec.resp.value - rec.resp.avg} lowerBetter />
        {rec.respMax != null && (
          <VitalTile label="Peak Resp" value={rec.respMax} unit="br/m" accent={A} lowerBetter />
        )}
        {rec.spo2.value != null && (
          <VitalTile label="SpO₂" value={rec.spo2.value} unit="%" data={rec.spo2.trend} accent={A} delta={(rec.spo2.value - (rec.spo2.avg ?? rec.spo2.value))} />
        )}
      </div>
    </>
  )
}
```

Replace the full `RecoveryTrends` function:

```tsx
function RecoveryTrends() {
  const { data: rec } = useRecoveryData()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rec.score.trend.length > 0 && (
        <TrendRow label="Score" value={rec.score.value} data={rec.score.trend} accent={A} />
      )}
      {rec.hrv.trend.length > 0 && (
        <TrendRow label="HRV" value={rec.hrv.value} unit="ms" data={rec.hrv.trend} accent={A} delta={rec.hrv.value - rec.hrv.avg} />
      )}
      {rec.battery.trend.length > 0 && (
        <TrendRow label="Body Battery" value={rec.battery.now} data={rec.battery.trend} accent={A} kind="bars" />
      )}
      {rec.rhr.trend.length > 0 && (
        <TrendRow label="Resting HR" value={rec.rhr.value} unit="bpm" data={rec.rhr.trend} accent={A} delta={rec.rhr.value - rec.rhr.avg} lowerBetter />
      )}
      {rec.stress.trend.length > 0 && (
        <TrendRow label="Stress" value={rec.stress.value} unit="avg" data={rec.stress.trend} accent={A} delta={rec.stress.value - rec.stress.avg} lowerBetter />
      )}
      {rec.resp.trend.length > 0 && (
        <TrendRow label="Respiration" value={rec.resp.value} unit="br/m" data={rec.resp.trend} accent={A} lowerBetter />
      )}
      {rec.spo2.value != null && rec.spo2.trend.length > 0 && (
        <TrendRow label="SpO₂" value={rec.spo2.value} unit="%" data={rec.spo2.trend} accent={A} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Type-check and run tests**

```bash
npx tsc --noEmit && npx vitest run tests/client/App.test.tsx
```

Expected: 0 type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/RecoveryPage.tsx tests/client/App.test.tsx
git commit -m "feat: RecoveryPage — battery consumed, stress label, peak tiles, SpO2 gate"
```

---

## Task 8: Update SleepPage

**Files:**
- Modify: `client/src/pages/SleepPage.tsx`
- Modify: `tests/client/App.test.tsx`

- [ ] **Step 1: Add test for SpO2 absent and stage ratios**

Add to `tests/client/App.test.tsx` inside `describe('App', ...)`:

```ts
test('does not render SpO2 tiles on /sleep when watch data unavailable', () => {
  renderApp('/sleep')
  expect(screen.queryByText(/SpO₂ avg/)).not.toBeInTheDocument()
  expect(screen.queryByText(/SpO₂ low/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect pass immediately**

```bash
npx vitest run tests/client/App.test.tsx
```

Expected: all pass.

- [ ] **Step 3: Replace SleepOverview and SleepTrends functions**

Replace the full `SleepOverview` function:

```tsx
function SleepOverview() {
  const { data: slp } = useSleepData()
  const efficiencyPct = slp.duration.inBed > 0
    ? Math.round((slp.duration.mins / slp.duration.inBed) * 100)
    : 0
  const debtH = slp.sleepDebt != null ? Math.floor(slp.sleepDebt / 60) : 0
  const debtM = slp.sleepDebt != null ? slp.sleepDebt % 60 : 0

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.sleep} />

      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <HeadlineCard
          accent={A}
          label="Duration"
          foot={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
                {efficiencyPct}% efficiency
              </span>
              {slp.sleepDebt != null && slp.sleepDebt > 0 && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.mx4Amber }}>
                  DEBT {debtH > 0 ? `${debtH}h ` : ''}{String(debtM).padStart(2, '0')}m
                </span>
              )}
            </div>
          }
        >
          <Gauge value={slp.duration.mins} max={480} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {slp.duration.h}h {String(slp.duration.m).padStart(2, '0')}m
            </span>
          </Gauge>
        </HeadlineCard>

        <HeadlineCard
          accent={A}
          label="Sleep Score"
          foot={
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textSecondary }}>
              {slp.score.state}
            </span>
          }
        >
          <Gauge value={slp.score.value} max={100} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {slp.score.value}
            </span>
          </Gauge>
        </HeadlineCard>
      </div>

      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 10, padding: '12px 13px', marginBottom: 9,
      }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 8 }}>
          OVERNIGHT DEPTH
        </div>
        <SleepDepth hypno={slp.hypno} accent={A} h={80} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>23:00</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>03:00</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>07:00</span>
        </div>
      </div>

      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 10, padding: '12px 13px', marginBottom: 9,
      }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 10 }}>
          STAGE BREAKDOWN · {fmtDur(slp.duration.mins)}
          {slp.deepRatio != null && ` · DEEP ${slp.deepRatio}%`}
          {slp.remRatio  != null && ` · REM ${slp.remRatio}%`}
        </div>
        <StageSplit stages={slp.stages} />
        <div style={{ marginTop: 10 }}>
          <StageLegend stages={slp.stages} />
        </div>
      </div>

      <Rail label="OVERNIGHT VITALS" accent={A} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {slp.spo2.avg != null && (
          <VitalTile label="SpO₂ avg" value={slp.spo2.avg} unit="%" accent={A} />
        )}
        {slp.spo2.low != null && (
          <VitalTile label="SpO₂ low" value={slp.spo2.low} unit="%" accent={A} />
        )}
        <VitalTile label="Respiration" value={slp.resp.avg} unit="br/m" accent={A} />
        {slp.sleepHr != null && (
          <VitalTile label="Avg Heart Rate" value={slp.sleepHr} unit="bpm" data={slp.sleepHrTrend} accent={A} />
        )}
        {slp.sleepStress != null && (
          <VitalTile label="Sleep Stress" value={slp.sleepStress} unit="" data={slp.sleepStressTrend} accent={A} lowerBetter />
        )}
      </div>
    </>
  )
}
```

Replace the full `SleepTrends` function:

```tsx
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
```

Also add `COLORS` to the import if not already present — `SleepPage` needs `COLORS.mx4Amber`. Current import is:
```ts
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../theme'
```
`COLORS` is already imported. ✓

- [ ] **Step 4: Type-check and run tests**

```bash
npx tsc --noEmit && npx vitest run tests/client/App.test.tsx
```

Expected: 0 errors, all pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/SleepPage.tsx tests/client/App.test.tsx
git commit -m "feat: SleepPage — sleep debt, stage ratios, SpO2 gate, 3 new Trend rows"
```

---

## Task 9: Update TrainingPage

**Files:**
- Modify: `client/src/pages/TrainingPage.tsx`
- Modify: `tests/client/App.test.tsx`

- [ ] **Step 1: Add test for Daily Activity section**

Add to `tests/client/App.test.tsx` inside `describe('App', ...)`:

```ts
test('renders DAILY ACTIVITY section on /training route', () => {
  renderApp('/training')
  expect(screen.getByText(/DAILY ACTIVITY/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect fail** (section doesn't exist yet)

```bash
npx vitest run tests/client/App.test.tsx
```

Expected: 1 failure on DAILY ACTIVITY test.

- [ ] **Step 3: Replace TrainingOverview and TrainingTrends**

Replace the full `TrainingOverview` function:

```tsx
function TrainingOverview() {
  const { data: TRN } = useTrainingData()
  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.training} />

      <StatusBanner status={TRN.status.value} sub={TRN.status.sub} accent={A} />

      {/* VO2 Max */}
      <div style={{ marginTop: 9, marginBottom: 9 }}>
        <HeadlineCard
          accent={A}
          label="VO2 Max"
          foot={
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
              Fitness age {typeof TRN.vo2max.fitnessAge === 'number' ? Math.round(TRN.vo2max.fitnessAge * 10) / 10 : TRN.vo2max.fitnessAge}
            </span>
          }
        >
          <Gauge value={TRN.vo2max.value} max={70} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 24, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {TRN.vo2max.value}
            </span>
            <Delta value={TRN.vo2max.delta} size={9} />
          </Gauge>
        </HeadlineCard>
      </div>

      {/* Acute Load */}
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: '12px 13px', marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>ACUTE LOAD</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: A }}>{TRN.load.state.toUpperCase()}</span>
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1, display: 'block', marginBottom: 10 }}>
          {TRN.load.value}
        </span>
        <LoadBand value={TRN.load.value} low={TRN.load.low} high={TRN.load.high} accent={A} />
      </div>

      <Rail label="INTENSITY THIS WEEK" accent={A} right={`GOAL ${TRN.intensity.goal} MIN`} />
      <IntensityBar moderate={TRN.intensity.moderate} vigorous={TRN.intensity.vigorous} goal={TRN.intensity.goal} accent={A} />

      {/* Daily Activity */}
      <Rail label="DAILY ACTIVITY" accent={A} right={TRN.dailyActivity.steps != null ? `${TRN.dailyActivity.steps.toLocaleString()} STEPS` : undefined} />
      {TRN.dailyActivity.steps != null ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
          <VitalTile label="Steps" value={TRN.dailyActivity.steps.toLocaleString()} unit="today" accent={A} />
          {TRN.dailyActivity.distanceKm != null && (
            <VitalTile label="Distance" value={TRN.dailyActivity.distanceKm} unit="km" accent={A} />
          )}
          {TRN.dailyActivity.caloriesTotal != null && (
            <VitalTile label="Calories" value={TRN.dailyActivity.caloriesTotal} unit="kcal" accent={A} />
          )}
          {TRN.dailyActivity.floors != null && (
            <VitalTile label="Floors" value={TRN.dailyActivity.floors} unit="fl" accent={A} />
          )}
        </div>
      ) : (
        <div style={{
          background: hexA(A, 0.06), border: `1px solid ${hexA(A, 0.18)}`,
          borderRadius: 10, padding: '20px 16px', textAlign: 'center', marginBottom: 9,
        }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.12em', color: COLORS.textMuted }}>
            CALIBRATING
          </span>
        </div>
      )}

      <Rail label="ACTIVITY LOG" accent={A} right={TRN.activities.length > 0 ? `${TRN.activities.length} RECENT` : undefined} />
      {TRN.activities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TRN.activities.map(act => (
            <LogEntry key={act.activity_id} activity={act} accent={A} />
          ))}
        </div>
      ) : (
        <div style={{
          background: hexA(A, 0.06), border: `1px solid ${hexA(A, 0.18)}`,
          borderRadius: 10, padding: '20px 16px', textAlign: 'center',
        }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.12em', color: COLORS.textMuted }}>
            CALIBRATING
          </span>
        </div>
      )}
    </>
  )
}
```

Add `VitalTile` to the imports at the top of `TrainingPage.tsx`:

```tsx
import { VitalTile } from '../components/viz/VitalTile'
```

Replace the full `TrainingTrends` function:

```tsx
function TrainingTrends() {
  const { data: TRN } = useTrainingData()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {TRN.load.trend.length > 0 && (
        <TrendRow label="Load" value={TRN.load.value} data={TRN.load.trend} accent={A} kind="bars" />
      )}
      {TRN.vo2max.trend.length > 0 && (
        <TrendRow label="VO2 Max" value={TRN.vo2max.value} unit="mL/kg" data={TRN.vo2max.trend} accent={A} delta={TRN.vo2max.delta} />
      )}
      {TRN.intensity.trend.length > 0 && (
        <TrendRow label="Intensity" value={`${TRN.intensity.moderate + TRN.intensity.vigorous * 2}`} unit="pts" data={TRN.intensity.trend} accent={A} kind="bars" />
      )}
      {TRN.dailyActivity.stepsTrend.length > 0 && (
        <TrendRow label="Steps" value={TRN.dailyActivity.steps != null ? TRN.dailyActivity.steps.toLocaleString() : 0} data={TRN.dailyActivity.stepsTrend} accent={A} kind="bars" />
      )}
      {TRN.dailyActivity.calTrend.length > 0 && (
        <TrendRow label="Calories" value={TRN.dailyActivity.caloriesTotal ?? 0} unit="kcal" data={TRN.dailyActivity.calTrend} accent={A} kind="bars" />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Type-check and run tests**

```bash
npx tsc --noEmit && npx vitest run tests/client/App.test.tsx
```

Expected: 0 errors, all pass including new DAILY ACTIVITY test.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/TrainingPage.tsx tests/client/App.test.tsx
git commit -m "feat: TrainingPage — daily activity panel, vo2max trend fix, steps/cal trends"
```

---

## Task 10: Full validation + visual check

- [ ] **Step 1: Run all tests**

```bash
cd /opt/bacta && npm test
```

Expected: all suites pass, 0 failures.

- [ ] **Step 2: Type-check client and server**

```bash
npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```

Expected: 0 errors on both.

- [ ] **Step 3: Screenshot Recovery Overview via Playwright**

Navigate to `http://localhost:5173/recovery`, full-page screenshot. Verify:
- Body Battery card shows "CONSUMED X%" line
- Vitals grid shows Stress with sub-label (e.g. "LOW")
- Peak Stress and Peak Resp tiles present
- No SpO₂ tile visible

- [ ] **Step 4: Screenshot Recovery Trends via Playwright**

Click Trends toggle, screenshot. Verify:
- All TrendRows show real sparklines
- No SpO₂ row

- [ ] **Step 5: Screenshot Sleep Overview via Playwright**

Navigate to `http://localhost:5173/sleep`, full-page screenshot. Verify:
- Duration card shows "DEBT Xh XXm" in amber (if under 8h)
- Stage breakdown header shows `· DEEP X% · REM X%`
- No SpO₂ avg/low tiles
- Sleep HR and Sleep Stress tiles have sparklines

- [ ] **Step 6: Screenshot Sleep Trends via Playwright**

Click Trends, screenshot. Verify:
- Respiration, Heart Rate, Stress TrendRows present with sparklines

- [ ] **Step 7: Screenshot Training Overview via Playwright**

Navigate to `http://localhost:5173/training`, full-page screenshot. Verify:
- DAILY ACTIVITY rail present
- Steps / Distance / Calories / Floors tiles (or CALIBRATING if no data)

- [ ] **Step 8: Screenshot Training Trends via Playwright**

Click Trends, screenshot. Verify:
- VO2 Max row shows real sparse trend (not status trend)
- Steps and Calories bar rows present

- [ ] **Step 9: Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix: post-validation corrections from visual review"
```
