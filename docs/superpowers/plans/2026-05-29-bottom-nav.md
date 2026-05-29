# Bottom Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the side drawer + PageShell navigation with a fixed top bar, fixed contextual bottom bar, and auto-height bottom sheet drawer — fixing iOS PWA scroll permanently.

**Architecture:** Four new components (`TopBar`, `BottomBar`, `BottomSheet`, `AppShell`) replace three old ones (`PageShell`, `Drawer`, `DrawerItem`). `AppShell` is `position: fixed; inset: 0` — the only scrollable zone is the content div inside it. Each page component renders its own SubNav/MX4Card content and passes action stubs to AppShell.

**Tech Stack:** React 19, TypeScript, inline styles, React Router v7 `useNavigate`/`useLocation`, Vitest + Testing Library

---

## File Map

| Action | File |
|--------|------|
| Create | `client/src/components/BottomBar.tsx` |
| Create | `client/src/components/TopBar.tsx` |
| Create | `client/src/components/BottomSheet.tsx` |
| Create | `client/src/components/AppShell.tsx` |
| Delete | `client/src/components/PageShell.tsx` |
| Delete | `client/src/components/Drawer.tsx` |
| Delete | `client/src/components/DrawerItem.tsx` |
| Modify | `client/src/App.tsx` |
| Modify | `client/src/pages/HomePage.tsx` |
| Modify | `client/src/pages/RecoveryPage.tsx` |
| Modify | `client/src/pages/TrainingPage.tsx` |
| Modify | `client/src/pages/SleepPage.tsx` |
| Modify | `client/src/pages/NutritionPage.tsx` |
| Modify | `client/src/pages/BloodWorkPage.tsx` |
| Modify | `client/src/pages/DailyLogPage.tsx` |
| Create | `tests/client/components/BottomBar.test.tsx` |
| Create | `tests/client/components/TopBar.test.tsx` |
| Create | `tests/client/components/BottomSheet.test.tsx` |
| Create | `tests/client/components/AppShell.test.tsx` |
| Delete | `tests/client/components/PageShell.test.tsx` |
| Delete | `tests/client/components/Drawer.test.tsx` |

---

## Task 1: BottomBar

**Files:**
- Create: `client/src/components/BottomBar.tsx`
- Test: `tests/client/components/BottomBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/components/BottomBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomBar } from '../../../client/src/components/BottomBar'

describe('BottomBar', () => {
  it('renders provided action buttons', () => {
    render(
      <BottomBar
        actions={[{ icon: '🔄', label: 'Sync', onClick: vi.fn() }]}
        onMenuOpen={vi.fn()}
      />
    )
    expect(screen.getByText('Sync')).toBeInTheDocument()
  })

  it('calls action onClick when action button is clicked', () => {
    const onClick = vi.fn()
    render(
      <BottomBar
        actions={[{ icon: '🔄', label: 'Sync', onClick }]}
        onMenuOpen={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Sync'))
    expect(onClick).toHaveBeenCalled()
  })

  it('renders menu button with data-testid', () => {
    render(<BottomBar actions={[]} onMenuOpen={vi.fn()} />)
    expect(screen.getByTestId('menu-button')).toBeInTheDocument()
  })

  it('calls onMenuOpen when menu button is clicked', () => {
    const onMenuOpen = vi.fn()
    render(<BottomBar actions={[]} onMenuOpen={onMenuOpen} />)
    fireEvent.click(screen.getByTestId('menu-button'))
    expect(onMenuOpen).toHaveBeenCalled()
  })

  it('renders no action buttons when actions is empty', () => {
    render(<BottomBar actions={[]} onMenuOpen={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /sync/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:client -- --reporter=verbose 2>&1 | grep -A 5 "BottomBar"
```

Expected: FAIL — `Cannot find module '../../../client/src/components/BottomBar'`

- [ ] **Step 3: Implement BottomBar**

Create `client/src/components/BottomBar.tsx`:

```tsx
import { COLORS } from '../theme'

export interface BottomAction {
  icon: string
  label: string
  onClick: () => void
}

interface BottomBarProps {
  actions: BottomAction[]
  onMenuOpen: () => void
}

export function BottomBar({ actions, onMenuOpen }: BottomBarProps) {
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
      <div style={{ display: 'flex', gap: 28 }}>
        {actions.map(({ icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
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
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ color: COLORS.textSecondary, fontSize: 10 }}>{label}</span>
          </button>
        ))}
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
npm run test:client -- --reporter=verbose 2>&1 | grep -A 5 "BottomBar"
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/BottomBar.tsx tests/client/components/BottomBar.test.tsx
git commit -m "feat: add BottomBar component with BottomAction type"
```

---

## Task 2: TopBar

**Files:**
- Create: `client/src/components/TopBar.tsx`
- Test: `tests/client/components/TopBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/components/TopBar.test.tsx
import { render, screen } from '@testing-library/react'
import { TopBar } from '../../../client/src/components/TopBar'

describe('TopBar', () => {
  it('shows the section label', () => {
    render(<TopBar section="recovery" />)
    expect(screen.getByText('Recovery')).toBeInTheDocument()
  })

  it('shows "Bacta" for home section', () => {
    render(<TopBar section="home" />)
    expect(screen.getByText('Bacta')).toBeInTheDocument()
  })

  it('shows MX-4 status indicator', () => {
    render(<TopBar section="recovery" />)
    expect(screen.getByText(/MX-4/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:client -- --reporter=verbose 2>&1 | grep -A 5 "TopBar"
```

Expected: FAIL — `Cannot find module '../../../client/src/components/TopBar'`

- [ ] **Step 3: Implement TopBar**

Create `client/src/components/TopBar.tsx`:

```tsx
import { COLORS, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'

interface TopBarProps {
  section: SectionKey
}

export function TopBar({ section }: TopBarProps) {
  const label = section === 'home' ? 'Bacta' : SECTION_LABELS[section]
  const accent = SECTION_ACCENTS[section]

  return (
    <div
      style={{
        background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        paddingTop: 'calc(14px + env(safe-area-inset-top))',
        flexShrink: 0,
      }}
    >
      <div style={{ width: 50 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600 }}>{label}</span>
        <div style={{ width: 28, height: 2, background: accent, borderRadius: 1 }} />
      </div>
      <span style={{ color: COLORS.mx4Green, fontSize: 10, whiteSpace: 'nowrap' }}>● MX-4</span>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:client -- --reporter=verbose 2>&1 | grep -A 5 "TopBar"
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TopBar.tsx tests/client/components/TopBar.test.tsx
git commit -m "feat: add TopBar component"
```

---

## Task 3: BottomSheet

**Files:**
- Create: `client/src/components/BottomSheet.tsx`
- Test: `tests/client/components/BottomSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/components/BottomSheet.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomSheet } from '../../../client/src/components/BottomSheet'

function renderSheet(isOpen: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <BottomSheet isOpen={isOpen} onClose={onClose} activeSection="home" />
    </MemoryRouter>
  )
}

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    renderSheet(false)
    expect(screen.queryByTestId('bottom-sheet-overlay')).not.toBeInTheDocument()
  })

  it('renders overlay and panel when open', () => {
    renderSheet(true)
    expect(screen.getByTestId('bottom-sheet-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument()
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    renderSheet(true, onClose)
    fireEvent.click(screen.getByTestId('bottom-sheet-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders all 7 section labels', () => {
    renderSheet(true)
    const sheet = screen.getByTestId('bottom-sheet')
    expect(sheet).toHaveTextContent('Home')
    expect(sheet).toHaveTextContent('Recovery')
    expect(sheet).toHaveTextContent('Training')
    expect(sheet).toHaveTextContent('Sleep')
    expect(sheet).toHaveTextContent('Nutrition')
    expect(sheet).toHaveTextContent('Blood Work')
    expect(sheet).toHaveTextContent('Daily Log')
  })

  it('renders profile header with Ethan and MX-4 status', () => {
    renderSheet(true)
    expect(screen.getByText('Ethan')).toBeInTheDocument()
    expect(screen.getByText(/MX-4 online/)).toBeInTheDocument()
  })

  it('calls onClose when a section is clicked', () => {
    const onClose = vi.fn()
    renderSheet(true, onClose)
    fireEvent.click(screen.getByText('Training'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:client -- --reporter=verbose 2>&1 | grep -A 5 "BottomSheet"
```

Expected: FAIL — `Cannot find module '../../../client/src/components/BottomSheet'`

- [ ] **Step 3: Implement BottomSheet**

Create `client/src/components/BottomSheet.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { COLORS, SECTION_ACCENTS, SECTION_LABELS, SECTION_ICONS } from '../theme'
import type { SectionKey } from '../theme'

const SECTIONS: SectionKey[] = ['home', 'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog']

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  activeSection: string
}

export function BottomSheet({ isOpen, onClose, activeSection }: BottomSheetProps) {
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleNav = (section: SectionKey) => {
    navigate(section === 'home' ? '/' : `/${section}`)
    onClose()
  }

  return (
    <>
      <div
        data-testid="bottom-sheet-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 40,
        }}
      />
      <div
        data-testid="bottom-sheet"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: COLORS.surface,
          borderRadius: '14px 14px 0 0',
          borderTop: `1px solid ${COLORS.border}`,
          zIndex: 50,
        }}
      >
        {/* Handle */}
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 36, height: 3, background: COLORS.textMuted, borderRadius: 2, margin: '0 auto' }} />
        </div>

        {/* Profile header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4ade80, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            E
          </div>
          <div>
            <div style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600 }}>Ethan</div>
            <div style={{ color: COLORS.mx4Green, fontSize: 11 }}>● MX-4 online</div>
          </div>
        </div>

        {/* Section nav */}
        <nav style={{ padding: '8px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
          {SECTIONS.map(section => {
            const isActive = activeSection === section
            const accent = SECTION_ACCENTS[section]
            return (
              <button
                key={section}
                onClick={() => handleNav(section)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 12px',
                  background: isActive ? accent + '18' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 16 }}>{SECTION_ICONS[section]}</span>
                <span
                  style={{
                    color: isActive ? accent : COLORS.textSecondary,
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {SECTION_LABELS[section]}
                </span>
              </button>
            )
          })}
        </nav>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:client -- --reporter=verbose 2>&1 | grep -A 5 "BottomSheet"
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/BottomSheet.tsx tests/client/components/BottomSheet.test.tsx
git commit -m "feat: add BottomSheet component"
```

---

## Task 4: AppShell

**Files:**
- Create: `client/src/components/AppShell.tsx`
- Test: `tests/client/components/AppShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/components/AppShell.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../../client/src/components/AppShell'

function renderShell(props: { actions?: { icon: string; label: string; onClick: () => void }[] } = {}) {
  return render(
    <MemoryRouter initialEntries={['/recovery']}>
      <AppShell section="recovery" actions={props.actions ?? []}>
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

  it('renders provided action buttons via BottomBar', () => {
    renderShell({ actions: [{ icon: '🔄', label: 'Sync', onClick: vi.fn() }] })
    expect(screen.getByText('Sync')).toBeInTheDocument()
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

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:client -- --reporter=verbose 2>&1 | grep -A 5 "AppShell"
```

Expected: FAIL — `Cannot find module '../../../client/src/components/AppShell'`

- [ ] **Step 3: Implement AppShell**

Create `client/src/components/AppShell.tsx`:

```tsx
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { COLORS } from '../theme'
import type { SectionKey } from '../theme'
import { TopBar } from './TopBar'
import { BottomBar, type BottomAction } from './BottomBar'
import { BottomSheet } from './BottomSheet'

export type { BottomAction }

interface AppShellProps {
  section: SectionKey
  actions?: BottomAction[]
  children: React.ReactNode
}

export function AppShell({ section, actions = [], children }: AppShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const { pathname } = useLocation()
  const activeSection = pathname.split('/').filter(Boolean)[0] || 'home'

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
      <BottomBar actions={actions} onMenuOpen={() => setSheetOpen(true)} />
      <BottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        activeSection={activeSection}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:client -- --reporter=verbose 2>&1 | grep -A 5 "AppShell"
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AppShell.tsx tests/client/components/AppShell.test.tsx
git commit -m "feat: add AppShell — fixed layout with TopBar, BottomBar, BottomSheet"
```

---

## Task 5: Update App.tsx and all page components

`App.tsx` currently holds `drawerOpen` state and passes `onMenuOpen` to every page via `menuProps`. With `AppShell` handling that internally, `App.tsx` becomes a plain route switcher and every page component drops the `onMenuOpen` prop.

`PageShell` previously rendered `SubNav` and `MX4Card` automatically. Now each page renders them explicitly inside its `AppShell` content slot.

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/HomePage.tsx`
- Modify: `client/src/pages/RecoveryPage.tsx`
- Modify: `client/src/pages/TrainingPage.tsx`
- Modify: `client/src/pages/SleepPage.tsx`
- Modify: `client/src/pages/NutritionPage.tsx`
- Modify: `client/src/pages/BloodWorkPage.tsx`
- Modify: `client/src/pages/DailyLogPage.tsx`

- [ ] **Step 1: Replace App.tsx**

```tsx
// client/src/App.tsx
import { Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { RecoveryPage } from './pages/RecoveryPage'
import { TrainingPage } from './pages/TrainingPage'
import { SleepPage } from './pages/SleepPage'
import { NutritionPage } from './pages/NutritionPage'
import { BloodWorkPage } from './pages/BloodWorkPage'
import { DailyLogPage } from './pages/DailyLogPage'

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<HomePage />} />
      <Route path="/recovery"  element={<RecoveryPage />} />
      <Route path="/training"  element={<TrainingPage />} />
      <Route path="/sleep"     element={<SleepPage />} />
      <Route path="/nutrition" element={<NutritionPage />} />
      <Route path="/bloodwork" element={<BloodWorkPage />} />
      <Route path="/dailylog"  element={<DailyLogPage />} />
    </Routes>
  )
}
```

- [ ] **Step 2: Replace HomePage.tsx**

HomePage no longer uses `PageShell`. It renders `AppShell` directly with its own layout inside the content slot. No `onMenuOpen` prop.

```tsx
// client/src/pages/HomePage.tsx
import { AppShell } from '../components/AppShell'
import { COLORS, SECTION_ACCENTS, SECTION_LABELS, SECTION_ICONS } from '../theme'
import type { SectionKey } from '../theme'
import { MX4Card, type MX4Insight } from '../components/MX4Card'

const MOCK_HOME_INSIGHT: MX4Insight = {
  generated_at: new Date().toISOString(),
  summary: 'Recovery looking solid. Training load on track. Nutrition close — protein slightly under target. MX-4 standing by.',
  tone: 'positive',
  flags: [],
}

const MOCK_TILES: Array<{ section: SectionKey; status: string; metric: string }> = [
  { section: 'recovery',  status: 'Good',      metric: 'HRV ↑ · Battery 74' },
  { section: 'training',  status: 'On track',  metric: 'Load: Moderate' },
  { section: 'sleep',     status: '8.1h',       metric: 'Score: 82' },
  { section: 'nutrition', status: 'On target', metric: '2,340 / 2,500 kcal' },
  { section: 'bloodwork', status: 'No flags',  metric: 'Last panel: —' },
  { section: 'dailylog',  status: 'Logged',    metric: 'Readiness: 4/5' },
]

export function HomePage() {
  return (
    <AppShell section="home">
      <MX4Card insight={MOCK_HOME_INSIGHT} section="home" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
        {MOCK_TILES.map(({ section, status, metric }) => (
          <div
            key={section}
            style={{
              background: COLORS.surfaceElevated,
              borderRadius: 10,
              padding: '10px 12px',
              borderLeft: `3px solid ${SECTION_ACCENTS[section]}`,
            }}
          >
            <div style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {SECTION_ICONS[section]} {SECTION_LABELS[section]}
            </div>
            <div style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600 }}>{status}</div>
            <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>{metric}</div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 3: Replace RecoveryPage.tsx**

```tsx
// client/src/pages/RecoveryPage.tsx
import { useState } from 'react'
import { AppShell, type BottomAction } from '../components/AppShell'
import { SubNav } from '../components/SubNav'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'HRV', 'Body Battery', 'Stress', 'SpO2']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: "HRV up 4ms from 7-day average — positive adaptation signal. Body battery at 74. Green for tomorrow's session.",
  tone: 'positive' as const,
  flags: [],
}

const ACTIONS: BottomAction[] = [
  { icon: '🔄', label: 'Sync',   onClick: () => {} },
  { icon: '✏️', label: 'Manual', onClick: () => {} },
]

export function RecoveryPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="recovery" actions={ACTIONS}>
      <SubNav tabs={TABS} active={activeTab} accent={SECTION_ACCENTS.recovery} onChange={setActiveTab} />
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

- [ ] **Step 4: Replace TrainingPage.tsx**

```tsx
// client/src/pages/TrainingPage.tsx
import { useState } from 'react'
import { AppShell, type BottomAction } from '../components/AppShell'
import { SubNav } from '../components/SubNav'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'Workouts', 'Load', 'VO2 Max', 'Volume', 'Pace']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: 'Training load moderate — week 4 of 8 in your Garmin Coach block. VO2 max holding at 48. Thursday tempo is the key session.',
  tone: 'positive' as const,
  flags: [],
}

const ACTIONS: BottomAction[] = [
  { icon: '✏️', label: 'Log',  onClick: () => {} },
  { icon: '🔄', label: 'Sync', onClick: () => {} },
]

export function TrainingPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="training" actions={ACTIONS}>
      <SubNav tabs={TABS} active={activeTab} accent={SECTION_ACCENTS.training} onChange={setActiveTab} />
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

- [ ] **Step 5: Replace SleepPage.tsx**

```tsx
// client/src/pages/SleepPage.tsx
import { useState } from 'react'
import { AppShell, type BottomAction } from '../components/AppShell'
import { SubNav } from '../components/SubNav'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'Stages', 'Trends']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: '8.1h with a score of 82 — solid night. Deep sleep slightly low at 18%. Consistent with the mileage spike this week.',
  tone: 'positive' as const,
  flags: [],
}

const ACTIONS: BottomAction[] = [
  { icon: '🔄', label: 'Sync',   onClick: () => {} },
  { icon: '✏️', label: 'Manual', onClick: () => {} },
]

export function SleepPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="sleep" actions={ACTIONS}>
      <SubNav tabs={TABS} active={activeTab} accent={SECTION_ACCENTS.sleep} onChange={setActiveTab} />
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

- [ ] **Step 6: Replace NutritionPage.tsx**

```tsx
// client/src/pages/NutritionPage.tsx
import { useState } from 'react'
import { AppShell, type BottomAction } from '../components/AppShell'
import { SubNav } from '../components/SubNav'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'Log Food', 'Macros', 'Weight', 'Food History']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: 'Calories on target. Protein slightly under at 142g vs 160g goal — worth closing the gap at dinner. Weight trend stable.',
  tone: 'caution' as const,
  flags: ['protein under target'],
}

const ACTIONS: BottomAction[] = [
  { icon: '📝', label: 'Log',  onClick: () => {} },
  { icon: '🔄', label: 'Sync', onClick: () => {} },
]

export function NutritionPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="nutrition" actions={ACTIONS}>
      <SubNav tabs={TABS} active={activeTab} accent={SECTION_ACCENTS.nutrition} onChange={setActiveTab} />
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

- [ ] **Step 7: Replace BloodWorkPage.tsx**

```tsx
// client/src/pages/BloodWorkPage.tsx
import { useState } from 'react'
import { AppShell, type BottomAction } from '../components/AppShell'
import { SubNav } from '../components/SubNav'
import { MX4Card } from '../components/MX4Card'
import { COLORS } from '../theme'

const TABS = ['Overview', 'Results', 'Trends']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: "No panels uploaded yet. Upload your lab results to get MX-4's read on your blood work.",
  tone: 'caution' as const,
  flags: [],
}

const ACTIONS: BottomAction[] = [
  { icon: '📤', label: 'Upload',  onClick: () => {} },
  { icon: '📊', label: 'History', onClick: () => {} },
]

export function BloodWorkPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="bloodwork" actions={ACTIONS}>
      <SubNav tabs={TABS} active={activeTab} accent="#f87171" onChange={setActiveTab} />
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

- [ ] **Step 8: Replace DailyLogPage.tsx**

DailyLog has no tabs and no insight card — just a form inside AppShell with a single 💾 Save action.

```tsx
// client/src/pages/DailyLogPage.tsx
import { AppShell, type BottomAction } from '../components/AppShell'
import { COLORS, SECTION_ACCENTS } from '../theme'

const ACTIONS: BottomAction[] = [
  { icon: '💾', label: 'Save', onClick: () => {} },
]

export function DailyLogPage() {
  return (
    <AppShell section="dailylog" actions={ACTIONS}>
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

- [ ] **Step 9: Run the full client test suite**

```bash
npm run test:client -- --reporter=verbose
```

Expected: All tests PASS. The existing `App.test.tsx` tests pass unchanged because:
- `data-testid="menu-button"` is on BottomBar's ☰ button
- Clicking it opens BottomSheet which renders all section labels
- TopBar shows "Bacta" for the home section

If any test fails, read the error and fix before committing.

- [ ] **Step 10: Commit**

```bash
git add client/src/App.tsx client/src/pages/
git commit -m "feat: migrate all pages to AppShell, remove onMenuOpen prop"
```

---

## Task 6: Delete old components and tests

**Files:**
- Delete: `client/src/components/PageShell.tsx`
- Delete: `client/src/components/Drawer.tsx`
- Delete: `client/src/components/DrawerItem.tsx`
- Delete: `tests/client/components/PageShell.test.tsx`
- Delete: `tests/client/components/Drawer.test.tsx`

- [ ] **Step 1: Delete the old files**

```bash
rm client/src/components/PageShell.tsx \
   client/src/components/Drawer.tsx \
   client/src/components/DrawerItem.tsx \
   tests/client/components/PageShell.test.tsx \
   tests/client/components/Drawer.test.tsx
```

- [ ] **Step 2: Run the full test suite (client + server)**

```bash
npm test
```

Expected output: all tests PASS with no references to deleted files. If the type checker catches any leftover imports, fix them.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete PageShell, Drawer, DrawerItem and their tests"
```

---

## Verification

After all tasks are complete:

```bash
npm test
```

Expected: all tests pass (no failures, no skips from deleted test files).

```bash
npm run build
```

Expected: clean TypeScript compile, no errors.

The iOS scroll fix is structural: `AppShell` is `position: fixed; inset: 0`, so the document body has no scrollable content. Safari cannot page-bounce anything outside the content div.
