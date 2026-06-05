# Spec: Tab Toggle Refactor
**Date:** 2026-06-05  
**Scope:** Remove `tab`/`onTabChange` prop-drilling from AppShell → BottomBar; make BottomBar self-sufficient via context

---

## Background

`AppShell` currently owns `tab` state and passes it down as props to `BottomBar`. `TabContext.Provider` wraps only the content div (children), so `BottomBar` — a sibling — cannot read from context and must receive `tab`/`onTabChange` as props. CLAUDE.md flags this as known residue: "the tab toggle belongs in BottomBar itself keyed off `hasTabs`."

The fix: extend `TabContext` to carry both the value and its setter, move the provider to wrap both the content div and `BottomBar`, and remove the two redundant props.

---

## Changes

### `client/src/lib/TabContext.ts`

Change context value type from `Tab` to `{ tab: Tab; setTab: (t: Tab) => void }`.

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

`useTab()` still returns `Tab` — all page call sites (`RecoveryPage`, `SleepPage`, `TrainingPage`, `HomePage`) are unchanged.

---

### `client/src/components/AppShell.tsx`

Two changes:
1. Provider wraps a new inner wrapper div that contains both the scrollable content area and `BottomBar`.
2. `tab` and `onTabChange` props removed from the `<BottomBar>` JSX call.

`useState<Tab>('overview')` stays in AppShell — ensures tab resets to overview on every navigation (AppShell remounts per route).

Before (abridged):
```tsx
<TabContext.Provider value={tab}>
  <div style={{ flex: 1, overflowY: 'auto', ... }}>{children}</div>
</TabContext.Provider>

<BottomBar
  accent={accent}
  hasTabs={hasTabs}
  tab={tab}
  onTabChange={setTab}
  onAsk={...}
  onNav={...}
/>
```

After:
```tsx
<TabContext.Provider value={{ tab, setTab }}>
  <div style={{ flex: 1, overflowY: 'auto', ... }}>{children}</div>
  <BottomBar
    accent={accent}
    hasTabs={hasTabs}
    onAsk={...}
    onNav={...}
  />
</TabContext.Provider>
```

`TabContext.Provider` renders no DOM node — it does not affect layout. The content div (`flex: 1, overflowY: auto`) and `BottomBar` (`flexShrink: 0`) remain direct flex children of the outer AppShell column div, so the layout is unchanged.

The `BottomSheet` and `AskSheet` remain outside the provider (they don't consume tab state).

---

### `client/src/components/BottomBar.tsx`

Remove `tab` and `onTabChange` from `BottomBarProps`. Add `useContext(TabContext)` inside the component body to obtain both values.

```ts
// Props — before
interface BottomBarProps {
  accent: string
  hasTabs: boolean
  tab: Tab
  onTabChange: (t: Tab) => void
  onAsk: () => void
  onNav: () => void
}

// Props — after
interface BottomBarProps {
  accent: string
  hasTabs: boolean
  onAsk: () => void
  onNav: () => void
}
```

Inside `BottomBar`:
```ts
const { tab, setTab } = useContext(TabContext)
```

`SectionTabs` receives `onTab={setTab}` (same as before, just sourced from context instead of props).

The `accent` prop is unused in the current BottomBar body (not referenced after the prop signature) — leave it in place, it may be used for future accent-tinted states.

---

## Tests

### `tests/client/components/BottomBar.test.tsx`

Add two tests (existing 5 tests unchanged):

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
```

### `tests/client/components/AppShell.test.tsx`

Add one test (existing 6 tests unchanged):

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

---

## Out of scope

- Visual appearance of the tab toggle — unchanged
- `hasTabs` prop on AppShell — unchanged
- Page components — unchanged (`useTab()` return type is still `Tab`)
- `BottomSheet`, `AskSheet` — unchanged
- Tab persistence across navigation — not implemented (reset on remount is correct behavior)
