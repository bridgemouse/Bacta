# Bottom-Bar Tab Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move section sub-tabs (Overview, Trends, Workouts, etc.) from the SubNav component in the content area into the bottom navigation bar, so tabs appear alongside the ☰ menu button at the bottom of every section page.

**Architecture:** BottomBar gains a `tabs` / `activeTab` / `onTabChange` / `accent` API and renders pill-style tab buttons on its left side. AppShell removes the `actions` prop, adds tab props, and computes `accent` from `SECTION_ACCENTS[section]` automatically before forwarding everything to BottomBar. Pages manage their own `activeTab` state and pass it to AppShell. SubNav is deleted.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + Testing Library, inline styles. No CSS modules, no Tailwind.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `client/src/components/BottomBar.tsx` | Remove `BottomAction`; add `tabs?`, `activeTab?`, `accent?`, `onTabChange?`; render pill tabs left + ☰ right |
| Modify | `client/src/components/AppShell.tsx` | Remove `actions` prop + `BottomAction` re-export; add `tabs?`, `activeTab?`, `onTabChange?`; auto-compute accent |
| Modify | `client/src/pages/RecoveryPage.tsx` | Remove ACTIONS + SubNav; pass `tabs={['Overview','Trends']}` + activeTab state to AppShell |
| Modify | `client/src/pages/TrainingPage.tsx` | Same pattern — tabs: `['Overview','Workouts']` |
| Modify | `client/src/pages/SleepPage.tsx` | Same pattern — tabs: `['Overview','Trends']` |
| Modify | `client/src/pages/NutritionPage.tsx` | Same pattern — tabs: `['Overview','Log']` |
| Modify | `client/src/pages/BloodWorkPage.tsx` | Same pattern — tabs: `['Overview','Results']`; also remove `BottomAction` import |
| Modify | `client/src/pages/DailyLogPage.tsx` | Remove ACTIONS + `BottomAction` import; no tabs |
| Modify | `client/src/pages/HomePage.tsx` | No actions already, no tabs needed — no change to JSX |
| Modify | `tests/client/components/BottomBar.test.tsx` | Rewrite for new tab API; keep menu button tests |
| Modify | `tests/client/components/AppShell.test.tsx` | Remove actions test; add tab forwarding test |
| Delete | `client/src/components/SubNav.tsx` | No longer used |
| Delete | `tests/client/components/SubNav.test.tsx` | Test for deleted component |

---

### Task 1: Rewrite BottomBar with tab API

**Files:**
- Modify: `client/src/components/BottomBar.tsx`
- Modify: `tests/client/components/BottomBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace all content of `tests/client/components/BottomBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomBar } from '../../../client/src/components/BottomBar'

describe('BottomBar', () => {
  it('renders tab buttons when tabs prop is provided', () => {
    render(
      <BottomBar
        tabs={['Overview', 'Trends']}
        activeTab="Overview"
        accent="#64b5f6"
        onTabChange={vi.fn()}
        onMenuOpen={vi.fn()}
      />
    )
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Trends')).toBeInTheDocument()
  })

  it('marks the active tab with data-active="true"', () => {
    render(
      <BottomBar
        tabs={['Overview', 'Trends']}
        activeTab="Trends"
        accent="#64b5f6"
        onTabChange={vi.fn()}
        onMenuOpen={vi.fn()}
      />
    )
    expect(screen.getByText('Trends').closest('[data-active="true"]')).toBeInTheDocument()
    expect(screen.getByText('Overview').closest('[data-active="false"]')).toBeInTheDocument()
  })

  it('calls onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn()
    render(
      <BottomBar
        tabs={['Overview', 'Trends']}
        activeTab="Overview"
        accent="#64b5f6"
        onTabChange={onTabChange}
        onMenuOpen={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Trends'))
    expect(onTabChange).toHaveBeenCalledWith('Trends')
  })

  it('renders no tab buttons when tabs is undefined', () => {
    render(<BottomBar onMenuOpen={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /overview/i })).not.toBeInTheDocument()
  })

  it('renders menu button with data-testid', () => {
    render(<BottomBar onMenuOpen={vi.fn()} />)
    expect(screen.getByTestId('menu-button')).toBeInTheDocument()
  })

  it('calls onMenuOpen when menu button is clicked', () => {
    const onMenuOpen = vi.fn()
    render(<BottomBar onMenuOpen={onMenuOpen} />)
    fireEvent.click(screen.getByTestId('menu-button'))
    expect(onMenuOpen).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /mnt/c/Users/ebrid/GitHub/Bacta
npx vitest run tests/client/components/BottomBar.test.tsx
```

Expected: Several FAIL — old action-based API doesn't match new tab tests.

- [ ] **Step 3: Rewrite BottomBar implementation**

Replace all content of `client/src/components/BottomBar.tsx`:

```tsx
import { COLORS } from '../theme'

interface BottomBarProps {
  tabs?: string[]
  activeTab?: string
  accent?: string
  onTabChange?: (tab: string) => void
  onMenuOpen: () => void
}

export function BottomBar({ tabs, activeTab, accent = COLORS.textSecondary, onTabChange, onMenuOpen }: BottomBarProps) {
  return (
    <div
      style={{
        background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 20px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        {(tabs ?? []).map(tab => {
          const isActive = tab === activeTab
          return (
            <button
              key={tab}
              data-active={isActive}
              onClick={() => onTabChange?.(tab)}
              style={{
                background: isActive ? accent + '22' : 'transparent',
                border: `1px solid ${isActive ? accent : COLORS.border}`,
                borderRadius: 20,
                padding: '5px 14px',
                color: isActive ? accent : COLORS.textSecondary,
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab}
            </button>
          )
        })}
      </div>
      <button
        data-testid="menu-button"
        onClick={onMenuOpen}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: 4,
        }}
      >
        <span style={{ fontSize: 20, color: COLORS.textSecondary }}>☰</span>
        <span style={{ color: COLORS.textSecondary, fontSize: 10 }}>Menu</span>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/client/components/BottomBar.test.tsx
```

Expected: 6 PASS, 0 FAIL.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/BottomBar.tsx tests/client/components/BottomBar.test.tsx
git commit -m "feat: BottomBar — swap actions for tab pills, keep menu button"
```

---

### Task 2: Update AppShell to forward tab props

**Files:**
- Modify: `client/src/components/AppShell.tsx`
- Modify: `tests/client/components/AppShell.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace all content of `tests/client/components/AppShell.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../../client/src/components/AppShell'

function renderShell(props: {
  tabs?: string[]
  activeTab?: string
  onTabChange?: (tab: string) => void
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/recovery']}>
      <AppShell section="recovery" {...props}>
        <div data-testid="child">content</div>
      </AppShell>
    </MemoryRouter>
  )
}

describe('AppShell', () => {
  it('renders children in content area', () => {
    renderShell()
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders the section label via TopBar', () => {
    renderShell()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
  })

  it('forwards tab props to BottomBar', () => {
    const onTabChange = vi.fn()
    renderShell({ tabs: ['Overview', 'Trends'], activeTab: 'Overview', onTabChange })
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Trends')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Trends'))
    expect(onTabChange).toHaveBeenCalledWith('Trends')
  })

  it('opens BottomSheet when menu button is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('menu-button'))
    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument()
  })

  it('closes BottomSheet when overlay is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('menu-button'))
    fireEvent.click(screen.getByTestId('bottom-sheet-overlay'))
    expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument()
  })

  it('bottom sheet lists all 7 sections', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('menu-button'))
    const sheet = screen.getByTestId('bottom-sheet')
    expect(sheet).toHaveTextContent('Home')
    expect(sheet).toHaveTextContent('Recovery')
    expect(sheet).toHaveTextContent('Training')
    expect(sheet).toHaveTextContent('Sleep')
    expect(sheet).toHaveTextContent('Nutrition')
    expect(sheet).toHaveTextContent('Blood Work')
    expect(sheet).toHaveTextContent('Daily Log')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/client/components/AppShell.test.tsx
```

Expected: At minimum the tab-forwarding test FAILs (AppShell doesn't accept tab props yet). The action test is gone so that's fine.

- [ ] **Step 3: Rewrite AppShell implementation**

Replace all content of `client/src/components/AppShell.tsx`:

```tsx
import { useState } from 'react'
import { COLORS, SECTION_ACCENTS } from '../theme'
import type { SectionKey } from '../theme'
import { TopBar } from './TopBar'
import { BottomBar } from './BottomBar'
import { BottomSheet } from './BottomSheet'

interface AppShellProps {
  section: SectionKey
  tabs?: string[]
  activeTab?: string
  onTabChange?: (tab: string) => void
  children: React.ReactNode
}

export function AppShell({ section, tabs, activeTab, onTabChange, children }: AppShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.base,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TopBar section={section} />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'none',
          padding: '14px 16px',
        }}
      >
        {children}
      </div>
      <BottomBar
        tabs={tabs}
        activeTab={activeTab}
        accent={SECTION_ACCENTS[section]}
        onTabChange={onTabChange}
        onMenuOpen={() => setSheetOpen(true)}
      />
      <BottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        activeSection={section}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/client/components/AppShell.test.tsx
```

Expected: 6 PASS, 0 FAIL.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AppShell.tsx tests/client/components/AppShell.test.tsx
git commit -m "feat: AppShell — remove actions prop, forward tab props to BottomBar"
```

---

### Task 3: Migrate all section pages to tab API, remove SubNav

**Files:**
- Modify: `client/src/pages/RecoveryPage.tsx`
- Modify: `client/src/pages/TrainingPage.tsx`
- Modify: `client/src/pages/SleepPage.tsx`
- Modify: `client/src/pages/NutritionPage.tsx`
- Modify: `client/src/pages/BloodWorkPage.tsx`
- Modify: `client/src/pages/DailyLogPage.tsx`
- (No change needed: `client/src/pages/HomePage.tsx` — already has no actions or SubNav)
- Delete: `client/src/components/SubNav.tsx`
- Delete: `tests/client/components/SubNav.test.tsx`

Tab assignments per section:
- Recovery: `['Overview', 'Trends']`
- Training: `['Overview', 'Workouts']`
- Sleep: `['Overview', 'Trends']`
- Nutrition: `['Overview', 'Log']`
- Blood Work: `['Overview', 'Results']`
- DailyLog: no tabs
- Home: no tabs

- [ ] **Step 1: Verify tests currently pass before deleting SubNav**

```bash
npx vitest run
```

Expected: All tests pass. Note the count — after this task it should still match (SubNav tests will be gone, but nothing else should break).

- [ ] **Step 2: Rewrite RecoveryPage**

Replace all content of `client/src/pages/RecoveryPage.tsx`:

```tsx
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'Trends']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: "HRV up 4ms from 7-day average — positive adaptation signal. Body battery at 74. Green for tomorrow's session.",
  tone: 'positive' as const,
  flags: [],
}

export function RecoveryPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="recovery" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <MX4Card insight={MOCK_INSIGHT} section="recovery" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile value="74"  label="Body Battery" accent={SECTION_ACCENTS.recovery} progress={0.74} />
        <MetricTile value="61"  unit="ms"  label="HRV"         accent="#a78bfa" trend="↑ +4ms" />
        <MetricTile value="52"  unit="bpm" label="Resting HR"  accent="#f472b6" />
        <MetricTile value="18"  unit="rpm" label="Respiration" accent="#34d399" />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 3: Rewrite TrainingPage**

Replace all content of `client/src/pages/TrainingPage.tsx`:

```tsx
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'Workouts']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: 'Training load moderate — week 4 of 8 in your Garmin Coach block. VO2 max holding at 48. Thursday tempo is the key session.',
  tone: 'positive' as const,
  flags: [],
}

export function TrainingPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="training" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <MX4Card insight={MOCK_INSIGHT} section="training" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile value="342"  label="Training Load" accent={SECTION_ACCENTS.training} />
        <MetricTile value="48"   label="VO2 Max"       accent={SECTION_ACCENTS.training} trend="→ stable" />
        <MetricTile value="28"   unit="km"   label="Weekly Volume" accent={SECTION_ACCENTS.training} />
        <MetricTile value="5:42" unit="/km"  label="Avg Pace"      accent={SECTION_ACCENTS.training} />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 4: Rewrite SleepPage**

Replace all content of `client/src/pages/SleepPage.tsx`:

```tsx
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'Trends']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: '8.1h with a score of 82 — solid night. Deep sleep slightly low at 18%. Consistent with the mileage spike this week.',
  tone: 'positive' as const,
  flags: [],
}

export function SleepPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="sleep" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <MX4Card insight={MOCK_INSIGHT} section="sleep" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile value="8.1" unit="h"  label="Duration"    accent={SECTION_ACCENTS.sleep} />
        <MetricTile value="82"            label="Sleep Score"  accent={SECTION_ACCENTS.sleep} progress={0.82} />
        <MetricTile value="18"  unit="%" label="Deep Sleep"   accent={SECTION_ACCENTS.sleep} />
        <MetricTile value="24"  unit="%" label="REM"          accent={SECTION_ACCENTS.sleep} />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 5: Rewrite NutritionPage**

Replace all content of `client/src/pages/NutritionPage.tsx`:

```tsx
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'Log']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: 'Calories on target. Protein slightly under at 142g vs 160g goal — worth closing the gap at dinner. Weight trend stable.',
  tone: 'caution' as const,
  flags: ['protein under target'],
}

export function NutritionPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="nutrition" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <MX4Card insight={MOCK_INSIGHT} section="nutrition" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile value="2,340" unit="kcal" label="Calories" accent={SECTION_ACCENTS.nutrition} progress={0.94} />
        <MetricTile value="142"   unit="g"    label="Protein"  accent={SECTION_ACCENTS.nutrition} progress={0.89} trend="↓ 18g under" />
        <MetricTile value="280"   unit="g"    label="Carbs"    accent={SECTION_ACCENTS.nutrition} />
        <MetricTile value="74"    unit="g"    label="Fat"      accent={SECTION_ACCENTS.nutrition} />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 6: Rewrite BloodWorkPage**

Replace all content of `client/src/pages/BloodWorkPage.tsx`:

```tsx
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { MX4Card } from '../components/MX4Card'
import { COLORS } from '../theme'

const TABS = ['Overview', 'Results']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: "No panels uploaded yet. Upload your lab results to get MX-4's read on your blood work.",
  tone: 'caution' as const,
  flags: [],
}

export function BloodWorkPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="bloodwork" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <MX4Card insight={MOCK_INSIGHT} section="bloodwork" />
      <div style={{
        background: COLORS.surfaceElevated,
        borderRadius: 10,
        padding: '20px 16px',
        textAlign: 'center',
        color: COLORS.textMuted,
        fontSize: 13,
      }}>
        No blood work panels uploaded yet.
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 7: Rewrite DailyLogPage**

Replace all content of `client/src/pages/DailyLogPage.tsx`:

```tsx
import { AppShell } from '../components/AppShell'
import { COLORS, SECTION_ACCENTS } from '../theme'

export function DailyLogPage() {
  return (
    <AppShell section="dailylog">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Readiness */}
        <div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>Readiness</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: COLORS.surfaceElevated,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  color: COLORS.textSecondary,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Caffeine */}
        <div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>Caffeine (mg)</div>
          <input
            type="number"
            placeholder="0"
            style={{
              width: '100%',
              background: COLORS.surfaceElevated,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: COLORS.textPrimary,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Notes */}
        <div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>Notes</div>
          <textarea
            placeholder="Anything worth noting today..."
            rows={3}
            style={{
              width: '100%',
              background: COLORS.surfaceElevated,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: COLORS.textPrimary,
              fontSize: 14,
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          style={{
            background: SECTION_ACCENTS.dailylog,
            border: 'none',
            borderRadius: 10,
            padding: '12px',
            color: '#000',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Log Today
        </button>
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 8: Delete SubNav component and its tests**

```bash
rm client/src/components/SubNav.tsx
rm tests/client/components/SubNav.test.tsx
```

- [ ] **Step 9: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass. The 3 SubNav tests are gone; all remaining tests pass. Count should be previous total minus 3.

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/RecoveryPage.tsx client/src/pages/TrainingPage.tsx \
        client/src/pages/SleepPage.tsx client/src/pages/NutritionPage.tsx \
        client/src/pages/BloodWorkPage.tsx client/src/pages/DailyLogPage.tsx
git add -u client/src/components/SubNav.tsx tests/client/components/SubNav.test.tsx
git commit -m "feat: move section tabs into BottomBar, delete SubNav"
```

---

## Self-Review

**Spec coverage:**
- BottomBar: tabs on left, ☰ right → Task 1 ✅
- Remove action stubs → Tasks 1 & 2 (actions prop gone) ✅
- AppShell passthrough → Task 2 ✅
- All section pages migrated → Task 3 ✅
- SubNav deleted → Task 3 Step 8 ✅
- Per-section tab assignments (2 tabs each, Home/DailyLog no tabs) → Task 3 ✅

**Placeholder scan:** No TBDs or TODOs — all code is complete.

**Type consistency:**
- `onTabChange?: (tab: string) => void` defined in BottomBar (Task 1) and forwarded through AppShell (Task 2) — matches.
- `SECTION_ACCENTS[section]` computed in AppShell and passed as `accent` to BottomBar — both sides use `accent?: string` — matches.
- `tabs?: string[]` + `activeTab?: string` consistent across BottomBar → AppShell → all pages — matches.
