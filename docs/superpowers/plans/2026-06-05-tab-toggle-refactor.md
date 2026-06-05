# Tab Toggle Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `tab`/`onTabChange` prop-drilling from AppShell → BottomBar by extending TabContext to carry both the tab value and its setter.

**Architecture:** `TabContext` value type changes from `Tab` to `{ tab: Tab; setTab: (t: Tab) => void }`. AppShell still owns `useState<Tab>` and provides the context, but the provider moves to wrap both the scrollable content div and BottomBar — so BottomBar can read `{ tab, setTab }` from context instead of receiving them as props. `useTab()` still returns `Tab`, so all four page call sites are unchanged.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library.

---

### Task 1: Update TabContext

**Files:**
- Modify: `client/src/lib/TabContext.ts`

Current file contents (3 lines — full replacement):
```ts
import { createContext, useContext } from 'react'

export type Tab = 'overview' | 'trends'

export const TabContext = createContext<Tab>('overview')
export const useTab = (): Tab => useContext(TabContext)
```

---

- [ ] **Step 1: Replace TabContext.ts**

Write the full new file at `client/src/lib/TabContext.ts`:

```ts
import { createContext, useContext } from 'react'

export type Tab = 'overview' | 'trends'

interface TabContextValue {
  tab: Tab
  setTab: (t: Tab) => void
}

const DEFAULT: TabContextValue = { tab: 'overview', setTab: () => {} }

export const TabContext = createContext<TabContextValue>(DEFAULT)
export const useTab = (): Tab => useContext(TabContext).tab
```

`useTab()` still returns `Tab` — all page consumers (`RecoveryPage`, `SleepPage`, `TrainingPage`, `HomePage`) are unchanged.

- [ ] **Step 2: Run existing tests to confirm nothing broke**

```bash
cd /opt/bacta && npm run test:client 2>&1 | tail -8
```

Expected: all tests pass. The pages use `useTab()` which still returns `Tab`. AppShell currently sets `<TabContext.Provider value={tab}>` — this now has a TypeScript mismatch (value should be `{ tab, setTab }`) but runtime tests don't fail on type errors.

- [ ] **Step 3: Commit**

```bash
cd /opt/bacta && git add client/src/lib/TabContext.ts && git commit -m "$(cat <<'EOF'
refactor: TabContext carries { tab, setTab } instead of bare Tab value

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Update BottomBar (TDD)

**Files:**
- Modify: `client/src/components/BottomBar.tsx`
- Modify: `tests/client/components/BottomBar.test.tsx`

---

- [ ] **Step 1: Add three new tests to BottomBar.test.tsx**

Add these imports at the top of `tests/client/components/BottomBar.test.tsx` (after existing imports):

```tsx
import userEvent from '@testing-library/user-event'
import { TabContext } from '../../../client/src/lib/TabContext'
```

Add these three tests inside the existing `describe('BactaDock (BottomBar)', ...)` block, after the last existing test:

```tsx
  it('renders Overview and Trends buttons when hasTabs is true', () => {
    render(<BottomBar accent="#2bc4e8" hasTabs onAsk={vi.fn()} onNav={vi.fn()} />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Trends')).toBeInTheDocument()
  })

  it('does not render tab buttons when hasTabs is false', () => {
    render(<BottomBar accent="#2bc4e8" hasTabs={false} onAsk={vi.fn()} onNav={vi.fn()} />)
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
    expect(screen.queryByText('Trends')).not.toBeInTheDocument()
  })

  it('clicking Trends calls setTab from context', async () => {
    const user = userEvent.setup()
    const setTab = vi.fn()
    render(
      <TabContext.Provider value={{ tab: 'overview', setTab }}>
        <BottomBar accent="#2bc4e8" hasTabs onAsk={vi.fn()} onNav={vi.fn()} />
      </TabContext.Provider>
    )
    await user.click(screen.getByText('Trends'))
    expect(setTab).toHaveBeenCalledWith('trends')
  })
```

- [ ] **Step 2: Run to verify the third test fails**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose BottomBar 2>&1 | tail -25
```

Expected: The third test (`clicking Trends calls setTab from context`) fails — the current BottomBar calls `onTabChange` from props (which is not provided) rather than `setTab` from context. The first two new tests may already pass since BottomBar renders tabs when `hasTabs=true` regardless.

- [ ] **Step 3: Replace BottomBar.tsx**

Write the full new file at `client/src/components/BottomBar.tsx`:

```tsx
import { useContext } from 'react'
import { COLORS, FONT_MONO, FONT_UI, MX4_COLOR } from '../theme'
import { TabContext } from '../lib/TabContext'
import type { Tab } from '../lib/TabContext'
import { MX4Sigil } from './primitives/MX4Sigil'
import { NavIcon } from './primitives/NavIcon'
import { hexA } from '../lib/hexA'

const oct = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`

function SectionTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div style={{ clipPath: oct(7), background: hexA(MX4_COLOR, 0.45), padding: 1.5, flexShrink: 0 }}>
      <div style={{ clipPath: oct(6), background: COLORS.base, display: 'flex', gap: 3, padding: 3 }}>
        {(['overview', 'trends'] as const).map(t => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => onTab(t)}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                padding: '7px 14px',
                border: 'none',
                cursor: 'pointer',
                clipPath: oct(4),
                background: active ? hexA(MX4_COLOR, 0.2) : 'transparent',
                color: active ? MX4_COLOR : COLORS.textMuted,
              }}
            >
              {t === 'overview' ? 'Overview' : 'Trends'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface BottomBarProps {
  accent: string
  hasTabs?: boolean
  onAsk: () => void
  onNav: () => void
}

const DIVIDER = (
  <span style={{ width: 1, height: 24, background: hexA(MX4_COLOR, 0.22), flexShrink: 0 }} />
)

export function BottomBar({ hasTabs = false, onAsk, onNav }: BottomBarProps) {
  const { tab, setTab } = useContext(TabContext)

  return (
    <div
      style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 2,
        background: 'rgba(17,24,39,0.96)',
        borderTop: `1px solid ${hexA(MX4_COLOR, 0.28)}`,
        display: 'flex',
        justifyContent: 'center',
        padding: '10px 12px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          maxWidth: 420,
          background: `linear-gradient(180deg, ${hexA(MX4_COLOR, 0.07)}, ${COLORS.surface})`,
          border: `1px solid ${hexA(MX4_COLOR, 0.3)}`,
          borderRadius: 30,
          boxShadow: `0 0 20px ${hexA(MX4_COLOR, 0.09)}, inset 0 1px 0 rgba(255,255,255,0.04)`,
          padding: '5px 8px',
        }}
      >
        <button
          data-testid="ask-button"
          onClick={onAsk}
          aria-label="Ask MX-4"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: hasTabs ? 0 : 9,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${hexA(MX4_COLOR, 0.16)}, ${hexA(MX4_COLOR, 0.03)} 70%)`,
              border: `1px solid ${hexA(MX4_COLOR, 0.55)}`,
              animation: 'mx4glowbreathe 3.6s ease-in-out infinite',
              flexShrink: 0,
            }}
          >
            <MX4Sigil color={MX4_COLOR} size={29} glow mood="listen" />
          </span>
          {!hasTabs && (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingRight: 4 }}>
              <span style={{ fontFamily: FONT_UI, fontSize: 13, fontWeight: 650, color: COLORS.text, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                Ask MX-4
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: '0.12em', color: COLORS.textMuted, whiteSpace: 'nowrap' }}>
                TAP TO TALK
              </span>
            </span>
          )}
        </button>

        {DIVIDER}

        {hasTabs ? (
          <>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <SectionTabs tab={tab} onTab={setTab} />
            </div>
            {DIVIDER}
          </>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        <button
          data-testid="nav-button"
          onClick={onNav}
          aria-label="All Systems"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${hexA(COLORS.textSecondary, 0.1)}, transparent 70%)`,
            border: `1px solid ${hexA(COLORS.textSecondary, 0.45)}`,
            boxShadow: `0 0 11px ${hexA(COLORS.textSecondary, 0.22)}, inset 0 0 7px ${hexA(COLORS.textSecondary, 0.06)}`,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <NavIcon color={COLORS.textSecondary} size={26} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run BottomBar tests**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose BottomBar 2>&1 | tail -20
```

Expected: all 8 tests pass (5 existing + 3 new). If any fail, debug before continuing.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta && git add client/src/components/BottomBar.tsx tests/client/components/BottomBar.test.tsx && git commit -m "$(cat <<'EOF'
refactor: BottomBar reads tab/setTab from context, removes prop drilling

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Update AppShell (TDD)

**Files:**
- Modify: `client/src/components/AppShell.tsx`
- Modify: `tests/client/components/AppShell.test.tsx`

---

- [ ] **Step 1: Add failing test to AppShell.test.tsx**

Add this test inside the existing `describe('AppShell', ...)` block in `tests/client/components/AppShell.test.tsx`, after the last existing test:

```tsx
  it('renders Overview and Trends tabs when hasTabs is true', () => {
    render(
      <MemoryRouter initialEntries={['/recovery']}>
        <AppShell section="recovery" hasTabs>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Trends')).toBeInTheDocument()
  })
```

No new imports needed — `MemoryRouter` is already imported in this test file.

- [ ] **Step 2: Run to check current state**

```bash
cd /opt/bacta && npm run test:client -- --reporter=verbose AppShell 2>&1 | tail -20
```

This test may already pass because AppShell passes `hasTabs` to BottomBar (which now renders tabs from context). Confirm it runs and passes or note the failure reason.

- [ ] **Step 3: Update AppShell.tsx**

In `client/src/components/AppShell.tsx`, find the `<TabContext.Provider ...>` block through the closing `</BottomBar>` line and replace it. The exact block to replace:

```tsx
      <TabContext.Provider value={tab}>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overscrollBehavior: 'none',
            padding: '13px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </div>
      </TabContext.Provider>

      <BottomBar
        accent={accent}
        hasTabs={hasTabs}
        tab={tab}
        onTabChange={setTab}
        onAsk={() => setAskOpen(true)}
        onNav={() => setNavOpen(true)}
      />
```

Replace with:

```tsx
      <TabContext.Provider value={{ tab, setTab }}>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overscrollBehavior: 'none',
            padding: '13px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </div>
        <BottomBar
          accent={accent}
          hasTabs={hasTabs}
          onAsk={() => setAskOpen(true)}
          onNav={() => setNavOpen(true)}
        />
      </TabContext.Provider>
```

Note: `TabContext.Provider` renders no DOM node — the content div and BottomBar remain direct flex children of the outer AppShell column div. Layout is unchanged.

- [ ] **Step 4: Run full test suite**

```bash
cd /opt/bacta && npm run test:client 2>&1 | tail -8
```

Expected: all tests pass.

- [ ] **Step 5: Type-check**

```bash
cd /opt/bacta && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. This is the definitive check — the TypeScript mismatch from Task 1 (`value={tab}` vs `value={{ tab, setTab }}`) is now resolved.

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add client/src/components/AppShell.tsx tests/client/components/AppShell.test.tsx && git commit -m "$(cat <<'EOF'
refactor: AppShell provides TabContext with setter, cleans up tab prop drilling

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Production build and Playwright verification

**Files:** None changed.

---

- [ ] **Step 1: Build and restart**

```bash
cd /opt/bacta && npm run build 2>&1 | tail -5 && sudo systemctl restart bacta-api.service && sleep 2 && systemctl is-active bacta-api.service
```

Expected: build succeeds, `active`.

- [ ] **Step 2: Playwright — tab toggle on Training page**

Use Playwright MCP at viewport 390×844 on `http://localhost:3001/training`.

1. Screenshot initial state — Overview tab active, training overview content visible
2. Click the Trends button in the bottom dock
3. Screenshot — Trends content visible, Trends button highlighted
4. Click Overview button
5. Screenshot — Overview content visible, Overview button highlighted

Verify: toggle works exactly as before visually — same octagon shape, same cyan active color, same content switch.

- [ ] **Step 3: Playwright — tab resets on navigation**

1. Click Trends on Training page
2. Navigate to Recovery (via back button or nav sheet)
3. Screenshot Recovery page — Overview tab should be active (reset on remount)

Verify: Overview is the active tab on a freshly loaded section.
