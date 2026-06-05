# ZoneDistribution + LogEntry Expand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a vertical per-zone list with mini bars to the Training HR Zones card, and make activity log entries tappable with a chevron rotation animation.

**Architecture:** Two independent changes to `client/src/`. Task 1 creates a new `ZoneDistribution` viz component (TDD). Task 2 wires it into `TrainingPage.tsx`. Task 3 updates `LogEntry.tsx` to be an expand/collapse toggle (TDD). Task 4 does Playwright visual verification.

**Tech Stack:** React 19, TypeScript, inline styles only (no CSS files), Vitest + Testing Library, `hexA` util for alpha colors.

---

### Task 1: ZoneDistribution component (TDD)

**Files:**
- Create: `client/src/components/viz/ZoneDistribution.tsx`
- Create: `tests/client/components/viz/ZoneDistribution.test.tsx`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/client/components/viz/ZoneDistribution.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { ZoneDistribution } from '../../../../client/src/components/viz/ZoneDistribution'

const ZONES = [
  { zone: 1, label: 'Warm Up',   mins: 5.5, pct: 87, color: '#56657a' },
  { zone: 2, label: 'Easy',      mins: 0.8, pct: 13, color: '#4ade80' },
  { zone: 3, label: 'Aerobic',   mins: 0,   pct: 0,  color: '#fbbf24' },
  { zone: 4, label: 'Threshold', mins: 0,   pct: 0,  color: '#f87171' },
  { zone: 5, label: 'Maximum',   mins: 0,   pct: 0,  color: '#ef4444' },
]

describe('ZoneDistribution', () => {
  it('renders all 5 zone labels in the vertical list', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    expect(screen.getByText('Warm Up')).toBeInTheDocument()
    expect(screen.getByText('Easy')).toBeInTheDocument()
    expect(screen.getByText('Aerobic')).toBeInTheDocument()
    expect(screen.getByText('Threshold')).toBeInTheDocument()
    expect(screen.getByText('Maximum')).toBeInTheDocument()
  })

  it('shows time value for active zones', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    expect(screen.getByText('5.5m')).toBeInTheDocument()
    expect(screen.getByText('0.8m')).toBeInTheDocument()
  })

  it('shows — for inactive zones', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    const dashes = screen.getAllByText('—')
    expect(dashes).toHaveLength(3)
  })

  it('shows percentage only for active zones', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByText('13%')).toBeInTheDocument()
  })

  it('shows correct TOTAL in summary footer', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    // totalMins = Math.round(5.5 + 0.8) = 6
    expect(screen.getByText('6 min')).toBeInTheDocument()
  })

  it('shows correct Z2+ in summary footer', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    // z2plus = 0.8 + 0 + 0 + 0 = 0.8
    expect(screen.getByText('0.8 min')).toBeInTheDocument()
  })

  it('returns null when all zones have 0 mins', () => {
    const empty = ZONES.map(z => ({ ...z, mins: 0, pct: 0 }))
    const { container } = render(<ZoneDistribution zones={empty} accent="#fb923c" />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose ZoneDistribution 2>&1 | tail -20
```

Expected: `Cannot find module '../../../../client/src/components/viz/ZoneDistribution'`

- [ ] **Step 3: Implement ZoneDistribution**

Create `client/src/components/viz/ZoneDistribution.tsx`:

```tsx
import { useState } from 'react'
import { COLORS, FONT_MONO, FONT_UI } from '../../theme'
import { hexA } from '../../lib/hexA'

interface Zone {
  zone: number
  label: string
  mins: number
  pct: number
  color: string
}

interface ZoneDistributionProps {
  zones: Zone[]
  accent: string
}

export function ZoneDistribution({ zones, accent }: ZoneDistributionProps) {
  const totalMins = Math.round(zones.reduce((s, z) => s + z.mins, 0))
  const z2PlusMins = zones.filter(z => z.zone >= 2).reduce((s, z) => s + z.mins, 0).toFixed(1)

  if (totalMins === 0) return null

  return (
    <div>
      {/* Top stacked bar */}
      <div style={{
        display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden',
        gap: 2, marginBottom: 13,
      }}>
        {zones.filter(z => z.pct > 0).map(z => (
          <div key={z.zone} style={{
            width: `${z.pct}%`, background: z.color, borderRadius: 3, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {z.pct >= 13 && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, color: '#0b0d12' }}>
                Z{z.zone}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Vertical zone rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {zones.map(z => {
          const active = z.mins > 0
          return (
            <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2, background: z.color,
                flexShrink: 0, opacity: active ? 1 : 0.25,
              }} />
              <span style={{
                fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, minWidth: 16, flexShrink: 0,
              }}>
                Z{z.zone}
              </span>
              <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: COLORS.textSecondary, flex: 1, minWidth: 0 }}>
                {z.label}
              </span>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 10, fontWeight: active ? 700 : 400,
                color: active ? COLORS.text : COLORS.textMuted,
                minWidth: 34, textAlign: 'right', flexShrink: 0,
              }}>
                {active ? `${z.mins}m` : '—'}
              </span>
              <div style={{
                width: 48, height: 4, borderRadius: 2,
                background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0,
              }}>
                <div style={{
                  width: `${z.pct}%`, height: '100%', background: z.color, borderRadius: 2,
                  opacity: active ? 1 : 0.15,
                }} />
              </div>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted,
                minWidth: 26, textAlign: 'right', flexShrink: 0,
              }}>
                {active ? `${z.pct}%` : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Summary footer */}
      <div style={{ marginTop: 10, display: 'flex', gap: 14 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
          TOTAL{' '}
          <span style={{ color: COLORS.textSecondary, fontWeight: 600 }}>{totalMins} min</span>
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
          Z2+{' '}
          <span style={{ color: accent, fontWeight: 600 }}>{z2PlusMins} min</span>
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose ZoneDistribution 2>&1 | tail -20
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta && git add client/src/components/viz/ZoneDistribution.tsx tests/client/components/viz/ZoneDistribution.test.tsx
git commit -m "$(cat <<'EOF'
feat: add ZoneDistribution viz component with vertical zone rows

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire ZoneDistribution into TrainingPage

**Files:**
- Modify: `client/src/pages/TrainingPage.tsx` (lines 167–183 — inline stacked bar + flat legend block)

---

- [ ] **Step 1: Add import to TrainingPage.tsx**

In `client/src/pages/TrainingPage.tsx`, add to the imports block (alongside other viz imports):

```ts
import { ZoneDistribution } from '../components/viz/ZoneDistribution'
```

- [ ] **Step 2: Replace inline zone rendering with ZoneDistribution**

In `client/src/pages/TrainingPage.tsx`, find the block inside the HR zones card div that starts with:

```tsx
            <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
              {TRN.hrZones.map(z => (
                <div key={z.zone} style={{ width: `${z.pct}%`, background: z.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {z.pct >= 18 && <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: '#0b0d12' }}>{z.pct}%</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
              {TRN.hrZones.map(z => (
                <span key={z.zone} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: z.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>Z{z.zone}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary }}>{z.label}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.text, fontWeight: 600 }}>{z.mins}m</span>
                </span>
              ))}
            </div>
```

Replace it with:

```tsx
            <ZoneDistribution zones={TRN.hrZones} accent={A} />
```

- [ ] **Step 3: Run full client test suite to catch regressions**

```bash
cd /opt/bacta && npm run test:client 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 4: Type-check**

```bash
cd /opt/bacta && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta && git add client/src/pages/TrainingPage.tsx
git commit -m "$(cat <<'EOF'
feat: wire ZoneDistribution into Training HR Zones card

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: LogEntry expand mechanic (TDD)

**Files:**
- Modify: `client/src/components/viz/LogEntry.tsx`
- Create: `tests/client/components/viz/LogEntry.test.tsx`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/client/components/viz/LogEntry.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogEntry } from '../../../../client/src/components/viz/LogEntry'

const ACTIVITY = {
  activity_id: 1,
  date: '2026-06-05',
  start_time: '2026-06-05 07:30:00',
  name: 'Morning Run',
  type_key: 'running',
  distance_m: 7900,
  duration_s: 3540,
  calories: 627,
  avg_hr: 148,
  elevation_m: null,
}

describe('LogEntry', () => {
  it('renders activity label and stats', () => {
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.getByText(/7\.9 km/)).toBeInTheDocument()
  })

  it('renders the chevron character', () => {
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('›')).toBeInTheDocument()
  })

  it('chevron has no rotation by default', () => {
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    const chevron = screen.getByText('›')
    expect(chevron).toHaveStyle({ transform: 'none' })
  })

  it('chevron rotates 90deg when entry is clicked', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('›')).toHaveStyle({ transform: 'rotate(90deg)' })
  })

  it('chevron returns to no rotation on second click', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('›')).toHaveStyle({ transform: 'none' })
  })

  it('does not render expanded panel (no Phase C data)', async () => {
    const user = userEvent.setup()
    const { container } = render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    // no borderTop panel should appear — hasContent is false
    const panels = container.querySelectorAll('[style*="border-top"]')
    expect(panels).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose LogEntry 2>&1 | tail -20
```

Expected: Multiple failures — `getByRole('button')` finds nothing, chevron style tests fail.

- [ ] **Step 3: Update LogEntry.tsx**

Replace the entire contents of `client/src/components/viz/LogEntry.tsx` with:

```tsx
import { useState } from 'react'
import { COLORS, FONT_MONO, FONT_UI } from '../../theme'
import { hexA } from '../../lib/hexA'
import type { GarminActivity } from '../../lib/garminApi'

type Sigil = 'run' | 'strength' | 'walk' | 'cycle'

const TYPE_SIGIL: Record<string, Sigil> = {
  running: 'run', trail_running: 'run', treadmill_running: 'run',
  walking: 'walk', hiking: 'walk', indoor_walking: 'walk',
  cycling: 'cycle', road_biking: 'cycle', mountain_biking: 'cycle', indoor_cycling: 'cycle',
  strength_training: 'strength', indoor_weightlifting: 'strength', gym_and_fitness_equipment: 'strength',
}

const TYPE_LABEL: Record<string, string> = {
  running: 'Run', trail_running: 'Trail Run', treadmill_running: 'Treadmill',
  walking: 'Walk', hiking: 'Hike', indoor_walking: 'Walk',
  cycling: 'Ride', road_biking: 'Ride', mountain_biking: 'MTB', indoor_cycling: 'Cycling',
  strength_training: 'Strength', indoor_weightlifting: 'Weights', gym_and_fitness_equipment: 'Gym',
}

function fmtDist(m: number | null): string | null {
  if (!m || m < 100) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function fmtDur(s: number | null): string | null {
  if (!s) return null
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

function fmtWhen(startTime: string): string {
  const d = new Date(startTime.replace(' ', 'T'))
  const today = new Date()
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (diffDays === 0) return `TODAY · ${time}`
  if (diffDays === 1) return `YESTERDAY · ${time}`
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  return `${day} · ${time}`
}

function ActivityGlyph({ sigil, color, size = 16 }: { sigil: Sigil; color: string; size?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {sigil === 'run' && (
        <g {...p}>
          <circle cx="15.5" cy="5" r="1.8" />
          <path d="M14 9.5 L10 12 L12.5 14.5 L11 20" />
          <path d="M14 9.5 L17.5 11.5 L20 10" />
          <path d="M12.5 14.5 L16 16 L18 21" />
          <path d="M10 12 L6 11.5" />
        </g>
      )}
      {sigil === 'walk' && (
        <g {...p}>
          <circle cx="12" cy="5" r="1.8" />
          <path d="M12 7.5 L10 13 L7 16" />
          <path d="M12 7.5 L14 11 L17 10" />
          <path d="M10 13 L9 19" />
          <path d="M10 13 L13 16 L14 20" />
        </g>
      )}
      {sigil === 'cycle' && (
        <g {...p}>
          <circle cx="6" cy="16" r="3.5" />
          <circle cx="18" cy="16" r="3.5" />
          <path d="M6 16 L12 7 L18 16" />
          <path d="M12 7 L14 4" />
          <circle cx="14" cy="3.5" r="1" fill={color} stroke="none" />
        </g>
      )}
      {sigil === 'strength' && (
        <g {...p}>
          <line x1="4" y1="9" x2="4" y2="15" />
          <line x1="20" y1="9" x2="20" y2="15" />
          <line x1="7" y1="7" x2="7" y2="17" />
          <line x1="17" y1="7" x2="17" y2="17" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </g>
      )}
    </svg>
  )
}

interface LogEntryProps {
  activity: GarminActivity
  accent: string
}

export function LogEntry({ activity: a, accent }: LogEntryProps) {
  const [open, setOpen] = useState(false)
  const sigil = TYPE_SIGIL[a.type_key] ?? 'run'
  const label = TYPE_LABEL[a.type_key] ?? a.name
  const stats = [
    fmtDist(a.distance_m),
    fmtDur(a.duration_s),
    a.calories != null ? `${a.calories} kcal` : null,
    a.avg_hr != null ? `${a.avg_hr} bpm` : null,
  ].filter(Boolean)

  // will become: !!(a.trainingEffect || a.activityHrZones || (isRun && a.runDynamics))
  const hasContent = false

  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${open ? hexA(accent, 0.4) : COLORS.line}`,
      borderRadius: 8, overflow: 'hidden',
      transition: 'border-color 0.18s ease',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 11,
          padding: '10px 12px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit',
        }}
      >
        <span style={{
          fontFamily: FONT_MONO, fontSize: 13, color: accent, marginRight: -4, flexShrink: 0,
          display: 'block', lineHeight: 1,
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.18s ease',
        }}>›</span>
        <span style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hexA(accent, 0.13), border: `1px solid ${hexA(accent, 0.3)}`,
        }}>
          <ActivityGlyph sigil={sigil} color={accent} size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 650, color: COLORS.text }}>
            {label}
          </span>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textSecondary,
            marginTop: 3, letterSpacing: '0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {stats.join('  ·  ')}
          </div>
        </div>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted,
          flexShrink: 0, textAlign: 'right', letterSpacing: '0.04em',
        }}>
          {fmtWhen(a.start_time)}
        </span>
      </button>

      {open && hasContent && (
        <div style={{
          borderTop: `1px solid ${hexA(accent, 0.2)}`,
          padding: '12px 13px 13px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Phase C: Training Effect, per-activity HR Zones, Running Dynamics */}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose LogEntry 2>&1 | tail -20
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
cd /opt/bacta && npm run test:client 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 6: Type-check**

```bash
cd /opt/bacta && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd /opt/bacta && git add client/src/components/viz/LogEntry.tsx tests/client/components/viz/LogEntry.test.tsx
git commit -m "$(cat <<'EOF'
feat: expandable LogEntry with chevron animation, Phase C ready

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Production build and Playwright visual verification

**Files:** None changed — build + verify only.

---

- [ ] **Step 1: Build for production**

```bash
cd /opt/bacta && npm run build 2>&1 | tail -10
```

Expected: `✓ built in XXXms` with no errors.

- [ ] **Step 2: Restart production service**

```bash
sudo systemctl restart bacta-api.service && sleep 3 && systemctl is-active bacta-api.service
```

Expected: `active`

- [ ] **Step 3: Screenshot Training overview — HR Zones section**

Use Playwright MCP at viewport 390×844 on `http://localhost:3001/training`. Scroll to the HR Zones card and take a screenshot.

Verify:
- Top stacked bar still present with zone colors
- Below it: 5 vertical rows — each shows color dot, Z#, zone name, time value (`Xm` or `—`), mini bar, `X%` or blank
- Footer shows "TOTAL X min" and "Z2+ X min" with Z2+ in training orange accent

- [ ] **Step 4: Screenshot Training overview — Activity Log**

Scroll to the Activity Log section.

Verify:
- Each entry has a tappable `<button>` structure (aria role visible)
- `›` chevron visible on each row

- [ ] **Step 5: Interact — tap a log entry**

Click on the first activity log entry button.

Verify:
- `›` chevron rotates to point downward (90°)
- Card border changes from hairline grey to accent-tinted
- No expanded panel appears (no Phase C data)

- [ ] **Step 6: Interact — tap again to close**

Click the same entry again.

Verify:
- Chevron returns to pointing right
- Border returns to `COLORS.line`

- [ ] **Step 7: Commit verification screenshots**

```bash
cd /opt/bacta && git add audit-training-zones-final.png audit-training-log-expanded.png 2>/dev/null; echo "done"
```

(Screenshot files will be present from Playwright tool calls above.)
