# Bacta MX-4 OS — Design Spec

**Date:** 2026-05-29
**Status:** Approved
**Reference:** `design_handoff_mx4_home/` — high-fidelity prototype, pixel-faithful target.

---

## Overview

Full visual redesign of Bacta's UI to the **"MX-4 OS"** concept produced in Claude Design. The app reads like an instrument MX-4 operates: a system status bar, incoming transmission briefing panel, bracketed System Cards, and a global scanline/grid texture. MX-4's signature color is **bacta-cyan (`#2bc4e8`)** — named after the Star Wars healing fluid that the app itself is named for.

The key design move: MX-4 adopts the active section's channel color when you enter a section. Status bar, dock, transmission panel, and texture all shift to the channel color. He's wearing the room.

Implemented in two sequential plans. Plan 1 ships the chrome (shell). Plan 2 ships the content (cards and pages).

---

## Design Reference

All visual decisions are final and specified in the handoff:
- `design_handoff_mx4_home/README.md` — authoritative spec
- `design_handoff_mx4_home/design/bacta-core.jsx` — tokens, SVG primitives
- `design_handoff_mx4_home/design/bacta-final.jsx` — shell components + HomeBody
- `design_handoff_mx4_home/design/bacta-navsheet.jsx` — Sheet, NavSheet, AskSheet
- `design_handoff_mx4_home/design/bacta-app.jsx` — AppShell composition + SectionShell

The prototype JSX is inline-styles React (Babel) — translates directly to our Vite + TypeScript + inline-styles codebase. **Do not copy verbatim** — reimplement in TypeScript following existing patterns.

---

## Tech Stack

React 19 + TypeScript + Vite + inline styles. No CSS modules, no Tailwind. React Router v7. Vitest + Testing Library. Google Fonts via `<link>` in `index.html`.

---

## Design Tokens

### New / updated in `client/src/theme.ts`

```ts
export const MX4_COLOR = '#2bc4e8'   // bacta-cyan — MX-4 identity

export const COLORS = {
  base:            '#0f1117',
  surface:         '#111827',
  surfaceElevated: '#1e2d3d',
  border:          '#1e2d3d',
  line:            '#27384a',   // NEW — dividers, chip borders
  text:            '#f4f7fb',   // updated (was #ffffff)
  textSecondary:   '#94a3b8',
  textMuted:       '#56657a',   // updated (was #475569)
  mx4Green:        '#4ade80',
  mx4Amber:        '#fbbf24',
  mx4Red:          '#f87171',
} as const

export const SECTION_ACCENTS: Record<SectionKey, string> = {
  home:      '#4ade80',   // unchanged
  recovery:  '#7c9af8',   // periwinkle (was #64b5f6)
  training:  '#f5853a',   // ember (was #fb923c)
  sleep:     '#b08cf0',   // lilac (was #a78bfa)
  nutrition: '#3ecf8e',   // clinical green (was #34d399)
  bloodwork: '#ef6f6c',   // coral (was #f87171)
  dailylog:  '#f5cf5e',   // gold (was #fbbf24)
}
```

Cyan band (`#2bc4e8` ±) is reserved exclusively for MX-4. No section accent falls in that band by design.

### Fonts

Add to `client/index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- **`Hanken Grotesk`** — all UI text, body copy, section labels
- **`JetBrains Mono`** — all data values, chrome labels, metadata, chips, mono accents

Export font constants from `theme.ts`:
```ts
export const FONT_UI   = "'Hanken Grotesk', system-ui, sans-serif"
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
```

### CSS Keyframes

Add to `client/index.css` (global, referenced by name in inline `animation` strings):

```css
@keyframes mx4spin        { to { transform: rotate(360deg); } }
@keyframes mx4breathe     { 0%,100% { transform: scale(0.82); opacity: 0.7; } 50% { transform: scale(1); opacity: 1; } }
@keyframes mx4ping        { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.4); opacity: 0; } }
@keyframes mx4tele        { 0%,100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
@keyframes mx4blink       { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes mx4glowbreathe { 0%,100% { box-shadow: 0 0 8px var(--mx4-accent,#2bc4e8); } 50% { box-shadow: 0 0 20px var(--mx4-accent,#2bc4e8); } }
@keyframes mx4shimmer     { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```

---

## Utility Functions

### `client/src/lib/hexA.ts`
```ts
export function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
```

### `client/src/lib/bactaTexture.ts`
```ts
import { hexA } from './hexA'
export function bactaTexture(accent: string): React.CSSProperties {
  const a = (x: number) => hexA(accent, x)
  return {
    backgroundImage:
      `repeating-linear-gradient(0deg, rgba(255,255,255,0.016) 0px, rgba(255,255,255,0.016) 1px, transparent 1px, transparent 3px),` +
      `linear-gradient(${a(0.035)} 1px, transparent 1px), linear-gradient(90deg, ${a(0.035)} 1px, transparent 1px)`,
    backgroundSize: '100% 3px, 26px 26px, 26px 26px',
  }
}
```

---

## SVG Primitive Components

All in `client/src/components/primitives/`. Each is a focused React component with no side effects. Tests: renders without crashing + key visual props reflected in output.

### `MX4Sigil.tsx`
Exports `MX4Sigil` component and `MX4Mood` type:
```ts
export type MX4Mood = 'transmit' | 'idle' | 'listen' | 'think' | 'alert' | 'pleased'
```
Props: `color: string`, `size?: number` (default 40), `spin?: boolean`, `glow?: boolean`, `mood?: MX4Mood` (default `'transmit'`).

Six moods (see `bacta-core.jsx` for exact SVG paths — copy faithfully):
- `transmit` — full concentric rings + spinning dashed outer ring + core dot
- `idle` — calm single ring + side ticks + small core
- `listen` — open lens/eye shape + pupil dot (used on Ask button)
- `think` — spinning dashed ring + scan line dashes (used during loading)
- `alert` — narrow slit rect core + tight ring
- `pleased` — upward squint arc + low dot (used in Ask greeting)

`spin` slowly rotates the aperture via `mx4spin 14s linear infinite`. `glow` adds a `feGaussianBlur` filter. ViewBox `0 0 48 48`.

### `Sigil.tsx`
Per-section geometric glyph. Props: `name: Exclude<SectionKey, 'home'>`, `color?: string`, `size?: number` (default 18), `sw?: number` (strokeWidth, default 1.6). ViewBox `0 0 24 24`, all stroked, no fill. Six shapes (from `bacta-core.jsx`):
- `recovery` — dashed circle arc + core dot
- `training` — two chevron-up lines
- `sleep` — crescent moon path
- `nutrition` — hexagon
- `bloodwork` — rotated square + horizontal line
- `dailylog` — three horizontal lines (staggered)

### `NavIcon.tsx`
Props: `color?: string` (default `#94a3b8`), `size?: number` (default 22). Stroked hexagon (MX-4's shape) + 3 menu lines inside. ViewBox `0 0 24 24`.

### `Ring.tsx`
Circular progress. Props: `progress: number` (0–1), `accent: string`, `size?: number` (default 40), `stroke?: number` (default 4), `track?: string`, `children?: ReactNode`. SVG rotated -90deg for 12-o'clock start. Children centered via absolute positioning.

### `Sparkline.tsx`
Props: `data: number[]`, `accent: string`, `w?: number` (default 92), `h?: number` (default 30), `sw?: number` (strokeWidth, default 1.8), `fill?: boolean` (default true), `dot?: boolean` (default true). Linear gradient area fill + line path + terminal dot. Each render uses a unique gradient id.

### `StatusCore.tsx`
Breathing/pinging status dot. Props: `accent?: string` (default `#4ade80`), `size?: number` (default 8), `active?: boolean` (default true). Two layers: ping ring (`mx4ping` animation) + solid dot (`mx4breathe`). When `active=false`: static dim dot, no animation.

### `ReadinessDots.tsx`
Props: `value: number`, `total?: number` (default 5), `accent: string`, `size?: number` (default 7). Filled dots (with glow) up to `value`, outlined after.

### `Bracket.tsx`
Corner tick decoration for cards. Props: `color: string`, `size?: number` (default 11), `sw?: number` (default 1.4), `op?: number` (default 0.55), `inset?: number` (default 7), `radius?: number` (default 4). Four absolute-positioned `<span>` elements with partial border + border-radius. `position: absolute` on parent card required.

### `FTelemetry.tsx`
Animated bar telemetry (like audio level). Props: `color?: string` (default MX4_COLOR), `bars?: number` (default 5). Row of 2px-wide bars, each scaling vertically via `mx4tele` with staggered delays.

---

## Plan 1 — Design System + Shell

### File Map

| Action | File |
|---|---|
| Modify | `client/src/theme.ts` |
| Modify | `client/index.html` |
| Modify | `client/index.css` |
| Create | `client/src/lib/hexA.ts` |
| Create | `client/src/lib/bactaTexture.ts` |
| Create | `client/src/components/primitives/MX4Sigil.tsx` |
| Create | `client/src/components/primitives/Sigil.tsx` |
| Create | `client/src/components/primitives/NavIcon.tsx` |
| Create | `client/src/components/primitives/Ring.tsx` |
| Create | `client/src/components/primitives/Sparkline.tsx` |
| Create | `client/src/components/primitives/StatusCore.tsx` |
| Create | `client/src/components/primitives/ReadinessDots.tsx` |
| Create | `client/src/components/primitives/Bracket.tsx` |
| Create | `client/src/components/primitives/FTelemetry.tsx` |
| Rewrite | `client/src/components/TopBar.tsx` → BactaStatusBar |
| Rewrite | `client/src/components/BottomBar.tsx` → BactaDock |
| Rewrite | `client/src/components/BottomSheet.tsx` → NavSheet + Sheet wrapper |
| Create | `client/src/components/AskSheet.tsx` |
| Rewrite | `client/src/components/AppShell.tsx` |
| Modify | `tests/client/components/TopBar.test.tsx` |
| Rewrite | `tests/client/components/BottomBar.test.tsx` |
| Rewrite | `tests/client/components/AppShell.test.tsx` |
| Rewrite | `tests/client/components/BottomSheet.test.tsx` |
| Create | `tests/client/components/AskSheet.test.tsx` |
| Create | `tests/client/components/primitives/MX4Sigil.test.tsx` |
| Create | `tests/client/components/primitives/Sigil.test.tsx` |
| Create | `tests/client/components/primitives/Ring.test.tsx` |
| Create | `tests/client/components/primitives/Sparkline.test.tsx` |
| Create | `tests/client/components/primitives/StatusCore.test.tsx` |

### Component Specs

#### `TopBar.tsx` → `BactaStatusBar`

Export: `BactaStatusBar`

```tsx
interface BactaStatusBarProps {
  section: SectionKey
  onBack?: () => void   // if provided → section mode; else → home mode
}
```

Home mode (`onBack` undefined):
- Left: `MX4Sigil` (cyan, size 18, spin, mood "idle") + `BACTA` + `·OS` (text3 color, mono)
- Right: `StatusCore` (green, size 6) + `MX-4 ONLINE` (green, mono 9.5px, 0.08em tracking)

Section mode (`onBack` defined):
- Left: back chevron button (calls onBack) + `Sigil` (channel color, size 16) + section label (channel color, mono 11.5px 700 0.12em tracking)
- Right: same ONLINE indicator

Both: `paddingTop: 50px`, 1px bottom border in `hexA(accent, 0.28)`, faint glow `0 1px 0 hexA(accent, 0.12)`, `rgba(17,24,39,0.92)` bg.

Accent: `section === 'home' ? MX4_COLOR : SECTION_ACCENTS[section]`.

#### `BottomBar.tsx` → `BactaDock`

Export: `BactaDock`

```tsx
interface BactaDockProps {
  accent: string
  onAsk: () => void
  onNav: () => void
}
```

Left button — Ask MX-4:
- 44px circle: `radial-gradient(circle, hexA(accent,0.13), hexA(accent,0.03) 70%)` fill, `1px solid hexA(accent,0.55)` border, `mx4glowbreathe` animation
- Contains `MX4Sigil` (accent color, size 28, glow, mood "listen")
- Right of circle: "Ask MX-4" (Hanken 13.5px 650) + "TAP TO TALK" (mono 8.5px text3 0.12em)

Right button — Nav:
- 44px circle: `base` fill, `1px solid line` border (neutral)
- Contains `NavIcon` (text2 color, size 26)

Container: `rgba(17,24,39,0.92)` bg, `1px solid hexA(accent, 0.28)` top border, `padding: 10px 18px calc(10px + env(safe-area-inset-bottom))`.

#### `BottomSheet.tsx` → `NavSheet` + `Sheet`

Exports: `Sheet`, `NavSheet`

`Sheet` wrapper — animated open/close:
- `open` → double rAF → `shown=true` → translateY 0 + backdrop fade. `!open` → `shown=false` → 340ms timeout → unmount.
- Backdrop: `position:fixed; inset:0; zIndex:40`. When shown: `rgba(6,9,14,0.62)` + `blur(3px)`. Click backdrop → `onClose`.
- Panel: `maxHeight` prop (default 82%), `translateY(101% → 0)` transition `0.36s cubic-bezier(.22,.61,.36,1)`.
- Click panel → `e.stopPropagation()`.

`NavSheet` — All Systems navigation:
- Uses `Sheet` with `maxHeight="86%"`
- `SheetShell`: surface bg, rounded-22 top, cyan top border, texture overlay, grab handle (38×4px pill)
- Header: NavIcon (cyan) + "ALL SYSTEMS" (cyan mono 12.5px 700 0.14em) + "SELECT A CHANNEL" sub + circular × close button
- Home·Overview row: full-width button, idle MX4Sigil chip (40×40, cyan), "Home · Overview" + "6 systems nominal" sub, right chevron. Active state: cyan tint bg + cyan border.
- CHANNELS divider: mono "CHANNELS" label + 1px line
- 2-col channel grid: each button has Bracket + top accent edge + 32×32 Sigil chip + label + value+unit+status. Active: channel tint bg + channel border.
- Footer: idle MX4Sigil (17px, spin, cyan) + "WHERE TO, COMMANDER?" (mono text2 0.08em) + FTelemetry

Navigation: `useNavigate` from React Router. Home → `'/'`, sections → `'/<sectionKey>'`. Calls `onClose` after navigating.

Props:
```tsx
interface NavSheetProps {
  open: boolean
  onClose: () => void
  currentSection: SectionKey
}
```

#### `AskSheet.tsx` (new)

Pure UI shell — no API calls.

```tsx
interface AskSheetProps {
  open: boolean
  onClose: () => void
  accent: string
}
```

Uses `Sheet` with `maxHeight="88%"`. Accent-colored top border + texture.

Header: transmit MX4Sigil (spin, glow, 30px) + "MX-4" (accent mono 12.5px 700) + "ASK ANYTHING · MEDICAL & PROTOCOL" sub + × close.

Greeting bubble: pleased MX4Sigil (26px) + tinted bubble (`hexA(accent,0.08)` bg, `hexA(accent,0.22)` border, `4px 14px 14px 14px` radius). Text: "Standing by, Commander. Ask me about any system, or I can walk your latest readouts. What do you need?"

SUGGESTED chips: 4 prompts ("How is my recovery trending?", "Plan today's training", "Why is my HRV up?", "Summarize my week"). Tapping a chip is a no-op (UI shell only).

Input bar: full-width text field (visual only, mono placeholder "Message MX-4" + blinking caret `mx4blink`) + 42×42 send button (accent border + tint fill, arrow-up icon). Send is no-op.

#### `AppShell.tsx`

```tsx
interface AppShellProps {
  section: SectionKey
  children: React.ReactNode
}
```

State: `navOpen: boolean`, `askOpen: boolean`.

Derived: `accent = section === 'home' ? MX4_COLOR : SECTION_ACCENTS[section]`

Render:
```
position:fixed; inset:0; display:flex; flex-direction:column
├── texture overlay div (position:absolute; inset:0; bactaTexture(accent); pointer-events:none; zIndex:0)
├── BactaStatusBar (section, onBack → navigate('/') when section !== 'home')
├── content div (flex:1; overflow-y:auto; overscroll-behavior:none; padding:13px; position:relative; zIndex:1)
│   └── {children}
├── BactaDock (accent, onAsk → setAskOpen(true), onNav → setNavOpen(true))
├── NavSheet (open=navOpen, onClose → setNavOpen(false), currentSection=section)
└── AskSheet (open=askOpen, onClose → setAskOpen(false), accent)
```

No tab props. No action props. All section pages: `<AppShell section="recovery">`.

### Navigation Model

React Router routes unchanged (`/`, `/recovery`, etc.). BactaStatusBar shows back chevron on any non-home section — calls `navigate('/')`. NavSheet navigates via `useNavigate`. The `home` section passes no `onBack` to BactaStatusBar → home mode renders.

### Tests

**`TopBar.test.tsx`** — updated:
- Home mode: renders `BACTA·OS` text, renders idle MX4Sigil (data-testid), renders `MX-4 ONLINE`
- Section mode: renders section label, renders back button, calls onBack when back clicked
- No accent-bar test (concept replaced)

**`BottomBar.test.tsx`** — rewritten:
- Renders Ask MX-4 button
- Renders nav button (data-testid="nav-button")
- Calls onAsk when Ask button clicked
- Calls onNav when nav button clicked

**`BottomSheet.test.tsx`** — rewritten as NavSheet:
- Renders nothing when closed
- Renders sheet when open
- Renders all 7 navigation items (Home + 6 sections)
- Calls onClose when backdrop clicked
- Calls onClose + navigates when section item clicked

**`AskSheet.test.tsx`** — new:
- Renders nothing when closed
- Renders greeting text when open
- Renders 4 suggested prompts
- Renders input field
- Calls onClose when × clicked

**`AppShell.test.tsx`** — rewritten:
- Renders children
- Renders BactaStatusBar (checks for BACTA·OS on home)
- Opens NavSheet when nav button clicked
- Opens AskSheet when Ask button clicked
- Closes NavSheet when backdrop clicked

**`MX4Sigil.test.tsx`** — renders all 6 moods without crashing, renders with spin/glow props.

**`Sigil.test.tsx`** — renders all 6 section sigils without crashing.

---

## Plan 2 — Content (Cards + Pages)

Runs after Plan 1 is merged.

### File Map

| Action | File |
|---|---|
| Rewrite | `client/src/components/MX4Card.tsx` → TransmissionPanel |
| Rewrite | `client/src/components/MetricTile.tsx` → SystemCard |
| Rewrite | `client/src/pages/HomePage.tsx` |
| Rewrite | `client/src/pages/RecoveryPage.tsx` → SectionShell |
| Rewrite | `client/src/pages/TrainingPage.tsx` → SectionShell |
| Rewrite | `client/src/pages/SleepPage.tsx` → SectionShell |
| Rewrite | `client/src/pages/NutritionPage.tsx` → SectionShell |
| Rewrite | `client/src/pages/BloodWorkPage.tsx` → SectionShell |
| Rewrite | `client/src/pages/DailyLogPage.tsx` → SectionShell |
| Create | `client/src/components/SectionShell.tsx` |
| Rewrite | `tests/client/components/MX4Card.test.tsx` |
| Rewrite | `tests/client/components/MetricTile.test.tsx` |
| Modify | `tests/client/App.test.tsx` |

### Component Specs

#### `MX4Card.tsx` → `TransmissionPanel`

Export: `TransmissionPanel`

```tsx
interface TransmissionPanelProps {
  accent: string
  mood?: MX4Mood   // default 'transmit'
  label?: string   // default 'INCOMING // MX-4'
  meta?: string    // right-aligned timestamp e.g. 'MON · MAY 29 · 06:00'
  assessment: string
  chips?: [string, string][]  // default [['TONE','POSITIVE'],['FLAGS','0'],['SYNC','OK']]
}
```

Styling: rounded-14 card, `linear-gradient(160deg, hexA(accent,0.10), surface 50%)` bg, `1px solid hexA(accent,0.35)` border, outer + inner glow. Header: spinning MX4Sigil (accent, size 19) + mono label (accent, 9px 600 0.16em) + meta (text3). Body: assessment paragraph (Hanken 16.5px/1.5, `#eef4fb`) + blinking accent caret. Footer (top border `hexA(accent,0.16)`): chip row + FTelemetry.

#### `MetricTile.tsx` → `SystemCard`

Export: `SystemCard`

```tsx
type VizType = 'spark' | 'ring' | 'dots' | 'shield'

interface SystemCardTile {
  key: Exclude<SectionKey, 'home'>
  value: string
  unit: string
  sub: string
  viz: VizType
  spark?: number[]
  ring?: number       // 0–1
  dots?: number       // filled dot count
  status: string
}

interface SystemCardProps {
  tile: SystemCardTile
  index: number       // 0–5, renders as '01'–'06'
  onClick?: () => void
}
```

Styling: surface bg, `1px solid line` border, radius 7, `position:relative`, `minHeight:116px`. Absolute Bracket corners (channel color, op 0.5). Top accent edge: `position:absolute; top:0; left:0; right:0; height:2px; linear-gradient(90deg, accent, transparent 80%)`.

Header row: Sigil (channel color, size 14) + section label (mono 9.5px 600 0.12em text2 uppercase) + index (mono 8.5px text3, `padStart(2,'0')`).

Value row: large value (mono 22px 700, `#f4f7fb`, letterSpacing -0.01em) + unit (mono 10px text3).

Sub-line: mono 10px text2.

Viz (bottom of card, marginTop auto):
- `spark` → Sparkline (channel color, w 140, h 24, sw 1.6)
- `ring` → Ring (channel color, size 38, stroke 3) with percentage label inside
- `dots` → ReadinessDots (channel color)
- `shield` → checkmark SVG (stroke channel color, strokeWidth 2.4) + `status.toUpperCase()` in mono 9.5px accent

Ring also positioned absolute top-right (top 30, right 12).

#### `HomePage.tsx`

Inside `AppShell section="home"`:

1. `TransmissionPanel` — accent MX4_COLOR, mood "transmit", label "INCOMING // MX-4", meta "MON · MAY 29 · 06:00", assessment from mock data, chips default.

2. SYSTEMS rail — `display:flex; alignItems:center; gap:9; marginBottom:9`:
   - "SYSTEMS" (mono 9px 0.2em MX4_COLOR)
   - Gradient divider `linear-gradient(90deg, hexA(MX4_COLOR,0.4), line)`
   - "6 ONLINE" (mono 9px text3)

3. 2-col SystemCard grid (gap 9) — 6 tiles in order: recovery, training, sleep, nutrition, bloodwork, dailylog. Each `onClick` → `navigate('/<key>')`.

Mock tile data (matches handoff exactly):
```ts
const TILES = [
  { key:'recovery',  value:'74',    unit:'battery', sub:'HRV ↑ 61ms',          viz:'spark',  spark:[50,54,49,57,55,60,66,74],           status:'Good'      },
  { key:'training',  value:'342',   unit:'load',    sub:'Moderate · wk 4 / 8', viz:'spark',  spark:[280,300,260,320,340,310,330,342],    status:'On track'  },
  { key:'sleep',     value:'8.1',   unit:'h',       sub:'Score 82',             viz:'ring',   ring:0.82,                                 status:'Solid'     },
  { key:'nutrition', value:'2,340', unit:'kcal',    sub:'Protein 142 / 160g',  viz:'ring',   ring:0.94,                                 status:'On target' },
  { key:'bloodwork', value:'Clear', unit:'',        sub:'No flags · 0 panels', viz:'shield',                                            status:'Nominal'   },
  { key:'dailylog',  value:'4',     unit:'/ 5',     sub:'Logged today',         viz:'dots',   dots:4,                                   status:'Logged'    },
]
```

#### Section Pages → SectionShell pattern

All 6 section pages follow the same pattern. Each is a thin wrapper around AppShell that renders a shell body. The shell body is the same structure for every section — only the accent color and label differ (derived from `section` prop via `SECTION_ACCENTS` and `SECTION_LABELS`).

Shell body content (rendered as `children` of AppShell):

1. `TransmissionPanel` — accent = channel color, mood "transmit", label `MX-4 // ${SECTION_LABELS[section].toUpperCase()}`, meta "STANDBY", assessment = section greeting (one per section, see below), chips `[['CH', sectionLabel.toUpperCase()], ['DATA', 'PENDING']]`.

2. Channel rail:
   - Section label (mono 9px 0.2em, channel color)
   - Gradient divider
   - "CALIBRATING" (mono 9px text3)

3. 3 shimmer skeleton cards — each: surface bg, `1px solid line` border, radius 9, `position:relative`, Bracket corners (channel color, op 0.32). Inside: icon placeholder div (22×22 `hexA(accent,0.14)` bg) + shimmer bar, then 7 shimmer bars of varying heights.

   `shimmerBar(accent)` style: `linear-gradient(90deg, hexA(accent,0.06) 25%, hexA(accent,0.16) 50%, hexA(accent,0.06) 75%)`, `backgroundSize:200% 100%`, `animation:mx4shimmer 1.6s ease-in-out infinite`.

4. Footer: `think` MX4Sigil (channel color, size 15, spin) + "MX-4 IS CALIBRATING THIS SYSTEM" (mono 9.5px text3 0.1em).

**Section greeting strings:**
- recovery: `'Recovery channel online. Battery and HRV trends will surface here once the system is wired in.'`
- training: `'Training channel online. Load, blocks, and session protocols will populate here.'`
- sleep: `'Sleep channel online. Stages, score, and debt readouts will live here.'`
- nutrition: `'Nutrition channel online. Intake, macros, and targets will surface here.'`
- bloodwork: `'Blood Work channel online. Panels, biomarkers, and flags will populate here.'`
- dailylog: `'Daily Log channel online. Your entries and check-ins will live here.'`

Since all 6 sections use the same shell, implement a shared `SectionShell` component in `client/src/components/SectionShell.tsx` and use it in each page:

```tsx
// RecoveryPage.tsx
export function RecoveryPage() {
  return <AppShell section="recovery"><SectionShell section="recovery" /></AppShell>
}
```

`SectionShell` takes `section: Exclude<SectionKey, 'home'>` and renders the full shell body. Lives in `client/src/components/SectionShell.tsx`.

### Tests

**`MX4Card.test.tsx`** — rewritten as TransmissionPanel:
- Renders assessment text
- Renders label prop
- Renders chips

**`MetricTile.test.tsx`** — rewritten as SystemCard:
- Renders value and unit
- Renders section label
- Renders index formatted as two digits
- Calls onClick when clicked

**`App.test.tsx`** — updated:
- "renders recovery page" checks for `'Recovery channel online'` (not `'Body Battery'`)
- "renders sleep page" checks for `'Sleep channel online'` (not `'Sleep Score'`)

---

## Accent Color Rule

This is the key behavioral rule — enforced in `AppShell`:

```ts
const accent = section === 'home' ? MX4_COLOR : SECTION_ACCENTS[section]
```

This accent flows to: BactaStatusBar border/glow, BactaDock Ask button, NavSheet top border, AskSheet top border, texture grid lines, TransmissionPanel border/glow, SystemCard tops and brackets, channel rail, shimmer bars.

Sections never use MX4_COLOR. MX-4 uses it exclusively unless wearing a section's color.

---

## What Does NOT Change

- `client/src/App.tsx` — routes unchanged
- `client/src/main.tsx` — unchanged
- `manifest.json` — unchanged
- Server code — unchanged
- `SectionKey` type — unchanged
- `SECTION_LABELS`, `SECTION_ICONS` exports — unchanged (ICONS now unused in UI, kept for reference)
