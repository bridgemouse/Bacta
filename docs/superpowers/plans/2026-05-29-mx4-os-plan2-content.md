# MX-4 OS — Plan 2: Content Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old MX4Card / MetricTile placeholders with the final MX-4 OS content components — TransmissionPanel, SystemCard, a complete HomePage body, a shared SectionShell for all six section pages, and update integration tests.

**Architecture:** Each replaced component lives in the same file path so imports stay stable. TransmissionPanel and SystemCard are purely presentational — no router, no fetch. SectionShell is a standalone content component; AppShell wraps it (as before). HomePage hardcodes mock TILES data and wires SystemCard clicks to the router.

**Tech Stack:** React 19, TypeScript, inline styles, React Router v7 (`useNavigate`), Vitest + Testing Library (`npx vitest run --config vitest.client.config.ts`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `client/src/components/MX4Card.tsx` | Rewrite | TransmissionPanel — MX-4 briefing card with mood sigil, assessment text, chip row |
| `client/src/components/MetricTile.tsx` | Rewrite | SystemCard — 2-col grid tile with section sigil, value/unit, viz (spark/ring/dots/shield) |
| `client/src/pages/HomePage.tsx` | Rewrite | TransmissionPanel + SYSTEMS rail + 2-col SystemCard grid |
| `client/src/components/SectionShell.tsx` | Create | Shared section placeholder: channel transmission + rail + shimmer cards + footer |
| `client/src/pages/RecoveryPage.tsx` | Rewrite | Thin wrapper: `<AppShell section="recovery"><SectionShell section="recovery" /></AppShell>` |
| `client/src/pages/TrainingPage.tsx` | Rewrite | Same pattern |
| `client/src/pages/SleepPage.tsx` | Rewrite | Same pattern |
| `client/src/pages/NutritionPage.tsx` | Rewrite | Same pattern |
| `client/src/pages/BloodWorkPage.tsx` | Rewrite | Same pattern |
| `client/src/pages/DailyLogPage.tsx` | Rewrite | Same pattern |
| `tests/client/components/MX4Card.test.tsx` | Rewrite | Tests for TransmissionPanel |
| `tests/client/components/MetricTile.test.tsx` | Rewrite | Tests for SystemCard |
| `tests/client/components/SectionShell.test.tsx` | Create | Tests for SectionShell |
| `tests/client/App.test.tsx` | Update | Add assertions for shell content on section routes |

---

## Task 1: TransmissionPanel

Rewrite `client/src/components/MX4Card.tsx` as `TransmissionPanel`. The old `MX4Card` API is gone; the export name stays `MX4Card` temporarily would break — rename the named export to `TransmissionPanel`. Also rewrite the test file.

**Files:**
- Rewrite: `client/src/components/MX4Card.tsx`
- Rewrite: `tests/client/components/MX4Card.test.tsx`

- [ ] **Step 1: Rewrite the test file first (TDD)**

Replace the entire contents of `tests/client/components/MX4Card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { TransmissionPanel } from '../../../client/src/components/MX4Card'

describe('TransmissionPanel', () => {
  it('renders the assessment text', () => {
    render(
      <TransmissionPanel
        accent="#2bc4e8"
        assessment="Recovery is solid and trending up."
      />
    )
    expect(screen.getByText(/Recovery is solid and trending up/)).toBeInTheDocument()
  })

  it('renders the default label', () => {
    render(
      <TransmissionPanel
        accent="#2bc4e8"
        assessment="Standing by."
      />
    )
    expect(screen.getByText('INCOMING // MX-4')).toBeInTheDocument()
  })

  it('renders a custom label', () => {
    render(
      <TransmissionPanel
        accent="#7c9af8"
        label="MX-4 // RECOVERY"
        assessment="Recovery channel standing by."
      />
    )
    expect(screen.getByText('MX-4 // RECOVERY')).toBeInTheDocument()
  })

  it('renders default chip keys', () => {
    render(
      <TransmissionPanel
        accent="#2bc4e8"
        assessment="Standing by."
      />
    )
    expect(screen.getByText('TONE')).toBeInTheDocument()
    expect(screen.getByText('FLAGS')).toBeInTheDocument()
    expect(screen.getByText('SYNC')).toBeInTheDocument()
  })

  it('renders custom chips', () => {
    render(
      <TransmissionPanel
        accent="#7c9af8"
        assessment="Recovery channel standing by."
        chips={[['CH', 'RECOVERY'], ['DATA', 'PENDING']]}
      />
    )
    expect(screen.getByText('CH')).toBeInTheDocument()
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
    expect(screen.getByText('DATA')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('renders meta text when provided', () => {
    render(
      <TransmissionPanel
        accent="#2bc4e8"
        assessment="Standing by."
        meta="MON · MAY 29 · 06:00"
      />
    )
    expect(screen.getByText('MON · MAY 29 · 06:00')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run --config vitest.client.config.ts tests/client/components/MX4Card.test.tsx
```

Expected: FAIL — `TransmissionPanel` not exported from `MX4Card`

- [ ] **Step 3: Rewrite `client/src/components/MX4Card.tsx`**

Replace the entire file:

```tsx
import { MX4Sigil } from './primitives/MX4Sigil'
import type { MX4Mood } from './primitives/MX4Sigil'
import { FTelemetry } from './primitives/FTelemetry'
import { hexA } from '../lib/hexA'
import { COLORS, FONT_MONO, FONT_UI } from '../theme'

interface TransmissionPanelProps {
  accent: string
  mood?: MX4Mood
  label?: string
  meta?: string
  assessment: string
  chips?: [string, string][]
}

const DEFAULT_CHIPS: [string, string][] = [
  ['TONE', 'POSITIVE'],
  ['FLAGS', '0'],
  ['SYNC', 'OK'],
]

export function TransmissionPanel({
  accent,
  mood = 'transmit',
  label = 'INCOMING // MX-4',
  meta,
  assessment,
  chips = DEFAULT_CHIPS,
}: TransmissionPanelProps) {
  return (
    <div
      style={{
        position: 'relative',
        background: `linear-gradient(160deg, ${hexA(accent, 0.10)}, ${COLORS.surface} 50%)`,
        border: `1px solid ${hexA(accent, 0.35)}`,
        borderRadius: 14,
        boxShadow: `0 0 32px ${hexA(accent, 0.08)}`,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px 11px' }}>
        <MX4Sigil color={accent} size={19} spin mood={mood} />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: accent,
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </span>
        {meta && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 8.5,
              letterSpacing: '0.08em',
              color: COLORS.textMuted,
              flexShrink: 0,
            }}
          >
            {meta}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '0 15px 13px' }}>
        <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 16.5, lineHeight: 1.5, color: '#eef4fb' }}>
          {assessment}
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 7,
              height: '0.9em',
              background: accent,
              marginLeft: 3,
              verticalAlign: 'middle',
              animation: 'mx4blink 1.1s step-end infinite',
            }}
          />
        </p>
      </div>

      {/* Footer chip row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 15px 13px',
          borderTop: `1px solid ${hexA(accent, 0.18)}`,
        }}
      >
        {chips.map(([key, val]) => (
          <span key={key} style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
            {key}{' '}
            <span style={{ color: accent }}>{val}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          <FTelemetry color={accent} bars={4} />
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run --config vitest.client.config.ts tests/client/components/MX4Card.test.tsx
```

Expected: 6 tests PASS

- [ ] **Step 5: Run all tests to check for regressions**

```bash
npx vitest run --config vitest.client.config.ts
```

Expected: Some tests may fail — `MX4Card` import (old API) is used in `HomePage.tsx`, `RecoveryPage.tsx` etc. That's OK; those files will be updated in later tasks. If failures are ONLY about missing `MX4Card` / `MX4Insight` imports in pages, that's expected. Check that no primitive component tests broke.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/MX4Card.tsx tests/client/components/MX4Card.test.tsx
git commit -m "feat: replace MX4Card with TransmissionPanel"
```

---

## Task 2: SystemCard

Rewrite `client/src/components/MetricTile.tsx` as `SystemCard`. The new component accepts a typed tile object and renders the full MX-4 OS card including sigil, bracketed corners, top accent edge, and the correct viz primitive.

**Files:**
- Rewrite: `client/src/components/MetricTile.tsx`
- Rewrite: `tests/client/components/MetricTile.test.tsx`

- [ ] **Step 1: Rewrite the test file (TDD)**

Replace the entire contents of `tests/client/components/MetricTile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SystemCard } from '../../../client/src/components/MetricTile'
import type { SystemCardTile } from '../../../client/src/components/MetricTile'

const sparkTile: SystemCardTile = {
  key: 'recovery',
  value: '74',
  unit: 'battery',
  sub: 'HRV ↑ 61ms',
  viz: 'spark',
  spark: [50, 54, 49, 57, 55, 60, 66, 74],
  status: 'Good',
}

const ringTile: SystemCardTile = {
  key: 'sleep',
  value: '8.1',
  unit: 'h',
  sub: 'Score 82',
  viz: 'ring',
  ring: 0.82,
  status: 'Solid',
}

const dotsTile: SystemCardTile = {
  key: 'dailylog',
  value: '4',
  unit: '/ 5',
  sub: 'Logged today',
  viz: 'dots',
  dots: 4,
  status: 'Logged',
}

const shieldTile: SystemCardTile = {
  key: 'bloodwork',
  value: 'Clear',
  unit: '',
  sub: 'No flags · 0 panels',
  viz: 'shield',
  status: 'Nominal',
}

describe('SystemCard', () => {
  it('renders section label in uppercase', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
  })

  it('renders value', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('74')).toBeInTheDocument()
  })

  it('renders unit', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('battery')).toBeInTheDocument()
  })

  it('renders sub text', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('HRV ↑ 61ms')).toBeInTheDocument()
  })

  it('renders zero-padded two-digit index', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('01')).toBeInTheDocument()
  })

  it('renders index 6 as 06', () => {
    render(<SystemCard tile={shieldTile} index={6} />)
    expect(screen.getByText('06')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<SystemCard tile={sparkTile} index={1} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders shield viz with status text for bloodwork', () => {
    render(<SystemCard tile={shieldTile} index={4} />)
    expect(screen.getByText('Nominal')).toBeInTheDocument()
  })

  it('renders sleep label for ring tile', () => {
    render(<SystemCard tile={ringTile} index={3} />)
    expect(screen.getByText('SLEEP')).toBeInTheDocument()
  })

  it('renders dailylog label for dots tile', () => {
    render(<SystemCard tile={dotsTile} index={6} />)
    expect(screen.getByText('DAILY LOG')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run --config vitest.client.config.ts tests/client/components/MetricTile.test.tsx
```

Expected: FAIL — `SystemCard` and `SystemCardTile` not exported from `MetricTile`

- [ ] **Step 3: Rewrite `client/src/components/MetricTile.tsx`**

Replace the entire file:

```tsx
import { Bracket } from './primitives/Bracket'
import { Sigil } from './primitives/Sigil'
import { Sparkline } from './primitives/Sparkline'
import { Ring } from './primitives/Ring'
import { ReadinessDots } from './primitives/ReadinessDots'
import { hexA } from '../lib/hexA'
import { COLORS, FONT_MONO, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'

export type VizType = 'spark' | 'ring' | 'dots' | 'shield'

export interface SystemCardTile {
  key: Exclude<SectionKey, 'home'>
  value: string
  unit: string
  sub: string
  viz: VizType
  spark?: number[]
  ring?: number
  dots?: number
  status: string
}

interface SystemCardProps {
  tile: SystemCardTile
  index: number
  onClick?: () => void
}

export function SystemCard({ tile, index, onClick }: SystemCardProps) {
  const accent = SECTION_ACCENTS[tile.key]
  const label = SECTION_LABELS[tile.key].toUpperCase()
  const idx = String(index).padStart(2, '0')
  const hasRing = tile.viz === 'ring' && tile.ring !== undefined

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        textAlign: 'left',
        font: 'inherit',
        color: COLORS.text,
        cursor: 'pointer',
        background: COLORS.surface,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 7,
        padding: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        width: '100%',
      }}
    >
      {/* Top accent edge */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent 80%)`,
        }}
      />

      {/* Corner bracket decoration */}
      <Bracket color={accent} inset={5} op={0.4} radius={3} size={9} />

      {/* Ring positioned at top-right for ring viz */}
      {hasRing && (
        <span style={{ position: 'absolute', top: 10, right: 10 }}>
          <Ring progress={tile.ring!} accent={accent} size={38} stroke={3} />
        </span>
      )}

      {/* Header: sigil chip + label + index */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          paddingRight: hasRing ? 44 : 0,
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: hexA(accent, 0.13),
            border: `1px solid ${hexA(accent, 0.28)}`,
          }}
        >
          <Sigil name={tile.key} color={accent} size={14} />
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.14em',
            color: accent,
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
          {idx}
        </span>
      </div>

      {/* Value + sub */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 22,
              fontWeight: 700,
              color: COLORS.text,
              lineHeight: 1,
            }}
          >
            {tile.value}
          </span>
          {tile.unit && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textMuted }}>
              {tile.unit}
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: COLORS.textSecondary,
            marginTop: 3,
          }}
        >
          {tile.sub}
        </div>
      </div>

      {/* Viz */}
      {tile.viz === 'spark' && tile.spark && (
        <Sparkline data={tile.spark} accent={accent} w={140} h={24} sw={1.6} />
      )}
      {tile.viz === 'dots' && tile.dots !== undefined && (
        <ReadinessDots value={tile.dots} accent={accent} />
      )}
      {tile.viz === 'shield' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.1em',
              color: accent,
            }}
          >
            {tile.status}
          </span>
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run --config vitest.client.config.ts tests/client/components/MetricTile.test.tsx
```

Expected: 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/MetricTile.tsx tests/client/components/MetricTile.test.tsx
git commit -m "feat: replace MetricTile with SystemCard"
```

---

## Task 3: HomePage

Rewrite `client/src/pages/HomePage.tsx` to use TransmissionPanel + SYSTEMS rail + 2-col SystemCard grid with mock TILES data. No new test file — the App.test.tsx integration test covers this route (updated in Task 6).

**Files:**
- Rewrite: `client/src/pages/HomePage.tsx`

- [ ] **Step 1: Rewrite `client/src/pages/HomePage.tsx`**

Replace the entire file:

```tsx
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { TransmissionPanel } from '../components/MX4Card'
import { SystemCard } from '../components/MetricTile'
import type { SystemCardTile } from '../components/MetricTile'
import { COLORS, MX4_COLOR, FONT_MONO } from '../theme'

const ASSESSMENT =
  'Recovery is solid and trending up. Training load is on track for week four. Nutrition is close — protein is the only gap worth closing tonight.'

const TILES: SystemCardTile[] = [
  {
    key: 'recovery',
    value: '74',
    unit: 'battery',
    sub: 'HRV ↑ 61ms',
    viz: 'spark',
    spark: [50, 54, 49, 57, 55, 60, 66, 74],
    status: 'Good',
  },
  {
    key: 'training',
    value: '342',
    unit: 'load',
    sub: 'Moderate · wk 4 / 8',
    viz: 'spark',
    spark: [280, 300, 260, 320, 340, 310, 330, 342],
    status: 'On track',
  },
  {
    key: 'sleep',
    value: '8.1',
    unit: 'h',
    sub: 'Score 82',
    viz: 'ring',
    ring: 0.82,
    status: 'Solid',
  },
  {
    key: 'nutrition',
    value: '2,340',
    unit: 'kcal',
    sub: 'Protein 142 / 160g',
    viz: 'ring',
    ring: 0.94,
    status: 'On target',
  },
  {
    key: 'bloodwork',
    value: 'Clear',
    unit: '',
    sub: 'No flags · 0 panels',
    viz: 'shield',
    status: 'Nominal',
  },
  {
    key: 'dailylog',
    value: '4',
    unit: '/ 5',
    sub: 'Logged today',
    viz: 'dots',
    dots: 4,
    status: 'Logged',
  },
]

export function HomePage() {
  const navigate = useNavigate()

  return (
    <AppShell section="home">
      <TransmissionPanel
        accent={MX4_COLOR}
        mood="transmit"
        label="INCOMING // MX-4"
        assessment={ASSESSMENT}
      />

      {/* SYSTEMS rail */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 11,
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: MX4_COLOR,
          }}
        >
          SYSTEMS
        </span>
        <span
          style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, ${MX4_COLOR}44, transparent)`,
          }}
        />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.1em',
            color: COLORS.textMuted,
          }}
        >
          6 ONLINE
        </span>
      </div>

      {/* SystemCard grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {TILES.map((tile, i) => (
          <SystemCard
            key={tile.key}
            tile={tile}
            index={i + 1}
            onClick={() => navigate(`/${tile.key}`)}
          />
        ))}
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Run all tests to check for regressions**

```bash
npx vitest run --config vitest.client.config.ts
```

Expected: All tests pass. The only previously-failing tests (from Task 1 regression) should now be resolved since RecoveryPage still imports MX4Card — but RecoveryPage currently imports the old `MX4Card` component (which no longer exists). That import will fail. If tests using RecoveryPage fail because `MX4Card`/`MX4Insight` is no longer exported, note it — those pages will be fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/HomePage.tsx
git commit -m "feat: implement HomePage with TransmissionPanel + SystemCard grid"
```

---

## Task 4: SectionShell

Create the shared placeholder shell rendered by all 6 section pages while their backends are pending. Purely presentational — no router dependency.

**Files:**
- Create: `client/src/components/SectionShell.tsx`
- Create: `tests/client/components/SectionShell.test.tsx`

- [ ] **Step 1: Write the test file (TDD)**

Create `tests/client/components/SectionShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { SectionShell } from '../../../client/src/components/SectionShell'

describe('SectionShell', () => {
  it('renders recovery channel greeting', () => {
    render(<SectionShell section="recovery" />)
    expect(screen.getByText(/Recovery channel online/)).toBeInTheDocument()
  })

  it('renders the calibrating footer', () => {
    render(<SectionShell section="recovery" />)
    expect(screen.getByText(/MX-4 IS CALIBRATING THIS SYSTEM/)).toBeInTheDocument()
  })

  it('renders sleep channel greeting', () => {
    render(<SectionShell section="sleep" />)
    expect(screen.getByText(/Sleep channel online/)).toBeInTheDocument()
  })

  it('renders training channel greeting', () => {
    render(<SectionShell section="training" />)
    expect(screen.getByText(/Training channel online/)).toBeInTheDocument()
  })

  it('renders nutrition channel greeting', () => {
    render(<SectionShell section="nutrition" />)
    expect(screen.getByText(/Nutrition channel online/)).toBeInTheDocument()
  })

  it('renders bloodwork channel greeting', () => {
    render(<SectionShell section="bloodwork" />)
    expect(screen.getByText(/Blood Work channel online/)).toBeInTheDocument()
  })

  it('renders dailylog channel greeting', () => {
    render(<SectionShell section="dailylog" />)
    expect(screen.getByText(/Daily Log channel online/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run --config vitest.client.config.ts tests/client/components/SectionShell.test.tsx
```

Expected: FAIL — module `SectionShell` not found

- [ ] **Step 3: Create `client/src/components/SectionShell.tsx`**

```tsx
import { MX4Sigil } from './primitives/MX4Sigil'
import { TransmissionPanel } from './MX4Card'
import { hexA } from '../lib/hexA'
import { COLORS, FONT_MONO, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'

type NonHomeSectionKey = Exclude<SectionKey, 'home'>

interface SectionShellProps {
  section: NonHomeSectionKey
}

const GREETINGS: Record<NonHomeSectionKey, string> = {
  recovery:  'Recovery channel online. Battery and HRV trends will surface here once the system is wired in.',
  training:  'Training channel online. Load, blocks, and session protocols will populate here.',
  sleep:     'Sleep channel online. Stages, score, and debt readouts will live here.',
  nutrition: 'Nutrition channel online. Intake, macros, and targets will surface here.',
  bloodwork: 'Blood Work channel online. Panels, biomarkers, and flags will populate here.',
  dailylog:  'Daily Log channel online. Your entries and check-ins will live here.',
}

export function SectionShell({ section }: SectionShellProps) {
  const accent = SECTION_ACCENTS[section]
  const label = SECTION_LABELS[section]

  return (
    <>
      <TransmissionPanel
        accent={accent}
        mood="idle"
        label={`MX-4 // ${label.toUpperCase()}`}
        meta="STANDBY"
        assessment={GREETINGS[section]}
        chips={[
          ['CH', label.toUpperCase()],
          ['DATA', 'PENDING'],
        ]}
      />

      {/* Channel rail */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: accent,
          }}
        >
          {label.toUpperCase()}
        </span>
        <span
          style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, ${accent}44, transparent)`,
          }}
        />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.1em',
            color: COLORS.textMuted,
          }}
        >
          CALIBRATING
        </span>
      </div>

      {/* Shimmer skeleton cards */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: hexA(accent, 0.04),
            border: `1px solid ${hexA(accent, 0.12)}`,
            borderRadius: 10,
            padding: '14px 14px',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              height: 10,
              borderRadius: 5,
              marginBottom: 10,
              width: '55%',
              background: `linear-gradient(90deg, ${hexA(accent, 0.06)} 25%, ${hexA(accent, 0.16)} 50%, ${hexA(accent, 0.06)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'mx4shimmer 1.6s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: 22,
              borderRadius: 5,
              marginBottom: 8,
              width: '35%',
              background: `linear-gradient(90deg, ${hexA(accent, 0.06)} 25%, ${hexA(accent, 0.16)} 50%, ${hexA(accent, 0.06)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'mx4shimmer 1.6s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
          <div
            style={{
              height: 8,
              borderRadius: 5,
              width: '70%',
              background: `linear-gradient(90deg, ${hexA(accent, 0.06)} 25%, ${hexA(accent, 0.16)} 50%, ${hexA(accent, 0.06)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'mx4shimmer 1.6s ease-in-out infinite',
              animationDelay: `${i * 0.24}s`,
            }}
          />
        </div>
      ))}

      {/* Calibrating footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 0 4px',
        }}
      >
        <MX4Sigil color={accent} size={15} mood="think" spin />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.12em',
            color: COLORS.textMuted,
          }}
        >
          MX-4 IS CALIBRATING THIS SYSTEM
        </span>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run --config vitest.client.config.ts tests/client/components/SectionShell.test.tsx
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/SectionShell.tsx tests/client/components/SectionShell.test.tsx
git commit -m "feat: add SectionShell placeholder for section pages"
```

---

## Task 5: Section Pages

Rewrite all 6 section pages as thin wrappers: `<AppShell section="..."><SectionShell section="..." /></AppShell>`. This also fixes the compilation errors from Task 1 (old MX4Card/MX4Insight imports).

**Files:**
- Rewrite: `client/src/pages/RecoveryPage.tsx`
- Rewrite: `client/src/pages/TrainingPage.tsx`
- Rewrite: `client/src/pages/SleepPage.tsx`
- Rewrite: `client/src/pages/NutritionPage.tsx`
- Rewrite: `client/src/pages/BloodWorkPage.tsx`
- Rewrite: `client/src/pages/DailyLogPage.tsx`

- [ ] **Step 1: Rewrite `client/src/pages/RecoveryPage.tsx`**

```tsx
import { AppShell } from '../components/AppShell'
import { SectionShell } from '../components/SectionShell'

export function RecoveryPage() {
  return (
    <AppShell section="recovery">
      <SectionShell section="recovery" />
    </AppShell>
  )
}
```

- [ ] **Step 2: Rewrite `client/src/pages/TrainingPage.tsx`**

```tsx
import { AppShell } from '../components/AppShell'
import { SectionShell } from '../components/SectionShell'

export function TrainingPage() {
  return (
    <AppShell section="training">
      <SectionShell section="training" />
    </AppShell>
  )
}
```

- [ ] **Step 3: Rewrite `client/src/pages/SleepPage.tsx`**

```tsx
import { AppShell } from '../components/AppShell'
import { SectionShell } from '../components/SectionShell'

export function SleepPage() {
  return (
    <AppShell section="sleep">
      <SectionShell section="sleep" />
    </AppShell>
  )
}
```

- [ ] **Step 4: Rewrite `client/src/pages/NutritionPage.tsx`**

```tsx
import { AppShell } from '../components/AppShell'
import { SectionShell } from '../components/SectionShell'

export function NutritionPage() {
  return (
    <AppShell section="nutrition">
      <SectionShell section="nutrition" />
    </AppShell>
  )
}
```

- [ ] **Step 5: Rewrite `client/src/pages/BloodWorkPage.tsx`**

```tsx
import { AppShell } from '../components/AppShell'
import { SectionShell } from '../components/SectionShell'

export function BloodWorkPage() {
  return (
    <AppShell section="bloodwork">
      <SectionShell section="bloodwork" />
    </AppShell>
  )
}
```

- [ ] **Step 6: Rewrite `client/src/pages/DailyLogPage.tsx`**

```tsx
import { AppShell } from '../components/AppShell'
import { SectionShell } from '../components/SectionShell'

export function DailyLogPage() {
  return (
    <AppShell section="dailylog">
      <SectionShell section="dailylog" />
    </AppShell>
  )
}
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run --config vitest.client.config.ts
```

Expected: All tests pass (the old MX4Card/MetricTile imports are gone from all pages).

- [ ] **Step 8: Type-check**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/RecoveryPage.tsx client/src/pages/TrainingPage.tsx client/src/pages/SleepPage.tsx client/src/pages/NutritionPage.tsx client/src/pages/BloodWorkPage.tsx client/src/pages/DailyLogPage.tsx
git commit -m "feat: convert section pages to SectionShell wrappers"
```

---

## Task 6: App Integration Tests

Update `tests/client/App.test.tsx` to add assertions verifying that the new SectionShell content appears on section routes.

**Files:**
- Update: `tests/client/App.test.tsx`

- [ ] **Step 1: Update `tests/client/App.test.tsx`**

The existing tests should still pass. Add two new tests for section shell content. Replace the file contents:

```tsx
// tests/client/App.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../client/src/App'

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
})

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  )
}

describe('App', () => {
  test('renders home page with BACTA header on /', () => {
    renderApp('/')
    expect(screen.getByText('BACTA')).toBeInTheDocument()
  })

  test('renders nav button on home page', () => {
    renderApp('/')
    expect(screen.getByTestId('nav-button')).toBeInTheDocument()
  })

  test('opens nav sheet when nav button is clicked', async () => {
    renderApp('/')
    const navBtn = screen.getByTestId('nav-button')
    await userEvent.click(navBtn)
    expect(screen.getByText('ALL SYSTEMS')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
  })

  test('renders recovery page on /recovery route', () => {
    renderApp('/recovery')
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
  })

  test('renders recovery shell content on /recovery route', () => {
    renderApp('/recovery')
    expect(screen.getByText(/Recovery channel online/)).toBeInTheDocument()
  })

  test('renders sleep page on /sleep route', () => {
    renderApp('/sleep')
    expect(screen.getByText('SLEEP')).toBeInTheDocument()
  })

  test('renders sleep shell content on /sleep route', () => {
    renderApp('/sleep')
    expect(screen.getByText(/Sleep channel online/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the updated test**

```bash
npx vitest run --config vitest.client.config.ts tests/client/App.test.tsx
```

Expected: 7 tests PASS

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run --config vitest.client.config.ts
```

Expected: All tests pass.

- [ ] **Step 4: Type-check**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add tests/client/App.test.tsx
git commit -m "test: add shell content assertions for section routes"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| TransmissionPanel — gradient bg, accent border, spinning sigil, assessment, chip row, FTelemetry | Task 1 |
| SystemCard — surface, radius 7, Bracket, top accent edge, sigil chip, label/index, value/unit/sub, spark/ring/dots/shield viz | Task 2 |
| TILES mock data (6 sections, exact values) | Task 3 |
| HomePage: TransmissionPanel + SYSTEMS rail + SystemCard grid + navigate on click | Task 3 |
| SectionShell — channel-colored TransmissionPanel, STANDBY meta, section greeting, CH/DATA chips, channel rail, shimmer skeletons, think-sigil footer | Task 4 |
| Section greetings — per-section copy | Task 4 |
| 6 section pages — thin AppShell + SectionShell wrappers | Task 5 |
| Integration tests for shell content | Task 6 |

**Placeholder scan:** No TBDs, TODOs, or "add validation" phrases. All code steps show complete implementations.

**Type consistency:**
- `TransmissionPanel` exported from `MX4Card.tsx` — used in `SectionShell.tsx` and `HomePage.tsx` ✓
- `SystemCard` and `SystemCardTile` exported from `MetricTile.tsx` — used in `HomePage.tsx` and test ✓
- `SectionShell` takes `Exclude<SectionKey, 'home'>` — pages pass `'recovery'` etc. ✓
- `MX4Mood` from `MX4Sigil.tsx` — `TransmissionPanel` re-exports via prop type ✓
- `SECTION_LABELS[tile.key]` in SystemCard — `tile.key` is `Exclude<SectionKey, 'home'>` which is a valid key ✓
- `Bracket` props: `color`, `inset`, `op`, `radius`, `size` — all match `Bracket.tsx` interface ✓
- `Sigil` props: `name` is `Exclude<SectionKey, 'home'>`, `color`, `size` — matches `Sigil.tsx` ✓
- `Ring` props: `progress`, `accent`, `size`, `stroke` — matches `Ring.tsx` ✓
- `Sparkline` props: `data`, `accent`, `w`, `h`, `sw` — matches `Sparkline.tsx` ✓
- `ReadinessDots` props: `value`, `accent` — matches `ReadinessDots.tsx` ✓
