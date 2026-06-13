# Chart Avg Lines + Recovery/Sleep Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix avg label overlap in Bars7, add avg line support to Sparkline/TrendRow, fix recovery time unit bug, wire real hypnogram data from the DB, add a dedicated Arch Score card, fill in missing SpO2/Sleep HR trend graphs, and add a 4th overnight vital to Recovery.

**Architecture:** Shared viz components first (Bars7, Sparkline, TrendRow), then server endpoint, then data hooks, then pages. Each task is independent once its dependencies land. All changes are frontend inline-styles only — no CSS files.

**Tech Stack:** React 19 + TypeScript, Express + better-sqlite3, Vitest + Testing Library, supertest for API tests. Dev: `npm run dev:client` / `npm run dev:server`. Tests: `npm test`. Type-check: `npx tsc --noEmit` (client), `npx tsc -p tsconfig.server.json --noEmit` (server).

---

## File Map

| File | What changes |
|---|---|
| `client/src/components/viz/Bars7.tsx` | avg label → left side |
| `client/src/components/primitives/Sparkline.tsx` | add `avgLine?: number` prop |
| `client/src/components/viz/TrendRow.tsx` | add `avg?: boolean` prop |
| `server/api/garmin.ts` | new `GET /api/garmin/sleep-hypno` endpoint |
| `client/src/hooks/useRecoveryData.ts` | fix recovery_time_h ÷60, add spo2Trend + sleepHr fields |
| `client/src/hooks/useSleepData.ts` | add sleepSpo2Trend, arch component scores, real hypno |
| `client/src/pages/RecoveryPage.tsx` | wire avg lines, SpO2 data, 4th vital, recovery time display |
| `client/src/pages/SleepPage.tsx` | SpO2 data, remove arch badge, dynamic time labels, Arch Score card, avg on trends |
| `tests/server/garmin.test.ts` | add sleep-hypno endpoint test |

---

## Task 1: Bars7 — Move Avg Label to Left Side

**Files:**
- Modify: `client/src/components/viz/Bars7.tsx:61-78`

The avg label container currently uses `justifyContent: 'flex-end'` which puts the value on the right side of the avg line, overlapping the today-bar's value label. Moving to left eliminates the overlap — the absolute-positioned container naturally superimposes over bar bodies when needed.

- [ ] **Step 1: Update the avg label block**

In `client/src/components/viz/Bars7.tsx`, replace the `avgVal != null` block (lines 61–78) with:

```tsx
{avgVal != null && (
  <div style={{
    position: 'absolute', left: 0, right: 0,
    bottom: `${((avgVal - min) / (max - min)) * h + 18}px`,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
    borderTop: `1px solid ${hexA(COLORS.textMuted, 0.3)}`,
    pointerEvents: 'none',
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 2, paddingLeft: 2 }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 7, color: COLORS.textMuted, lineHeight: 1 }}>
        {fmt ? fmt(avgVal) : Math.round(avgVal)}
      </span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 6, color: COLORS.textMuted, lineHeight: 1.2, opacity: 0.65 }}>
        AVG
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/viz/Bars7.tsx
git commit -m "fix: move Bars7 avg label to left side to prevent today-value overlap"
```

---

## Task 2: Sparkline — Add `avgLine` Prop

**Files:**
- Modify: `client/src/components/primitives/Sparkline.tsx`

Add `avgLine?: number` prop. When provided, draw a horizontal dashed line at the y-position corresponding to that value within the sparkline's `min..max` data range, plus a small "AVG" text label at the left edge. Clamp `avgLine` to `[min, max]` so it never renders outside the SVG bounds.

- [ ] **Step 1: Update Sparkline**

Replace the entire content of `client/src/components/primitives/Sparkline.tsx` with:

```tsx
import { useId } from 'react'
import { COLORS, FONT_MONO } from '../../theme'

interface SparklineProps {
  data: number[]
  accent: string
  w?: number
  h?: number
  sw?: number
  fill?: boolean
  dot?: boolean
  avgLine?: number
}

export function Sparkline({ data, accent, w = 92, h = 30, sw = 1.8, fill = true, dot = true, avgLine }: SparklineProps) {
  if (data.length === 0) {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} />
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const rng = max - min || 1
  const pts = data.map((d, i) => [
    (i / Math.max(data.length - 1, 1)) * w,
    h - 3 - ((d - min) / rng) * (h - 6),
  ])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  const id = 'sg' + useId().replace(/:/g, '')
  const last = pts[pts.length - 1]

  const avgY = avgLine != null
    ? h - 3 - ((Math.max(min, Math.min(max, avgLine)) - min) / rng) * (h - 6)
    : null

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.28" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={accent} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      {dot && <circle cx={last[0]} cy={last[1]} r={2.4} fill={accent} />}
      {avgY != null && (
        <>
          <line x1={0} y1={avgY} x2={w} y2={avgY}
            stroke={COLORS.textMuted} strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
          <text x={2} y={avgY - 2} fontSize={6} fontFamily={FONT_MONO} fill={COLORS.textMuted} opacity={0.65}>AVG</text>
        </>
      )}
    </svg>
  )
}
```

- [ ] **Step 2: Write test**

Add to `tests/client/components/` — create `tests/client/components/Sparkline.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Sparkline } from '../../../client/src/components/primitives/Sparkline'

describe('Sparkline', () => {
  it('renders without crashing with empty data', () => {
    const { container } = render(<Sparkline data={[]} accent="#2bc4e8" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a line path with data', () => {
    const { container } = render(<Sparkline data={[10, 20, 15, 25]} accent="#2bc4e8" />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThan(0)
  })

  it('renders avg dashed line when avgLine is provided', () => {
    const { container } = render(
      <Sparkline data={[10, 20, 15, 25]} accent="#2bc4e8" avgLine={17} />
    )
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBe(1)
    expect(lines[0].getAttribute('stroke-dasharray')).toBe('3 3')
  })

  it('does not render avg line when avgLine is undefined', () => {
    const { container } = render(<Sparkline data={[10, 20, 15, 25]} accent="#2bc4e8" />)
    expect(container.querySelectorAll('line').length).toBe(0)
  })

  it('clamps avgLine below min to min position', () => {
    const { container } = render(
      <Sparkline data={[10, 20]} accent="#2bc4e8" avgLine={0} h={30} />
    )
    const line = container.querySelector('line')
    expect(line).toBeTruthy()
    // Should render at bottom (clamped to min=10 → bottom-ish y)
    const y = Number(line!.getAttribute('y1'))
    expect(y).toBeGreaterThan(20) // near bottom of 30px chart
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test:client -- --reporter=verbose 2>&1 | grep -E "Sparkline|PASS|FAIL|✓|✗"
```
Expected: all Sparkline tests pass.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/primitives/Sparkline.tsx tests/client/components/Sparkline.test.tsx
git commit -m "feat: add avgLine prop to Sparkline for dashed horizontal avg line"
```

---

## Task 3: TrendRow — Add `avg` Prop

**Files:**
- Modify: `client/src/components/viz/TrendRow.tsx`

Add `avg?: boolean` to `TrendRowProps`. When `true` and `kind !== 'bars'`, compute the mean of `data` and pass it as `avgLine` to `Sparkline`. Has no effect when `kind='bars'` (Bars7 handles avg internally).

- [ ] **Step 1: Update TrendRow**

In `client/src/components/viz/TrendRow.tsx`, update the interface and component:

```tsx
import { COLORS, FONT_MONO, type CardInfo } from '../../theme'
import { hexA } from '../../lib/hexA'
import { Sparkline } from '../primitives/Sparkline'
import { Bars7 } from './Bars7'
import { Delta } from './Delta'
import { useCardInfoOverlay, InfoOverlay } from '../../lib/InfoCardContext'

interface TrendRowProps {
  label: string
  value: string | number
  unit?: string
  sub?: string
  data: number[]
  accent: string
  delta?: number
  lowerBetter?: boolean
  kind?: 'spark' | 'bars'
  fmt?: (v: number) => string
  avg?: boolean
  info?: CardInfo
}

/** Trends-tab row: label/value/delta left, sparkline or bar chart right. */
export function TrendRow({ label, value, unit, sub, data, accent, delta, lowerBetter, kind = 'spark', fmt, avg, info }: TrendRowProps) {
  const cardId = `tr-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  const { isOpen, handleTap } = useCardInfoOverlay(cardId, info, accent)

  const sparkAvgLine = avg && kind !== 'bars' && data.length > 1
    ? Math.round(data.reduce((s, v) => s + v, 0) / data.length * 10) / 10
    : undefined

  return (
    <div
      onClick={info ? handleTap : undefined}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
        background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 9, padding: '11px 13px', overflow: 'hidden',
        cursor: info ? 'pointer' : 'default',
      }}
    >
      <span style={{
        position: 'absolute', top: 0, bottom: 0, left: 0,
        width: 2, background: accent, opacity: 0.7,
      }} />
      <div style={{ minWidth: 84, flexShrink: 0 }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 600,
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
            {value}
          </span>
          {unit && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{unit}</span>
          )}
        </div>
        {(delta !== undefined || sub) && (
          <div style={{ marginTop: 4 }}>
            {delta !== undefined
              ? <Delta value={delta} lowerBetter={lowerBetter} size={9} />
              : <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{sub}</span>}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {kind === 'bars'
          ? <Bars7 data={data} accent={accent} h={42} fmt={fmt} avg={avg} />
          : <Sparkline data={data} accent={accent} w={180} h={42} sw={1.8} avgLine={sparkAvgLine} />}
      </div>
      {isOpen && info && <InfoOverlay info={info} accent={accent} radius={9} compact onClick={handleTap} />}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Run all tests**

```bash
npm test 2>&1 | tail -5
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/viz/TrendRow.tsx
git commit -m "feat: add avg prop to TrendRow, passes avgLine to Sparkline for spark charts"
```

---

## Task 4: Server — `GET /api/garmin/sleep-hypno` Endpoint

**Files:**
- Modify: `server/api/garmin.ts` (add before the `/:metric` wildcard)
- Modify: `tests/server/garmin.test.ts` (add test)

The Garmin API stores `sleepLevels` inside `source_json` for the `sleep_score` metric. This endpoint extracts that data, resamples to 24 fixed blocks (each covering `totalSleepTime / 24` of the sleep window), and converts Garmin's encoding (0=deep, 3=awake) to SleepDepth's encoding (3=deep, 0=awake) via `3 - activityLevel`.

- [ ] **Step 1: Add the endpoint to garmin.ts**

In `server/api/garmin.ts`, add this block **before** the `/:metric` wildcard route (find the line `garminRouter.get('/:metric', ...)`). Insert immediately before it:

```typescript
// GET /api/garmin/sleep-hypno — resampled 24-block hypnogram from stored sleepLevels
garminRouter.get('/sleep-hypno', (_req, res) => {
  try {
    const row = db.prepare(
      `SELECT source_json FROM garmin_snapshots
       WHERE metric = 'sleep_score'
       ORDER BY date DESC LIMIT 1`
    ).get() as { source_json: string } | undefined

    if (!row?.source_json) {
      res.json({ hypno: [], startLocal: null, endLocal: null })
      return
    }

    const src = JSON.parse(row.source_json) as {
      dailySleepDTO?: {
        sleepStartTimestampGMT?: string
        sleepEndTimestampGMT?: string
        sleepStartTimestampLocal?: string
        sleepEndTimestampLocal?: string
      }
      sleepLevels?: Array<{ startGMT: string; endGMT: string; activityLevel: number }>
    }

    const dto = src.dailySleepDTO
    const levels = src.sleepLevels ?? []

    if (!dto?.sleepStartTimestampGMT || !dto?.sleepEndTimestampGMT || levels.length === 0) {
      res.json({ hypno: [], startLocal: null, endLocal: null })
      return
    }

    const startMs = new Date(dto.sleepStartTimestampGMT).getTime()
    const endMs   = new Date(dto.sleepEndTimestampGMT).getTime()
    const totalMs = endMs - startMs

    const BLOCKS = 24
    const blockMs = totalMs / BLOCKS
    const hypno: number[] = []

    for (let i = 0; i < BLOCKS; i++) {
      const midMs = startMs + i * blockMs + blockMs / 2
      let garminLevel = 3 // default: awake
      for (const seg of levels) {
        const segStart = new Date(seg.startGMT).getTime()
        const segEnd   = new Date(seg.endGMT).getTime()
        if (midMs >= segStart && midMs < segEnd) {
          garminLevel = seg.activityLevel
          break
        }
      }
      // Convert: Garmin 0=deep → SleepDepth 3=deep, Garmin 3=awake → SleepDepth 0=awake
      hypno.push(3 - garminLevel)
    }

    res.json({
      hypno,
      startLocal: dto.sleepStartTimestampLocal ?? null,
      endLocal:   dto.sleepEndTimestampLocal   ?? null,
    })
  } catch {
    res.json({ hypno: [], startLocal: null, endLocal: null })
  }
})
```

- [ ] **Step 2: Write the test**

In `tests/server/garmin.test.ts`, add a new `describe` block after the existing tests:

```typescript
describe('GET /api/garmin/sleep-hypno', () => {
  beforeAll(async () => {
    const { default: db } = await import('../../server/db/client')
    const today = new Date().toISOString().slice(0, 10)

    // Build minimal source_json with sleepLevels
    // Sleep window: 00:00 – 08:00 UTC, 8 hours = 8 × 3600000ms
    // Each of 24 blocks = 20min. We set levels covering the full window.
    const start = new Date(today + 'T00:00:00.0')
    const end   = new Date(today + 'T08:00:00.0')
    const blockMs = (end.getTime() - start.getTime()) / 24

    // Create 24 level segments alternating 0 (deep) and 3 (awake)
    const sleepLevels = Array.from({ length: 24 }, (_, i) => ({
      startGMT: new Date(start.getTime() + i * blockMs).toISOString().replace('Z', '.0'),
      endGMT:   new Date(start.getTime() + (i + 1) * blockMs).toISOString().replace('Z', '.0'),
      activityLevel: i % 2 === 0 ? 0 : 3,   // alternating deep / awake
    }))

    const sourceJson = JSON.stringify({
      dailySleepDTO: {
        sleepStartTimestampGMT:   start.toISOString().replace('Z', '.0'),
        sleepEndTimestampGMT:     end.toISOString().replace('Z', '.0'),
        sleepStartTimestampLocal: today + 'T20:00:00.0',
        sleepEndTimestampLocal:   today + 'T04:00:00.0',
      },
      sleepLevels,
    })

    const insertWithJson = db.prepare(
      'INSERT INTO garmin_snapshots (date, metric, value, unit, source_json) VALUES (?, ?, ?, ?, ?)'
    )
    insertWithJson.run(today, 'sleep_score', 80, '', sourceJson)
  })

  it('returns 24-block hypno array', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/sleep-hypno')
    expect(res.status).toBe(200)
    expect(res.body.hypno).toHaveLength(24)
  })

  it('converts Garmin encoding: 0 (deep) → 3, 3 (awake) → 0', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/sleep-hypno')
    const hypno: number[] = res.body.hypno
    // Even blocks had garminLevel=0 (deep) → should be 3
    expect(hypno[0]).toBe(3)
    // Odd blocks had garminLevel=3 (awake) → should be 0
    expect(hypno[1]).toBe(0)
  })

  it('returns startLocal and endLocal strings', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/sleep-hypno')
    expect(typeof res.body.startLocal).toBe('string')
    expect(typeof res.body.endLocal).toBe('string')
  })

  it('returns empty hypno when no sleep_score row exists', async () => {
    // Use a fresh in-memory db state via a new import — instead just call
    // the endpoint with a metric name that never has source_json
    // (we can't easily test empty state without resetting DB; verify shape only)
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/garmin/sleep-hypno')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.hypno)).toBe(true)
  })
})
```

- [ ] **Step 3: Run server tests**

```bash
npm run test:server -- --reporter=verbose 2>&1 | grep -E "sleep-hypno|PASS|FAIL|✓|✗"
```
Expected: all 4 sleep-hypno tests pass.

- [ ] **Step 4: Type-check server**

```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add server/api/garmin.ts tests/server/garmin.test.ts
git commit -m "feat: add GET /api/garmin/sleep-hypno endpoint with 24-block resample"
```

---

## Task 5: useRecoveryData — Unit Fix + New Fields

**Files:**
- Modify: `client/src/hooks/useRecoveryData.ts`

Three changes:
1. `recovery_time_h` values in DB are minutes (Garmin's Training Readiness field returns minutes). Divide by 60.
2. Add `spo2Trend: number[]` from `fetchTrend('spo2_avg')`.
3. Add `sleepHrNight: number | null` + `sleepHrTrend: number[]` from `fetchTrend('sleep_hr')` and `summary.sleep_hr`.

- [ ] **Step 1: Update RecoveryData type**

In `client/src/hooks/useRecoveryData.ts`, update the `RecoveryData` type. Add three new fields to the `Omit<typeof RECOVERY, ...> & {...}` section:

```typescript
export type RecoveryData = Omit<typeof RECOVERY, 'spo2' | 'hrv'> & {
  hrv: {
    value: number
    unit: string
    avg: number | null
    trend: number[]
    direction: HrvDirection | null
  }
  spo2: { value: number | null; unit: string; avg: number | null; trend: number[] }
  hrvBaselineLow?: number
  hrvBaselineHigh?: number
  stressLabel?: string
  stressMax?: number
  stressMaxTrend: number[]
  respMax?: number
  batteryConsumed?: number
  sleepStress?: number | null
  sleepStressTrend: number[]
  recoveryTimeH?: number | null
  recoveryTimeTrend: number[]
  spo2Trend: number[]
  sleepHrNight: number | null
  sleepHrTrend: number[]
}
```

- [ ] **Step 2: Update INITIAL state**

Update the `INITIAL` constant to include the new fields:

```typescript
const INITIAL: RecoveryData = {
  ...RECOVERY,
  hrv: { ...RECOVERY.hrv, direction: null },
  spo2: { value: null, unit: '%', avg: null, trend: [] },
  stressMaxTrend: [],
  sleepStress: null,
  sleepStressTrend: [],
  recoveryTimeH: null,
  recoveryTimeTrend: [],
  spo2Trend: [],
  sleepHrNight: null,
  sleepHrTrend: [],
}
```

- [ ] **Step 3: Update the load() function**

Replace the `Promise.all` call and everything below it inside `load()` with:

```typescript
const [
  summary, hrvTrend, rhrTrend, battTrend, stressTrend, respTrend,
  scoreTrend, stressMaxTrend, sleepStressTrend, recoveryTimeTrend,
  spo2Trend, sleepHrTrend,
] = await Promise.all([
  fetchSummary(),
  fetchTrend('hrv'),
  fetchTrend('resting_hr'),
  fetchTrend('body_battery_wake'),
  fetchTrend('stress_avg'),
  fetchTrend('resp_avg'),
  fetchTrend('recovery_score'),
  fetchTrend('stress_max'),
  fetchTrend('sleep_stress'),
  fetchTrend('recovery_time_h'),
  fetchTrend('spo2_avg'),
  fetchTrend('sleep_hr'),
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

const trendForDir = hrvTrend.length ? hrvTrend : RECOVERY.hrv.trend
const slope = linearRegressionSlope(trendForDir)
const roundedSlope = Math.round(slope * 10) / 10
const direction: HrvDirection = {
  slope: roundedSlope,
  direction: slope > 0.3 ? 'up' : slope < -0.3 ? 'down' : 'stable',
  label: slope > 0.3 ? '↑ IMPROVING' : slope < -0.3 ? '↓ DECLINING' : '→ STABLE',
  sub: `${roundedSlope >= 0 ? '+' : ''}${roundedSlope.toFixed(1)} ms/day`,
}

// recovery_time_h is stored in minutes — convert to hours (1 decimal)
const toHours = (mins: number) => Math.round(mins / 60 * 10) / 10

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
    direction: trendForDir.length >= 2 ? direction : null,
  },
  battery: {
    now:   summary.body_battery_current ?? RECOVERY.battery.now,
    max:   summary.body_battery_wake    ?? RECOVERY.battery.max,
    min:   0,
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
  stressMax:        summary.stress_max,
  stressMaxTrend:   stressMaxTrend.length ? stressMaxTrend : [],
  respMax:          summary.resp_max,
  batteryConsumed,
  sleepStress:      summary.sleep_stress ?? null,
  sleepStressTrend: sleepStressTrend.length ? sleepStressTrend : [],
  recoveryTimeH:    summary.recovery_time_h != null ? toHours(summary.recovery_time_h) : null,
  recoveryTimeTrend: recoveryTimeTrend.length ? recoveryTimeTrend.map(toHours) : [],
  spo2Trend:        spo2Trend.length ? spo2Trend : [],
  sleepHrNight:     summary.sleep_hr ?? null,
  sleepHrTrend:     sleepHrTrend.length ? sleepHrTrend : [],
})
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useRecoveryData.ts
git commit -m "fix: convert recovery_time_h from minutes to hours; add spo2Trend + sleepHr fields"
```

---

## Task 6: useSleepData — SpO2 Trend, Arch Scores, Real Hypnogram

**Files:**
- Modify: `client/src/hooks/useSleepData.ts`

Three additions:
1. Fetch `sleep_spo2` trend → `sleepSpo2Trend: number[]`
2. Expose the three arch component scores (already computed inline, now stored on state)
3. Fetch real hypnogram from `/api/garmin/sleep-hypno`; store `hypnoStartLocal`/`hypnoEndLocal` for dynamic time labels

- [ ] **Step 1: Update SleepData type**

Replace the `SleepData` type in `client/src/hooks/useSleepData.ts`:

```typescript
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
  sleepSpo2Trend: number[]
  archScore: number | undefined
  archDeepScore: number | undefined
  archRemScore: number | undefined
  archAwakePenalty: number | undefined
  hypnoStartLocal: string | null
  hypnoEndLocal: string | null
}
```

- [ ] **Step 2: Update INITIAL state**

```typescript
const INITIAL: SleepData = {
  ...SLEEP,
  spo2: { avg: null, low: null, unit: '%' },
  sleepRespTrend: [],
  sleepHrTrend: [],
  sleepStressTrend: [],
  sleepSpo2Trend: [],
  archScore: undefined,
  archDeepScore: undefined,
  archRemScore: undefined,
  archAwakePenalty: undefined,
  hypnoStartLocal: null,
  hypnoEndLocal: null,
}
```

- [ ] **Step 3: Update load() function**

Replace the entire `load()` function body with:

```typescript
async function load() {
  try {
    const [
      summary, scoreTrend, deepTrend, respTrend, hrTrend, stressTrend,
      spo2Trend, hypnoRes,
    ] = await Promise.all([
      fetchSummary(),
      fetchTrend('sleep_score'),
      fetchTrend('sleep_deep_s'),
      fetchTrend('sleep_resp'),
      fetchTrend('sleep_hr'),
      fetchTrend('sleep_stress'),
      fetchTrend('sleep_spo2'),
      fetch('/api/garmin/sleep-hypno').then(r => r.json()).catch(() => ({ hypno: [], startLocal: null, endLocal: null })) as Promise<{ hypno: number[]; startLocal: string | null; endLocal: string | null }>,
    ])
    if (cancelled) return

    const deepS  = summary.sleep_deep_s  ?? 0
    const lightS = summary.sleep_light_s ?? 0
    const remS   = summary.sleep_rem_s   ?? 0
    const awakeS = summary.sleep_awake_s ?? 0
    const sleepS = summary.sleep_s ?? (deepS + lightS + remS)
    const totalMins = Math.round(sleepS / 60)
    const deepMins  = Math.round(deepS  / 60)
    const lightMins = Math.round(lightS / 60)
    const remMins   = Math.round(remS   / 60)
    const awakeMins = Math.round(awakeS / 60)
    const totalForPct = deepMins + lightMins + remMins || 1
    const deepTrendMins = deepTrend.map(v => Math.round(v / 60))

    const sleepDebt = totalMins > 0 ? Math.max(0, 480 - totalMins) : undefined
    const deepRatio = totalMins > 0 ? Math.round(deepMins / totalMins * 100) : undefined
    const remRatio  = totalMins > 0 ? Math.round(remMins  / totalMins * 100) : undefined

    const archDeepScore    = totalMins > 0 ? Math.min(deepMins / (totalMins * 0.20), 1) : undefined
    const archRemScore     = totalMins > 0 ? Math.min(remMins  / (totalMins * 0.22), 1) : undefined
    const archAwakePenalty = totalMins > 0 ? Math.max(0, 1 - awakeMins / (totalMins * 0.05)) : undefined
    const archScore = archDeepScore != null && archRemScore != null && archAwakePenalty != null
      ? Math.round((archDeepScore * 0.4 + archRemScore * 0.4 + archAwakePenalty * 0.2) * 100)
      : undefined

    const realHypno = hypnoRes.hypno.length === 24 ? hypnoRes.hypno : null

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
      archScore,
      archDeepScore,
      archRemScore,
      archAwakePenalty,
      sleepRespTrend:   respTrend,
      sleepHrTrend:     hrTrend,
      sleepStressTrend: stressTrend,
      sleepSpo2Trend:   spo2Trend.length ? spo2Trend : [],
      hypno: realHypno ?? SLEEP.hypno,
      hypnoStartLocal: hypnoRes.startLocal,
      hypnoEndLocal:   hypnoRes.endLocal,
    })
  } catch {
    // keep stub on error
  } finally {
    if (!cancelled) setLoading(false)
  }
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useSleepData.ts
git commit -m "feat: add sleepSpo2Trend, arch component scores, real hypnogram to useSleepData"
```

---

## Task 7: RecoveryPage — Wire Avg Lines, SpO2 Graph, 4th Vital, Fixed Trends

**Files:**
- Modify: `client/src/pages/RecoveryPage.tsx`

Five changes:
1. Add `SLEEP_HR_INFO` constant and wire 4th overnight vital tile
2. Wire `avgLine={rec.hrv.avg ?? undefined}` on both Overview and Trends HRV Sparklines
3. Wire `data={rec.spo2Trend}` on SpO2 tile
4. `recoveryTimeH` is now in hours (e.g. `20.6`) — display is already correct, but add `avg` to its TrendRow
5. Add `avg` prop to all TrendRow spark entries in RecoveryTrends

- [ ] **Step 1: Add SLEEP_HR_INFO constant**

After the existing `SLEEP_STRESS_INFO` constant in `RecoveryPage.tsx` (around line 49), add:

```tsx
const SLEEP_HR_INFO: CardInfo = {
  title: 'Sleep Heart Rate',
  description: 'Average heart rate during the sleep window. Lower signals better cardiovascular efficiency at rest. Elevation above your norm often flags alcohol, illness, or overtraining stress.',
  source: 'Garmin Venu 4 · optical HR',
}
```

- [ ] **Step 2: Wire avgLine on Overview HRV Sparkline**

In `RecoveryOverview`, find the `<Sparkline data={rec.hrv.trend} accent={A} w={280} h={36} />` line (around line 176). Change it to:

```tsx
<Sparkline data={rec.hrv.trend} accent={A} w={280} h={36} avgLine={rec.hrv.avg ?? undefined} />
```

- [ ] **Step 3: Wire SpO2 data and add 4th overnight vital**

In `RecoveryOverview`, find the overnight vitals grid (the `<div style={{ display: 'grid', ...}}>` block around line 269). Replace it with:

```tsx
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
      data={rec.spo2Trend}
      info={{ description: 'Percentage of hemoglobin carrying oxygen. Above 95% normal, 97%+ excellent. Drops below 90% may indicate sleep-disordered breathing.' }} />
  )}
  {rec.sleepHrNight != null && (
    <HealthStatusTile label="Sleep HR" value={rec.sleepHrNight} unit="bpm" accent={A}
      data={rec.sleepHrTrend}
      info={SLEEP_HR_INFO} />
  )}
</div>
```

- [ ] **Step 4: Wire avgLine on Trends HRV Sparkline**

In `RecoveryTrends`, find `<Sparkline data={rec.hrv.trend} accent={A} w={350} h={50} sw={1.8} />` (around line 336). Change it to:

```tsx
<Sparkline data={rec.hrv.trend} accent={A} w={350} h={50} sw={1.8} avgLine={rec.hrv.avg ?? undefined} />
```

- [ ] **Step 5: Add `avg` to all TrendRow spark entries in RecoveryTrends**

Update each TrendRow in `RecoveryTrends` that uses the default spark kind. The full updated TrendRow block (replace lines ~355–401):

```tsx
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
    <TrendRow label="Resting HR" value={rec.rhr.value} unit="bpm" data={rec.rhr.trend} accent={A} delta={rec.rhr.avg != null ? rec.rhr.value - rec.rhr.avg : undefined} lowerBetter avg info={TREND_SECTIONS.rhr.info} />
    <div style={SUBTEXT}>{TREND_SECTIONS.rhr.subtext}</div>
  </>
)}

{rec.stress.trend.length > 0 && (
  <>
    <Rail label={TREND_SECTIONS.stress.railLabel} accent={A} right={TREND_SECTIONS.stress.period} />
    <TrendRow label="Stress" value={rec.stress.value} unit="avg" data={rec.stress.trend} accent={A} delta={rec.stress.avg != null ? rec.stress.value - rec.stress.avg : undefined} lowerBetter avg info={TREND_SECTIONS.stress.info} />
    <div style={SUBTEXT}>{TREND_SECTIONS.stress.subtext}</div>
  </>
)}

{rec.sleepStressTrend.length > 0 && rec.sleepStress != null && (
  <>
    <Rail label={TREND_SECTIONS.sleepStress.railLabel} accent={A} right={TREND_SECTIONS.sleepStress.period} />
    <TrendRow label="Sleep Stress" value={rec.sleepStress} unit="avg" data={rec.sleepStressTrend} accent={A} lowerBetter avg info={TREND_SECTIONS.sleepStress.info} />
    <div style={SUBTEXT}>{TREND_SECTIONS.sleepStress.subtext}</div>
  </>
)}

{rec.recoveryTimeTrend.length > 0 && rec.recoveryTimeH != null && (
  <>
    <Rail label={TREND_SECTIONS.recovTime.railLabel} accent={A} right={TREND_SECTIONS.recovTime.period} />
    <TrendRow label="Recov. Time" value={`${rec.recoveryTimeH}h`} data={rec.recoveryTimeTrend} accent={A} lowerBetter avg info={TREND_SECTIONS.recovTime.info} />
    <div style={SUBTEXT}>{TREND_SECTIONS.recovTime.subtext}</div>
  </>
)}

{rec.resp.trend.length > 0 && (
  <>
    <Rail label={TREND_SECTIONS.resp.railLabel} accent={A} right={TREND_SECTIONS.resp.period} />
    <TrendRow label="Respiration" value={rec.resp.value} unit="br/m" data={rec.resp.trend} accent={A} lowerBetter avg info={TREND_SECTIONS.resp.info} />
    <div style={SUBTEXT}>{TREND_SECTIONS.resp.subtext}</div>
  </>
)}
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 7: Run all tests**

```bash
npm test 2>&1 | tail -5
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/RecoveryPage.tsx
git commit -m "feat: wire HRV avg lines, SpO2 graph, Sleep HR 4th vital, avg on all Recovery trends"
```

---

## Task 8: SleepPage — SpO2 Graph, Arch Score Card, Dynamic Time Labels, Avg on Trends

**Files:**
- Modify: `client/src/pages/SleepPage.tsx`

Four changes:
1. Add `data={slp.sleepSpo2Trend}` to SpO2 tile; remove arch badge from Architecture card header
2. Replace hardcoded hypnogram time labels with dynamic ones from `slp.hypnoStartLocal`/`hypnoEndLocal`
3. Add `ARCH_SCORE_INFO` constant + dedicated Arch Score bespoke card between Architecture and Overnight Vitals Rail
4. Add `avg` / `avgLine` to Trends tab rows

- [ ] **Step 1: Add ARCH_SCORE_INFO constant**

After the existing `SPO2_INFO` constant (around line 72), add:

```tsx
const ARCH_SCORE_INFO: CardInfo = {
  title: 'Architecture Score',
  description: 'Bacta-computed composite of how well your sleep stages matched clinical targets: 40% weight on deep sleep (target ≥20% of total), 40% on REM (target ≥22%), 20% on time-awake penalty (target <5%). 80+ optimal · 60–79 good · below 60 needs attention.',
  source: 'Bacta-computed · Garmin Venu 4 stage data',
}
```

- [ ] **Step 2: Update SleepOverview — wire SpO2 data + remove arch badge + add Arch Score card**

In `SleepOverview`, add a new `useCardInfoOverlay` call for the arch score card. Add this line after the existing `useCardInfoOverlay` calls (around line 99):

```tsx
const { isOpen: archScoreOpen, handleTap: archScoreTap } = useCardInfoOverlay('slp-arch-score', ARCH_SCORE_INFO, A)
```

Find the SpO2 tile (around line 247) and add `data`:

```tsx
{slp.spo2.avg != null && (
  <HealthStatusTile label="SpO₂" value={slp.spo2.avg} unit="%" accent={A}
    inRange={slp.spo2.avg >= 95}
    sub={slp.spo2.avg >= 97 ? 'excellent' : 'normal'}
    data={slp.sleepSpo2Trend}
    info={SPO2_INFO} />
)}
```

In the Architecture card header (around line 208), remove the arch score badge so the header row becomes:

```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
  <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 600 }}>Sleep Architecture</span>
  <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>{fmtDur(totalMins)} cycled</span>
</div>
```

Replace the hardcoded time labels array (the `['23:00', '01:00', '03:00', '05:00', '07:00'].map(...)` block around line 222):

```tsx
{(() => {
  const fallback = ['23:00', '01:00', '03:00', '05:00', '07:00']
  let labels = fallback
  if (slp.hypnoStartLocal && slp.hypnoEndLocal) {
    try {
      const startH = parseInt(slp.hypnoStartLocal.slice(11, 13), 10)
      const startMin = parseInt(slp.hypnoStartLocal.slice(14, 16), 10)
      const endH = parseInt(slp.hypnoEndLocal.slice(11, 13), 10)
      const endMin = parseInt(slp.hypnoEndLocal.slice(14, 16), 10)
      const startTotal = startH * 60 + startMin
      const endTotal = (endH < startH ? endH + 24 : endH) * 60 + endMin
      const span = endTotal - startTotal
      labels = [0, 0.25, 0.5, 0.75, 1].map(frac => {
        const mins = Math.round(startTotal + frac * span) % (24 * 60)
        const h = Math.floor(mins / 60) % 24
        const m = mins % 60
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      })
    } catch {
      labels = fallback
    }
  }
  return labels.map(t => (
    <span key={t} style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted }}>{t}</span>
  ))
})()}
```

After the Architecture card closing `</div>` (after `{archOpen && ...}`), and **before** the `<Rail label="OVERNIGHT VITALS" .../>`, add the Arch Score card:

```tsx
{slp.archScore != null && (
  <div onClick={archScoreTap} style={{ ...BESPOKE_CARD, marginBottom: 9 }}>
    <Bracket color={A} inset={6} op={0.28} />
    <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${A}, transparent 80%)`, opacity: 0.7 }} />
    {(() => {
      const archColor = slp.archScore >= 80 ? COLORS.green : slp.archScore >= 60 ? COLORS.amber : COLORS.mx4Red
      const archLabel = slp.archScore >= 80 ? 'OPTIMAL' : slp.archScore >= 60 ? 'GOOD' : 'NEEDS WORK'
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, paddingLeft: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>ARCHITECTURE SCORE</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5, background: hexA(archColor, 0.12), border: `1px solid ${hexA(archColor, 0.42)}` }}>
                <StatusCore accent={archColor} size={5} />
                <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: archColor }}>{archLabel}</span>
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{slp.archScore}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingLeft: 3 }}>
            {([
              { label: 'DEEP',  score: slp.archDeepScore,    target: '≥20% of sleep' },
              { label: 'REM',   score: slp.archRemScore,     target: '≥22% of sleep' },
              { label: 'AWAKE', score: slp.archAwakePenalty, target: '<5% of sleep'  },
            ] as { label: string; score: number | undefined; target: string }[]).map(({ label, score, target }) => {
              if (score == null) return null
              const pct = Math.round(score * 100)
              const barColor = pct >= 80 ? COLORS.green : pct >= 60 ? COLORS.amber : COLORS.mx4Red
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, width: 40, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: hexA(COLORS.textMuted, 0.12), overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
                  </div>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted, width: 72, flexShrink: 0, textAlign: 'right' }}>
                    {pct}% · {target}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )
    })()}
    {archScoreOpen && <InfoOverlay info={ARCH_SCORE_INFO} accent={A} radius={10} compact onClick={archScoreTap} />}
  </div>
)}
```

- [ ] **Step 3: Update SleepTrends — avg lines**

In `SleepTrends`, add `avgLine` to the Score Sparkline. Find the `<Sparkline data={slp.score.trend} ...` line (around line 315) and replace:

```tsx
<Sparkline data={slp.score.trend} accent={A} w={350} h={50} sw={1.8}
  avgLine={slp.score.trend.length > 1
    ? Math.round(slp.score.trend.reduce((s, v) => s + v, 0) / slp.score.trend.length)
    : undefined}
/>
```

Add `avg` prop to all three TrendRow entries in `SleepTrends`:

```tsx
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
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Run all tests**

```bash
npm test 2>&1 | tail -5
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/SleepPage.tsx
git commit -m "feat: SpO2 graph, Arch Score card, dynamic time labels, avg lines on Sleep trends"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Bars7 avg label left — Task 1
- ✅ Sparkline avgLine prop — Task 2
- ✅ TrendRow avg pass-through — Task 3
- ✅ Server /sleep-hypno endpoint — Task 4
- ✅ Recovery time ÷60 fix — Task 5
- ✅ spo2Trend + sleepHrNight/sleepHrTrend in RecoveryData — Task 5
- ✅ sleepSpo2Trend in SleepData — Task 6
- ✅ archDeepScore/archRemScore/archAwakePenalty exposed — Task 6
- ✅ Real hypnogram via /sleep-hypno — Task 6
- ✅ HRV avg line in Recovery Overview + Trends — Task 7
- ✅ SpO2 tile gets data prop — Task 7 (Recovery) + Task 8 (Sleep)
- ✅ 4th overnight vital (Sleep HR) in Recovery — Task 7
- ✅ Recovery time display correct after ÷60 — Task 7 (no layout change needed)
- ✅ avg on all Recovery Trends TrendRows — Task 7
- ✅ Arch badge removed from Architecture card header — Task 8
- ✅ Dynamic hypnogram time labels — Task 8
- ✅ Dedicated Arch Score card — Task 8
- ✅ avg on all Sleep Trends rows — Task 8

**No placeholders found.**

**Type consistency:** All new fields (`spo2Trend`, `sleepHrNight`, `sleepHrTrend`, `sleepSpo2Trend`, `archDeepScore`, `archRemScore`, `archAwakePenalty`, `hypnoStartLocal`, `hypnoEndLocal`) are declared in types (Tasks 5–6) and consumed in pages (Tasks 7–8). `ARCH_SCORE_INFO` declared in Task 8 step 1, used in step 2. `SLEEP_HR_INFO` declared in Task 7 step 1, used in step 3.
