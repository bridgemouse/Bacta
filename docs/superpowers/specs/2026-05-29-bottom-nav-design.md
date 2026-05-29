# Bottom Navigation Redesign

**Goal:** Replace the side drawer + PageShell navigation with a fixed top bar + fixed bottom bar (contextual actions) + auto-height bottom sheet drawer. Fixes iOS PWA scroll by making only the content area scrollable.

**Architecture:** Four new components — `TopBar`, `BottomBar`, `BottomSheet`, `AppShell` — replace `PageShell`, `Drawer`, and `DrawerItem`. App state for drawer open/close moves into `AppShell`. Each page component declares its own bottom bar action stubs and passes them to `AppShell`.

**Tech Stack:** React 19, TypeScript, inline styles (existing project pattern), React Router v7 `useNavigate` / `useLocation`

**Inspiration:** Overseerr mobile PWA — bottom sheet that is auto-height (fits content, does not force full screen).

---

## Layout

```
┌──────────────────────────────────┐
│  TopBar (fixed, safe-area-top)   │
│  "Recovery"  ────────  ● MX-4    │
│   [accent underline]             │
├──────────────────────────────────┤
│                                  │
│  Content area (flex: 1,          │
│  overflow-y: auto,               │
│  overscroll-behavior: none)      │
│                                  │
├──────────────────────────────────┤
│  BottomBar (fixed, safe-area-bot)│
│  🔄 Sync  ✏️ Manual       ☰ Menu │
└──────────────────────────────────┘
```

`AppShell` is `position: fixed; inset: 0; display: flex; flex-direction: column`. This prevents iOS page-level scroll entirely — the only scrollable zone is the content area.

---

## Components

### `TopBar`

**Props:** `section: SectionKey`

Renders a fixed-height header bar. Left zone is empty (spacer). Center shows the section label with a 2px accent-color underline below it. Right shows `● MX-4` in `COLORS.mx4Green`.

Uses `SECTION_LABELS[section]` and `SECTION_ACCENTS[section]` from `theme.ts`. Adds `paddingTop: env(safe-area-inset-top)` to clear the iOS status bar.

Home section: center label shows `"Bacta"`, accent underline color is `SECTION_ACCENTS.home` (`#4ade80`).

### `BottomBar`

**Props:**
```ts
interface BottomAction {
  icon: string   // emoji
  label: string
  onClick: () => void
}

interface BottomBarProps {
  actions: BottomAction[]   // 0–3 items; rendered left-aligned
  onMenuOpen: () => void
}
```

Fixed-height footer bar. Left side renders `actions` as icon + label buttons (no-op stubs initially). Right side is always the `☰` / Menu button that calls `onMenuOpen`. Adds `paddingBottom: env(safe-area-inset-bottom)`.

### `BottomSheet`

**Props:** `isOpen: boolean`, `onClose: () => void`, `activeSection: string`

When `isOpen` is false, renders nothing. When open:
- Overlay: `position: fixed; inset: 0; background: rgba(0,0,0,0.55); zIndex: 40` — tap to close.
- Sheet panel: `position: fixed; bottom: 0; left: 0; right: 0; zIndex: 50; background: COLORS.surface; border-radius: 14px 14px 0 0`. **Height is auto** — no forced height or `max-height`. The sheet grows to fit its content and no more.
- Drag handle: centered pill at top of panel.
- Profile header: avatar ("E", gradient) + "Ethan" + `● MX-4 online` in `COLORS.mx4Green`.
- Section list: all 7 `SectionKey` items as rows with icon + label. Active section highlighted with `accent + '18'` background and accent-colored label text. Tapping any section navigates and closes the sheet.

Navigation uses `useNavigate` from React Router: home → `'/'`, others → `'/<section>'`.

### `AppShell`

`BottomAction` is exported from `BottomBar.tsx` and imported by `AppShell.tsx` and each page component that defines actions.

**Props:**
```ts
interface AppShellProps {
  section: SectionKey
  actions?: BottomAction[]   // defaults to []
  children: React.ReactNode
}
```

Composes the full screen layout:
1. `TopBar` (section)
2. Content div (`flex: 1; overflow-y: auto; overscroll-behavior: none; padding: 14px 16px`)
3. `BottomBar` (actions, onMenuOpen)
4. `BottomSheet` (isOpen, onClose, activeSection)

Manages `bottomSheetOpen` state internally. `App.tsx` no longer holds drawer state.

Outer container: `position: fixed; inset: 0; display: flex; flex-direction: column; background: COLORS.base`.

---

## Files

| Action | File |
|--------|------|
| Create | `client/src/components/TopBar.tsx` |
| Create | `client/src/components/BottomBar.tsx` |
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
| Modify | `tests/client/components/PageShell.test.tsx` → replaced with `AppShell.test.tsx` |

---

## Page Action Stubs

All `onClick` handlers are no-ops (`() => {}`) until the section is built out.

| Section | Bottom bar actions |
|---------|-------------------|
| Home | *(none — drawer button only)* |
| Recovery | 🔄 Sync, ✏️ Manual |
| Training | ✏️ Log, 🔄 Sync |
| Sleep | 🔄 Sync, ✏️ Manual |
| Nutrition | 📝 Log, 🔄 Sync |
| Blood Work | 📤 Upload, 📊 History |
| Daily Log | 💾 Save |

---

## App.tsx Changes

Remove `drawerOpen` state and `onMenuOpen` prop passing. Each `<Route>` renders its page component directly — no extra props needed. `AppShell` handles everything internally.

```tsx
<Routes>
  <Route path="/"          element={<HomePage />} />
  <Route path="/recovery"  element={<RecoveryPage />} />
  ...
</Routes>
```

---

## Tests

Delete `tests/client/components/PageShell.test.tsx`. Create `tests/client/components/AppShell.test.tsx` covering:

- Renders children inside the content area
- TopBar shows the correct section label
- BottomBar renders provided action buttons
- BottomBar ☰ button opens the BottomSheet
- BottomSheet overlay click closes the sheet
- BottomSheet shows all 7 sections
- BottomSheet active section is highlighted
- Clicking a section in BottomSheet navigates and closes the sheet

Delete `tests/client/components/Drawer.test.tsx` if it exists.

---

## iOS Scroll Fix

The `AppShell` outer container is `position: fixed; inset: 0`. This removes the page-level document from iOS's scroll coordinate system entirely. The only element that can scroll is the content div (`overflow-y: auto`). Safari cannot bounce-scroll anything outside that div. This is the same pattern used by Overseerr and other production PWAs.

`index.css` retains `overflow: hidden` on `html, body, #root` as a belt-and-suspenders guard, but `AppShell` being fixed is the primary mechanism.
