# MX-4 OS — Plan 1: Design System + Shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bacta's placeholder chrome with the MX-4 OS visual system — design tokens, SVG sigils, animated status bar, BactaDock, NavSheet, and AskSheet. The app shell becomes the high-fidelity MX-4 OS experience from the Claude Design handoff.

**Architecture:** All new components use React inline styles (no CSS modules, no Tailwind). Primitive SVG components in `client/src/components/primitives/` — no dependencies. Shell components rewrite existing files in-place to preserve import paths. Global CSS keyframes in `index.css`, referenced by name in `animation` strings.

**Tech Stack:** React 19, TypeScript, Vite, inline styles, React Router v7, Vitest + Testing Library

---

## File Map

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
| Rewrite | `client/src/components/BottomSheet.tsx` → NavSheet + Sheet |
| Create | `client/src/components/AskSheet.tsx` |
| Rewrite | `client/src/components/AppShell.tsx` |
| Rewrite | `tests/client/components/TopBar.test.tsx` |
| Rewrite | `tests/client/components/BottomBar.test.tsx` |
| Rewrite | `tests/client/components/BottomSheet.test.tsx` |
| Create | `tests/client/components/AskSheet.test.tsx` |
| Rewrite | `tests/client/components/AppShell.test.tsx` |
| Create | `tests/client/components/primitives/MX4Sigil.test.tsx` |
| Create | `tests/client/components/primitives/Sigil.test.tsx` |
| Create | `tests/client/components/primitives/Ring.test.tsx` |
| Create | `tests/client/components/primitives/Sparkline.test.tsx` |
| Create | `tests/client/components/primitives/StatusCore.test.tsx` |
| Modify | `tests/client/App.test.tsx` |

---

## Task 1: Design tokens + fonts + keyframes

Update `theme.ts` with the MX-4 OS token set, add Google Fonts to `index.html`, add CSS keyframes to `index.css`.

**Files:**
- Modify: `client/src/theme.ts`
- Modify: `client/index.html`
- Modify: `client/index.css`

- [ ] **Step 1: Update `client/src/theme.ts`**

Replace the entire file:

```ts
export type SectionKey = 'home' | 'recovery' | 'training' | 'sleep' | 'nutrition' | 'bloodwork' | 'dailylog'

export const MX4_COLOR = '#2bc4e8'   // bacta-cyan — MX-4 identity

export const COLORS = {
  base:            '#0f1117',
  surface:         '#111827',
  surfaceElevated: '#1e2d3d',
  border:          '#1e2d3d',
  line:            '#27384a',
  text:            '#f4f7fb',
  textSecondary:   '#94a3b8',
  textMuted:       '#56657a',
  mx4Green:        '#4ade80',
  mx4Amber:        '#fbbf24',
  mx4Red:          '#f87171',
} as const

export const SECTION_ACCENTS: Record<SectionKey, string> = {
  home:      '#4ade80',
  recovery:  '#7c9af8',
  training:  '#f5853a',
  sleep:     '#b08cf0',
  nutrition: '#3ecf8e',
  bloodwork: '#ef6f6c',
  dailylog:  '#f5cf5e',
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  home:      'Home',
  recovery:  'Recovery',
  training:  'Training',
  sleep:     'Sleep',
  nutrition: 'Nutrition',
  bloodwork: 'Blood Work',
  dailylog:  'Daily Log',
}

export const SECTION_ICONS: Record<SectionKey, string> = {
  home:      '🏠',
  recovery:  '🔋',
  training:  '💪',
  sleep:     '😴',
  nutrition: '🥗',
  bloodwork: '🩸',
  dailylog:  '📋',
}

export const FONT_UI   = "'Hanken Grotesk', system-ui, sans-serif"
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
```

- [ ] **Step 2: Add Google Fonts to `client/index.html`**

Add inside `<head>`, before the closing `</head>` tag, after the iOS meta tags:

```html
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 3: Add keyframes to `client/index.css`**

Append to the end of the file:

```css
/* MX-4 OS keyframes — referenced by name in inline animation strings */
@keyframes mx4spin        { to { transform: rotate(360deg); } }
@keyframes mx4breathe     { 0%,100% { transform: scale(0.82); opacity: 0.7; } 50% { transform: scale(1); opacity: 1; } }
@keyframes mx4ping        { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.4); opacity: 0; } }
@keyframes mx4tele        { 0%,100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
@keyframes mx4blink       { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes mx4glowbreathe { 0%,100% { box-shadow: 0 0 8px var(--mx4-accent,#2bc4e8); } 50% { box-shadow: 0 0 20px var(--mx4-accent,#2bc4e8); } }
@keyframes mx4shimmer     { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```

- [ ] **Step 4: Run all tests to confirm nothing broke**

```
npx vitest run --config vitest.client.config.ts
```

Expected: all existing tests pass (token rename `textPrimary`→`text` is not yet used by components, so no breakage yet).

- [ ] **Step 5: Commit**

```bash
git add client/src/theme.ts client/index.html client/index.css
git commit -m "feat: MX-4 OS design tokens, Google Fonts, CSS keyframes"
```

---

## Task 2: hexA + bactaTexture utility functions

Create two pure utility functions in `client/src/lib/`. These have no React dependencies and no tests of their own — their correctness is exercised by component tests.

**Files:**
- Create: `client/src/lib/hexA.ts`
- Create: `client/src/lib/bactaTexture.ts`

- [ ] **Step 1: Create `client/src/lib/hexA.ts`**

```ts
/** Convert a 6-digit hex color + alpha to rgba(r,g,b,a). */
export function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
```

- [ ] **Step 2: Create `client/src/lib/bactaTexture.ts`**

```ts
import type { CSSProperties } from 'react'
import { hexA } from './hexA'

/** Global MX-4 OS texture: horizontal scanlines + accent grid. */
export function bactaTexture(accent: string): CSSProperties {
  const a = (x: number) => hexA(accent, x)
  return {
    backgroundImage:
      `repeating-linear-gradient(0deg, rgba(255,255,255,0.016) 0px, rgba(255,255,255,0.016) 1px, transparent 1px, transparent 3px),` +
      `linear-gradient(${a(0.035)} 1px, transparent 1px), linear-gradient(90deg, ${a(0.035)} 1px, transparent 1px)`,
    backgroundSize: '100% 3px, 26px 26px, 26px 26px',
  }
}
```

- [ ] **Step 3: Run tests**

```
npx vitest run --config vitest.client.config.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/hexA.ts client/src/lib/bactaTexture.ts
git commit -m "feat: add hexA and bactaTexture utility functions"
```

---

## Task 3: MX4Sigil primitive

The central SVG icon with six moods (expressions). Translated directly from `design_handoff_mx4_home/design/bacta-core.jsx`.

**Files:**
- Create: `client/src/components/primitives/MX4Sigil.tsx`
- Create: `tests/client/components/primitives/MX4Sigil.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/client/components/primitives/MX4Sigil.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MX4Sigil } from '../../../../client/src/components/primitives/MX4Sigil'

describe('MX4Sigil', () => {
  it('renders an SVG element', () => {
    const { container } = render(<MX4Sigil color="#2bc4e8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders all 6 moods without crashing', () => {
    const moods = ['transmit', 'idle', 'listen', 'think', 'alert', 'pleased'] as const
    for (const mood of moods) {
      const { container } = render(<MX4Sigil color="#2bc4e8" mood={mood} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    }
  })

  it('applies size as width and height on the svg', () => {
    const { container } = render(<MX4Sigil color="#2bc4e8" size={24} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('24')
    expect(svg.getAttribute('height')).toBe('24')
  })

  it('renders with spin and glow props without crashing', () => {
    const { container } = render(<MX4Sigil color="#2bc4e8" spin glow mood="transmit" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm test fails**

```
npx vitest run --config vitest.client.config.ts tests/client/components/primitives/MX4Sigil.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `client/src/components/primitives/MX4Sigil.tsx`**

```tsx
import type { CSSProperties } from 'react'

export type MX4Mood = 'transmit' | 'idle' | 'listen' | 'think' | 'alert' | 'pleased'

interface MX4SigilProps {
  color?: string
  size?: number
  spin?: boolean
  glow?: boolean
  mood?: MX4Mood
}

export function MX4Sigil({ color = '#4ade80', size = 40, spin = false, glow = false, mood = 'transmit' }: MX4SigilProps) {
  const spinStyle: CSSProperties | undefined = spin
    ? { transformOrigin: '24px 24px', animation: 'mx4spin 14s linear infinite' }
    : undefined
  const spinStyleRev: CSSProperties | undefined = spin
    ? { transformOrigin: '24px 24px', animation: 'mx4spin 18s linear infinite reverse' }
    : undefined

  const F = (
    <polygon
      points="24,4 41.3,14 41.3,34 24,44 6.7,34 6.7,14"
      fill="none"
      stroke={color}
      strokeWidth="1.3"
      strokeOpacity="0.5"
    />
  )
  const Ffaint = (
    <polygon
      points="24,4 41.3,14 41.3,34 24,44 6.7,34 6.7,14"
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      strokeOpacity="0.32"
    />
  )
  const core = <circle cx="24" cy="24" r="3.4" fill={color} />
  const coreSm = <circle cx="24" cy="24" r="2.6" fill={color} />

  let inner: JSX.Element
  switch (mood) {
    case 'idle':
      inner = (
        <>
          <circle cx="24" cy="24" r="11" fill="none" stroke={color} strokeWidth="1.3" strokeOpacity="0.5" />
          <line x1="5.5" y1="24" x2="9" y2="24" stroke={color} strokeWidth="1.3" strokeOpacity="0.4" strokeLinecap="round" />
          <line x1="39" y1="24" x2="42.5" y2="24" stroke={color} strokeWidth="1.3" strokeOpacity="0.4" strokeLinecap="round" />
          {coreSm}
          <circle cx="24" cy="24" r="6" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.3" />
        </>
      )
      break
    case 'listen':
      inner = (
        <>
          {Ffaint}
          <path d="M8.5 24 Q24 13 39.5 24 Q24 35 8.5 24 Z" fill="none" stroke={color} strokeWidth="1.6" strokeOpacity="0.9" />
          <circle cx="24" cy="24" r="7.5" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.32" />
          <circle cx="24" cy="24" r="4" fill={color} />
        </>
      )
      break
    case 'think':
      inner = (
        <>
          {F}
          <g style={spinStyleRev}>
            <circle cx="24" cy="24" r="12.5" fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="3 7" strokeLinecap="round" strokeOpacity="0.85" />
          </g>
          <line x1="15" y1="24" x2="33" y2="24" stroke={color} strokeWidth="1.4" strokeDasharray="2.5 2.5" strokeOpacity="0.8" />
          <circle cx="24" cy="24" r="2.6" fill={color} />
        </>
      )
      break
    case 'alert':
      inner = (
        <>
          {F}
          <circle cx="24" cy="24" r="9.5" fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.85" />
          <rect x="22.5" y="17.5" width="3" height="13" rx="1.5" fill={color} />
        </>
      )
      break
    case 'pleased':
      inner = (
        <>
          {F}
          <circle cx="24" cy="24" r="9.5" fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.8" />
          <path d="M18.5 26.5 Q24 20.5 29.5 26.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="28.5" r="1.8" fill={color} />
        </>
      )
      break
    case 'transmit':
    default:
      inner = (
        <>
          {F}
          <g style={spinStyle}>
            <circle cx="24" cy="24" r="13" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 9" strokeLinecap="round" strokeOpacity="0.9" />
          </g>
          <circle cx="24" cy="24" r="8.5" fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.85" />
          {core}
          <circle cx="24" cy="24" r="6" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.4" />
        </>
      )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {glow && (
          <filter id="mx4glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <g filter={glow ? 'url(#mx4glow)' : undefined}>{inner}</g>
    </svg>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```
npx vitest run --config vitest.client.config.ts tests/client/components/primitives/MX4Sigil.test.tsx
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/primitives/MX4Sigil.tsx tests/client/components/primitives/MX4Sigil.test.tsx
git commit -m "feat: add MX4Sigil primitive with 6 moods"
```

---

## Task 4: Sigil + NavIcon primitives

Per-section geometric sigils and the NavIcon (hex with menu lines).

**Files:**
- Create: `client/src/components/primitives/Sigil.tsx`
- Create: `client/src/components/primitives/NavIcon.tsx`
- Create: `tests/client/components/primitives/Sigil.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/client/components/primitives/Sigil.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { Sigil } from '../../../../client/src/components/primitives/Sigil'
import type { SectionKey } from '../../../../client/src/theme'

describe('Sigil', () => {
  const sections: Exclude<SectionKey, 'home'>[] = [
    'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog',
  ]

  it.each(sections)('renders %s sigil without crashing', (section) => {
    const { container } = render(<Sigil name={section} color="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('applies size as width and height', () => {
    const { container } = render(<Sigil name="recovery" color="#7c9af8" size={20} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('20')
    expect(svg.getAttribute('height')).toBe('20')
  })
})
```

- [ ] **Step 2: Run to confirm test fails**

```
npx vitest run --config vitest.client.config.ts tests/client/components/primitives/Sigil.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `client/src/components/primitives/Sigil.tsx`**

```tsx
import type { SectionKey } from '../../theme'

interface SigilProps {
  name: Exclude<SectionKey, 'home'>
  color?: string
  size?: number
  sw?: number
}

export function Sigil({ name, color = '#fff', size = 18, sw = 1.6 }: SigilProps) {
  const p = {
    fill: 'none' as const,
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const shapes: Record<Exclude<SectionKey, 'home'>, JSX.Element> = {
    recovery: (
      <g {...p}>
        <circle cx="12" cy="12" r="7.5" strokeDasharray="34 13" transform="rotate(-90 12 12)" />
        <circle cx="12" cy="12" r="1.7" fill={color} stroke="none" />
      </g>
    ),
    training: (
      <g {...p}>
        <polyline points="6,13 12,8 18,13" />
        <polyline points="6,17 12,12 18,17" />
      </g>
    ),
    sleep: (
      <g {...p}>
        <path d="M16.5 13.2A6 6 0 1 1 10.8 6.5 4.7 4.7 0 0 0 16.5 13.2Z" />
      </g>
    ),
    nutrition: (
      <g {...p}>
        <polygon points="12,4.5 18.5,8.2 18.5,15.8 12,19.5 5.5,15.8 5.5,8.2" />
      </g>
    ),
    bloodwork: (
      <g {...p}>
        <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" transform="rotate(45 12 12)" />
        <line x1="8.8" y1="12" x2="15.2" y2="12" />
      </g>
    ),
    dailylog: (
      <g {...p}>
        <line x1="6" y1="8" x2="18" y2="8" />
        <line x1="6" y1="12" x2="15" y2="12" />
        <line x1="6" y1="16" x2="12" y2="16" />
      </g>
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {shapes[name]}
    </svg>
  )
}
```

- [ ] **Step 4: Create `client/src/components/primitives/NavIcon.tsx`**

```tsx
interface NavIconProps {
  color?: string
  size?: number
}

export function NavIcon({ color = '#94a3b8', size = 22 }: NavIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
    >
      <polygon points="12,2.8 20.3,7.6 20.3,16.4 12,21.2 3.7,16.4 3.7,7.6" strokeOpacity="0.5" />
      <line x1="8.6" y1="9.6" x2="15.4" y2="9.6" />
      <line x1="8.6" y1="12" x2="15.4" y2="12" />
      <line x1="8.6" y1="14.4" x2="12.8" y2="14.4" />
    </svg>
  )
}
```

- [ ] **Step 5: Run test to confirm it passes**

```
npx vitest run --config vitest.client.config.ts tests/client/components/primitives/Sigil.test.tsx
```

Expected: PASS — 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/primitives/Sigil.tsx client/src/components/primitives/NavIcon.tsx tests/client/components/primitives/Sigil.test.tsx
git commit -m "feat: add Sigil and NavIcon SVG primitives"
```

---

## Task 5: Ring + Sparkline primitives

Circular progress ring and sparkline with area fill.

**Files:**
- Create: `client/src/components/primitives/Ring.tsx`
- Create: `client/src/components/primitives/Sparkline.tsx`
- Create: `tests/client/components/primitives/Ring.test.tsx`
- Create: `tests/client/components/primitives/Sparkline.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/client/components/primitives/Ring.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { Ring } from '../../../../client/src/components/primitives/Ring'

describe('Ring', () => {
  it('renders an svg element', () => {
    const { container } = render(<Ring progress={0.75} accent="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders children inside the ring', () => {
    const { getByText } = render(
      <Ring progress={0.5} accent="#7c9af8">
        <span>82</span>
      </Ring>
    )
    expect(getByText('82')).toBeInTheDocument()
  })

  it('applies the size prop', () => {
    const { container } = render(<Ring progress={0.5} accent="#7c9af8" size={60} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('60')
  })
})
```

Create `tests/client/components/primitives/Sparkline.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { Sparkline } from '../../../../client/src/components/primitives/Sparkline'

describe('Sparkline', () => {
  it('renders an svg element', () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4, 5]} accent="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders without crashing with single data point', () => {
    const { container } = render(<Sparkline data={[42]} accent="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders without crashing with empty data', () => {
    const { container } = render(<Sparkline data={[]} accent="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```
npx vitest run --config vitest.client.config.ts tests/client/components/primitives/Ring.test.tsx tests/client/components/primitives/Sparkline.test.tsx
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `client/src/components/primitives/Ring.tsx`**

```tsx
import type { ReactNode } from 'react'

interface RingProps {
  progress: number
  accent: string
  size?: number
  stroke?: number
  track?: string
  children?: ReactNode
}

export function Ring({ progress, accent, size = 40, stroke = 4, track, children }: RingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track ?? 'rgba(255,255,255,0.09)'}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      {children && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `client/src/components/primitives/Sparkline.tsx`**

```tsx
interface SparklineProps {
  data: number[]
  accent: string
  w?: number
  h?: number
  sw?: number
  fill?: boolean
  dot?: boolean
}

export function Sparkline({ data, accent, w = 92, h = 30, sw = 1.8, fill = true, dot = true }: SparklineProps) {
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
  const id = 'sg' + Math.random().toString(36).slice(2, 7)
  const last = pts[pts.length - 1]
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
    </svg>
  )
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```
npx vitest run --config vitest.client.config.ts tests/client/components/primitives/Ring.test.tsx tests/client/components/primitives/Sparkline.test.tsx
```

Expected: PASS — 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/primitives/Ring.tsx client/src/components/primitives/Sparkline.tsx tests/client/components/primitives/Ring.test.tsx tests/client/components/primitives/Sparkline.test.tsx
git commit -m "feat: add Ring and Sparkline visualization primitives"
```

---

## Task 6: StatusCore, ReadinessDots, Bracket, FTelemetry primitives

Four small display components. Tests for StatusCore only (the rest are purely visual with no testable behavior).

**Files:**
- Create: `client/src/components/primitives/StatusCore.tsx`
- Create: `client/src/components/primitives/ReadinessDots.tsx`
- Create: `client/src/components/primitives/Bracket.tsx`
- Create: `client/src/components/primitives/FTelemetry.tsx`
- Create: `tests/client/components/primitives/StatusCore.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/client/components/primitives/StatusCore.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { StatusCore } from '../../../../client/src/components/primitives/StatusCore'

describe('StatusCore', () => {
  it('renders without crashing', () => {
    const { container } = render(<StatusCore accent="#4ade80" />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders with active=false without crashing', () => {
    const { container } = render(<StatusCore accent="#4ade80" active={false} />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm test fails**

```
npx vitest run --config vitest.client.config.ts tests/client/components/primitives/StatusCore.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `client/src/components/primitives/StatusCore.tsx`**

```tsx
interface StatusCoreProps {
  accent?: string
  size?: number
  active?: boolean
}

export function StatusCore({ accent = '#4ade80', size = 8, active = true }: StatusCoreProps) {
  return (
    <span
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-block',
        flexShrink: 0,
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: accent,
            animation: 'mx4ping 2.6s cubic-bezier(0,0,.2,1) infinite',
          }}
        />
      )}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: accent,
          boxShadow: active ? `0 0 7px ${accent}` : 'none',
          opacity: active ? 1 : 0.45,
          animation: active ? 'mx4breathe 2.6s ease-in-out infinite' : 'none',
        }}
      />
    </span>
  )
}
```

- [ ] **Step 4: Create `client/src/components/primitives/ReadinessDots.tsx`**

```tsx
interface ReadinessDotsProps {
  value: number
  total?: number
  accent: string
  size?: number
}

export function ReadinessDots({ value, total = 5, accent, size = 7 }: ReadinessDotsProps) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: i < value ? accent : 'transparent',
            border: `1.5px solid ${i < value ? accent : 'rgba(255,255,255,0.18)'}`,
            boxShadow: i < value ? `0 0 5px ${accent}66` : 'none',
          }}
        />
      ))}
    </span>
  )
}
```

- [ ] **Step 5: Create `client/src/components/primitives/Bracket.tsx`**

```tsx
import type { CSSProperties } from 'react'

interface BracketProps {
  color: string
  size?: number
  sw?: number
  op?: number
  inset?: number
  radius?: number
}

export function Bracket({ color, size = 11, sw = 1.4, op = 0.55, inset = 7, radius = 4 }: BracketProps) {
  const base: CSSProperties = { position: 'absolute', width: size, height: size, pointerEvents: 'none', opacity: op }
  const mk = (extra: CSSProperties): CSSProperties => ({ ...base, ...extra })
  return (
    <>
      <span style={mk({ top: inset, left: inset, borderTop: `${sw}px solid ${color}`, borderLeft: `${sw}px solid ${color}`, borderTopLeftRadius: radius })} />
      <span style={mk({ top: inset, right: inset, borderTop: `${sw}px solid ${color}`, borderRight: `${sw}px solid ${color}`, borderTopRightRadius: radius })} />
      <span style={mk({ bottom: inset, left: inset, borderBottom: `${sw}px solid ${color}`, borderLeft: `${sw}px solid ${color}`, borderBottomLeftRadius: radius })} />
      <span style={mk({ bottom: inset, right: inset, borderBottom: `${sw}px solid ${color}`, borderRight: `${sw}px solid ${color}`, borderBottomRightRadius: radius })} />
    </>
  )
}
```

- [ ] **Step 6: Create `client/src/components/primitives/FTelemetry.tsx`**

```tsx
import { MX4_COLOR } from '../../theme'

interface FTelemetryProps {
  color?: string
  bars?: number
}

export function FTelemetry({ color = MX4_COLOR, bars = 5 }: FTelemetryProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 2,
            background: color,
            borderRadius: 1,
            transformOrigin: 'bottom',
            height: 12,
            animation: `mx4tele 1.${3 + i}s ease-in-out ${i * 0.12}s infinite`,
            opacity: 0.85,
          }}
        />
      ))}
    </span>
  )
}
```

- [ ] **Step 7: Run tests to confirm they pass**

```
npx vitest run --config vitest.client.config.ts tests/client/components/primitives/StatusCore.test.tsx
```

Expected: PASS — 2 tests pass.

- [ ] **Step 8: Run the full suite to check nothing broke**

```
npx vitest run --config vitest.client.config.ts
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add client/src/components/primitives/StatusCore.tsx client/src/components/primitives/ReadinessDots.tsx client/src/components/primitives/Bracket.tsx client/src/components/primitives/FTelemetry.tsx tests/client/components/primitives/StatusCore.test.tsx
git commit -m "feat: add StatusCore, ReadinessDots, Bracket, FTelemetry primitives"
```

---

## Task 7: BactaStatusBar — rewrite TopBar

Rewrite `TopBar.tsx` (exports `BactaStatusBar` as named export `TopBar` for backwards compat) and rewrite its tests.

**Files:**
- Rewrite: `client/src/components/TopBar.tsx`
- Rewrite: `tests/client/components/TopBar.test.tsx`

The export name stays `TopBar` so `AppShell.tsx` imports work without changes yet.

- [ ] **Step 1: Rewrite the tests first**

Replace `tests/client/components/TopBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { TopBar } from '../../../client/src/components/TopBar'

describe('BactaStatusBar (TopBar)', () => {
  it('renders BACTA and ·OS in home mode', () => {
    render(<TopBar section="home" />)
    expect(screen.getByText('BACTA')).toBeInTheDocument()
    expect(screen.getByText('·OS')).toBeInTheDocument()
  })

  it('renders MX-4 ONLINE in home mode', () => {
    render(<TopBar section="home" />)
    expect(screen.getByText('MX-4 ONLINE')).toBeInTheDocument()
  })

  it('renders section label in section mode', () => {
    render(<TopBar section="recovery" onBack={vi.fn()} />)
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
  })

  it('renders back button in section mode', () => {
    render(<TopBar section="sleep" onBack={vi.fn()} />)
    expect(screen.getByLabelText('Back')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<TopBar section="training" onBack={onBack} />)
    fireEvent.click(screen.getByLabelText('Back'))
    expect(onBack).toHaveBeenCalled()
  })

  it('does not render back button in home mode', () => {
    render(<TopBar section="home" />)
    expect(screen.queryByLabelText('Back')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm tests fail (TopBar still has old API)**

```
npx vitest run --config vitest.client.config.ts tests/client/components/TopBar.test.tsx
```

Expected: multiple FAILs — old TopBar doesn't render "BACTA" or "MX-4 ONLINE".

- [ ] **Step 3: Rewrite `client/src/components/TopBar.tsx`**

```tsx
import { COLORS, FONT_MONO, FONT_UI, MX4_COLOR, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'
import { MX4Sigil } from './primitives/MX4Sigil'
import { Sigil } from './primitives/Sigil'
import { StatusCore } from './primitives/StatusCore'
import { hexA } from '../lib/hexA'

interface TopBarProps {
  section: SectionKey
  onBack?: () => void
}

export function TopBar({ section, onBack }: TopBarProps) {
  const isHome = section === 'home'
  const accent = isHome ? MX4_COLOR : SECTION_ACCENTS[section]

  return (
    <div
      style={{
        background: 'rgba(17,24,39,0.92)',
        borderBottom: `1px solid ${hexA(accent, 0.28)}`,
        boxShadow: `0 1px 0 ${hexA(accent, 0.12)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `50px 16px 12px`,
        flexShrink: 0,
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Left side */}
      {isHome ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <MX4Sigil color={accent} size={18} spin mood="idle" />
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: accent }}>
            BACTA
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: '0.14em', color: COLORS.textMuted }}>
            ·OS
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <button
            aria-label="Back"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              color: accent,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          {section !== 'home' && (
            <Sigil name={section as Exclude<SectionKey, 'home'>} color={accent} size={16} />
          )}
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', color: accent }}>
            {SECTION_LABELS[section].toUpperCase()}
          </span>
        </div>
      )}

      {/* Right side — always the same */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusCore accent={COLORS.mx4Green} size={6} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.08em', color: COLORS.mx4Green }}>
          MX-4 ONLINE
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run --config vitest.client.config.ts tests/client/components/TopBar.test.tsx
```

Expected: PASS — 6 tests pass.

- [ ] **Step 5: Run full suite**

```
npx vitest run --config vitest.client.config.ts
```

Expected: all tests pass. The AppShell test will fail on "renders the section label" because it expects `'Recovery'` but now gets `'RECOVERY'` — that's expected; it gets fixed in Task 12.

If AppShell test fails on "Recovery" text, that's fine — leave it. All other tests must pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/TopBar.tsx tests/client/components/TopBar.test.tsx
git commit -m "feat: rewrite TopBar as BactaStatusBar — MX-4 OS chrome"
```

---

## Task 8: BactaDock — rewrite BottomBar

Replace the tab-based BottomBar with the Ask MX-4 + nav hex dock.

**Files:**
- Rewrite: `client/src/components/BottomBar.tsx`
- Rewrite: `tests/client/components/BottomBar.test.tsx`

- [ ] **Step 1: Rewrite the tests first**

Replace `tests/client/components/BottomBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomBar } from '../../../client/src/components/BottomBar'

describe('BactaDock (BottomBar)', () => {
  it('renders the Ask MX-4 button', () => {
    render(<BottomBar accent="#2bc4e8" onAsk={vi.fn()} onNav={vi.fn()} />)
    expect(screen.getByTestId('ask-button')).toBeInTheDocument()
  })

  it('renders the nav button', () => {
    render(<BottomBar accent="#2bc4e8" onAsk={vi.fn()} onNav={vi.fn()} />)
    expect(screen.getByTestId('nav-button')).toBeInTheDocument()
  })

  it('calls onAsk when Ask button is clicked', () => {
    const onAsk = vi.fn()
    render(<BottomBar accent="#2bc4e8" onAsk={onAsk} onNav={vi.fn()} />)
    fireEvent.click(screen.getByTestId('ask-button'))
    expect(onAsk).toHaveBeenCalled()
  })

  it('calls onNav when nav button is clicked', () => {
    const onNav = vi.fn()
    render(<BottomBar accent="#2bc4e8" onAsk={vi.fn()} onNav={onNav} />)
    fireEvent.click(screen.getByTestId('nav-button'))
    expect(onNav).toHaveBeenCalled()
  })

  it('renders Ask MX-4 label text', () => {
    render(<BottomBar accent="#2bc4e8" onAsk={vi.fn()} onNav={vi.fn()} />)
    expect(screen.getByText('Ask MX-4')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```
npx vitest run --config vitest.client.config.ts tests/client/components/BottomBar.test.tsx
```

Expected: FAIL — old BottomBar doesn't match new API.

- [ ] **Step 3: Rewrite `client/src/components/BottomBar.tsx`**

```tsx
import { COLORS, FONT_MONO, FONT_UI } from '../theme'
import { MX4Sigil } from './primitives/MX4Sigil'
import { NavIcon } from './primitives/NavIcon'
import { hexA } from '../lib/hexA'

interface BottomBarProps {
  accent: string
  onAsk: () => void
  onNav: () => void
}

export function BottomBar({ accent, onAsk, onNav }: BottomBarProps) {
  const circleBase = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    border: 'none',
    padding: 0,
  }

  return (
    <div
      style={{
        background: 'rgba(17,24,39,0.92)',
        borderTop: `1px solid ${hexA(accent, 0.28)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `10px 18px calc(10px + env(safe-area-inset-bottom))`,
        flexShrink: 0,
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Ask MX-4 button (left) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <button
          data-testid="ask-button"
          onClick={onAsk}
          aria-label="Ask MX-4"
          style={{
            ...circleBase,
            background: `radial-gradient(circle, ${hexA(accent, 0.13)}, ${hexA(accent, 0.03)} 70%)`,
            border: `1px solid ${hexA(accent, 0.55)}`,
            animation: 'mx4glowbreathe 3.6s ease-in-out infinite',
          }}
        >
          <MX4Sigil color={accent} size={28} glow mood="listen" />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: FONT_UI, fontSize: 13.5, fontWeight: 650, color: COLORS.text }}>
            Ask MX-4
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.12em', color: COLORS.textMuted }}>
            TAP TO TALK
          </span>
        </div>
      </div>

      {/* Nav button (right) */}
      <button
        data-testid="nav-button"
        onClick={onNav}
        aria-label="All Systems"
        style={{
          ...circleBase,
          background: COLORS.base,
          border: `1px solid ${COLORS.line}`,
        }}
      >
        <NavIcon color={COLORS.textSecondary} size={26} />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run --config vitest.client.config.ts tests/client/components/BottomBar.test.tsx
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/BottomBar.tsx tests/client/components/BottomBar.test.tsx
git commit -m "feat: rewrite BottomBar as BactaDock — Ask MX-4 + nav hex"
```

---

## Task 9: Sheet wrapper

New `Sheet.tsx` — animated bottom-sheet with backdrop. Used by both NavSheet and AskSheet.

**Files:**
- Create: `client/src/components/Sheet.tsx`

No separate test file — Sheet's open/close behavior is fully covered by NavSheet and AskSheet tests.

- [ ] **Step 1: Create `client/src/components/Sheet.tsx`**

```tsx
import { useState, useEffect, type ReactNode } from 'react'
import { COLORS } from '../theme'
import { hexA } from '../lib/hexA'
import { bactaTexture } from '../lib/bactaTexture'
import { FONT_UI } from '../theme'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxHeight?: string
}

export function Sheet({ open, onClose, children, maxHeight = '82%' }: SheetProps) {
  const [render, setRender] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    } else {
      setShown(false)
      const t = setTimeout(() => setRender(false), 340)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!render) return null

  return (
    <div
      data-testid="sheet-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: shown ? 'rgba(6,9,14,0.62)' : 'rgba(6,9,14,0)',
        transition: 'background .34s ease',
        backdropFilter: shown ? 'blur(3px)' : 'blur(0px)',
        WebkitBackdropFilter: shown ? 'blur(3px)' : 'blur(0px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight,
          transform: shown ? 'translateY(0)' : 'translateY(101%)',
          transition: 'transform .36s cubic-bezier(.22,.61,.36,1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface SheetShellProps {
  accent: string
  children: ReactNode
}

export function SheetShell({ accent, children }: SheetShellProps) {
  return (
    <div
      style={{
        position: 'relative',
        background: COLORS.base,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTop: `1px solid ${hexA(accent, 0.4)}`,
        boxShadow: `0 -18px 50px rgba(0,0,0,0.5), 0 0 40px ${hexA(accent, 0.07)}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '100%',
        fontFamily: FONT_UI,
        color: COLORS.text,
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, ...bactaTexture(accent), pointerEvents: 'none', opacity: 0.7 }}
      />
      {/* Grab handle */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', paddingTop: 9 }}>
        <span style={{ width: 38, height: 4, borderRadius: 4, background: hexA(accent, 0.4) }} />
      </div>
      {children}
    </div>
  )
}

interface SheetHeaderProps {
  accent: string
  sigil: ReactNode
  title: string
  sub?: string
  onClose: () => void
}

export function SheetHeader({ accent, sigil, title, sub, onClose }: SheetHeaderProps) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 18px 12px' }}>
      {sigil}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12.5, fontWeight: 700, letterSpacing: '0.14em', color: accent }}>
          {title}
        </span>
        {sub && (
          <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
            {sub}
          </span>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `1px solid ${COLORS.line}`,
          background: COLORS.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2.4" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```
npx vitest run --config vitest.client.config.ts
```

Expected: all tests pass (Sheet has no test file yet, it compiles cleanly).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Sheet.tsx
git commit -m "feat: add Sheet, SheetShell, SheetHeader animated bottom-sheet wrapper"
```

---

## Task 10: NavSheet — rewrite BottomSheet

Replace the simple BottomSheet with the MX-4 OS All Systems nav. Uses React Router's `useNavigate`.

**Files:**
- Rewrite: `client/src/components/BottomSheet.tsx`
- Rewrite: `tests/client/components/BottomSheet.test.tsx`

Note: `Sheet` renders children immediately when `open=true` on initial mount (because `render` initializes from `open`). No fake timers needed in tests.

- [ ] **Step 1: Rewrite tests first**

Replace `tests/client/components/BottomSheet.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomSheet } from '../../../client/src/components/BottomSheet'

function renderSheet(open: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <BottomSheet open={open} onClose={onClose} currentSection="home" />
    </MemoryRouter>
  )
}

describe('NavSheet (BottomSheet)', () => {
  it('renders nothing when closed', () => {
    renderSheet(false)
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument()
  })

  it('renders the sheet when open', () => {
    renderSheet(true)
    expect(screen.getByTestId('sheet-backdrop')).toBeInTheDocument()
  })

  it('renders ALL SYSTEMS title', () => {
    renderSheet(true)
    expect(screen.getByText('ALL SYSTEMS')).toBeInTheDocument()
  })

  it('renders Home · Overview row', () => {
    renderSheet(true)
    expect(screen.getByText('Home · Overview')).toBeInTheDocument()
  })

  it('renders all 6 section channel labels', () => {
    renderSheet(true)
    expect(screen.getByText('Recovery')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Sleep')).toBeInTheDocument()
    expect(screen.getByText('Nutrition')).toBeInTheDocument()
    expect(screen.getByText('Blood Work')).toBeInTheDocument()
    expect(screen.getByText('Daily Log')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    renderSheet(true, onClose)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    renderSheet(true, onClose)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```
npx vitest run --config vitest.client.config.ts tests/client/components/BottomSheet.test.tsx
```

Expected: FAIL — old BottomSheet props don't match.

- [ ] **Step 3: Rewrite `client/src/components/BottomSheet.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { COLORS, FONT_MONO, FONT_UI, MX4_COLOR, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'
import { Sheet, SheetShell, SheetHeader } from './Sheet'
import { MX4Sigil } from './primitives/MX4Sigil'
import { Sigil } from './primitives/Sigil'
import { NavIcon } from './primitives/NavIcon'
import { Bracket } from './primitives/Bracket'
import { FTelemetry } from './primitives/FTelemetry'
import { hexA } from '../lib/hexA'

const SECTION_KEYS: Exclude<SectionKey, 'home'>[] = [
  'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog',
]

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  currentSection: SectionKey
}

export function BottomSheet({ open, onClose, currentSection }: BottomSheetProps) {
  const navigate = useNavigate()

  const handleNav = (section: SectionKey) => {
    navigate(section === 'home' ? '/' : `/${section}`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} maxHeight="86%">
      <SheetShell accent={MX4_COLOR}>
        <SheetHeader
          accent={MX4_COLOR}
          title="ALL SYSTEMS"
          sub="SELECT A CHANNEL"
          sigil={<NavIcon color={MX4_COLOR} size={26} />}
          onClose={onClose}
        />

        <div style={{ position: 'relative', overflowY: 'auto', padding: '2px 16px 0' }}>
          {/* Home · Overview row */}
          <button
            onClick={() => handleNav('home')}
            style={{
              width: '100%',
              textAlign: 'left',
              font: 'inherit',
              color: 'inherit',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: currentSection === 'home' ? hexA(MX4_COLOR, 0.08) : COLORS.surface,
              border: `1px solid ${currentSection === 'home' ? hexA(MX4_COLOR, 0.45) : COLORS.line}`,
              borderRadius: 12,
              padding: '13px 14px',
              marginBottom: 14,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: hexA(MX4_COLOR, 0.12),
                border: `1px solid ${hexA(MX4_COLOR, 0.3)}`,
              }}
            >
              <MX4Sigil color={MX4_COLOR} size={24} mood="idle" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.text }}>Home · Overview</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>
                6 systems nominal
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MX4_COLOR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,5 16,12 9,19" />
            </svg>
          </button>

          {/* CHANNELS divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.18em', color: COLORS.textMuted }}>
              CHANNELS
            </span>
            <span style={{ flex: 1, height: 1, background: COLORS.line }} />
          </div>

          {/* 6 section channels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 4 }}>
            {SECTION_KEYS.map((key) => {
              const accent = SECTION_ACCENTS[key]
              const active = currentSection === key
              return (
                <button
                  key={key}
                  onClick={() => handleNav(key)}
                  style={{
                    position: 'relative',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                    background: active ? hexA(accent, 0.09) : COLORS.surface,
                    border: `1px solid ${active ? hexA(accent, 0.5) : COLORS.line}`,
                    borderRadius: 11,
                    padding: '13px 12px 12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: `linear-gradient(90deg, ${accent}, transparent 80%)`,
                      opacity: 0.9,
                    }}
                  />
                  <Bracket color={accent} inset={6} op={0.45} radius={4} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: hexA(accent, 0.13),
                        border: `1px solid ${hexA(accent, 0.32)}`,
                      }}
                    >
                      <Sigil name={key} color={accent} size={17} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 650, color: COLORS.text, lineHeight: 1.1 }}>
                      {SECTION_LABELS[key]}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '13px 18px 26px',
            borderTop: `1px solid ${COLORS.line}`,
            marginTop: 12,
          }}
        >
          <MX4Sigil color={MX4_COLOR} size={17} spin mood="idle" />
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.08em', color: COLORS.textSecondary }}>
            WHERE TO, COMMANDER?
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <FTelemetry color={MX4_COLOR} bars={4} />
          </span>
        </div>
      </SheetShell>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run --config vitest.client.config.ts tests/client/components/BottomSheet.test.tsx
```

Expected: PASS — 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/BottomSheet.tsx tests/client/components/BottomSheet.test.tsx
git commit -m "feat: rewrite BottomSheet as NavSheet — All Systems MX-4 OS nav"
```

---

## Task 11: AskSheet — pure UI shell

New AskSheet component. No API calls — visual shell only.

**Files:**
- Create: `client/src/components/AskSheet.tsx`
- Create: `tests/client/components/AskSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/client/components/AskSheet.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { AskSheet } from '../../../client/src/components/AskSheet'

function renderAsk(open: boolean, onClose = vi.fn()) {
  return render(<AskSheet open={open} onClose={onClose} accent="#2bc4e8" />)
}

describe('AskSheet', () => {
  it('renders nothing when closed', () => {
    renderAsk(false)
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument()
  })

  it('renders MX-4 header when open', () => {
    renderAsk(true)
    expect(screen.getByText('MX-4')).toBeInTheDocument()
  })

  it('renders the greeting text', () => {
    renderAsk(true)
    expect(screen.getByText(/Standing by, Commander/)).toBeInTheDocument()
  })

  it('renders 4 suggested prompts', () => {
    renderAsk(true)
    expect(screen.getByText('How is my recovery trending?')).toBeInTheDocument()
    expect(screen.getByText("Plan today's training")).toBeInTheDocument()
    expect(screen.getByText('Why is my HRV up?')).toBeInTheDocument()
    expect(screen.getByText('Summarize my week')).toBeInTheDocument()
  })

  it('renders the input placeholder', () => {
    renderAsk(true)
    expect(screen.getByText('Message MX-4')).toBeInTheDocument()
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    renderAsk(true, onClose)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm test fails**

```
npx vitest run --config vitest.client.config.ts tests/client/components/AskSheet.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `client/src/components/AskSheet.tsx`**

```tsx
import { COLORS, FONT_MONO, FONT_UI } from '../theme'
import { Sheet, SheetShell, SheetHeader } from './Sheet'
import { MX4Sigil } from './primitives/MX4Sigil'
import { hexA } from '../lib/hexA'

const SUGGESTED_PROMPTS = [
  'How is my recovery trending?',
  "Plan today's training",
  'Why is my HRV up?',
  'Summarize my week',
]

interface AskSheetProps {
  open: boolean
  onClose: () => void
  accent: string
}

export function AskSheet({ open, onClose, accent }: AskSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} maxHeight="88%">
      <SheetShell accent={accent}>
        <SheetHeader
          accent={accent}
          title="MX-4"
          sub="ASK ANYTHING · MEDICAL & PROTOCOL"
          sigil={<MX4Sigil color={accent} size={30} spin glow mood="transmit" />}
          onClose={onClose}
        />

        <div style={{ position: 'relative', overflowY: 'auto', padding: '4px 18px 8px' }}>
          {/* Greeting bubble */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}>
              <MX4Sigil color={accent} size={26} mood="pleased" />
            </span>
            <div
              style={{
                background: hexA(accent, 0.08),
                border: `1px solid ${hexA(accent, 0.22)}`,
                borderRadius: '4px 14px 14px 14px',
                padding: '11px 14px',
              }}
            >
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#eef4fb' }}>
                Standing by, Commander. Ask me about any system, or I can walk your latest readouts. What do you need?
              </p>
            </div>
          </div>

          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.16em',
              color: COLORS.textMuted,
              marginBottom: 10,
            }}
          >
            SUGGESTED
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTED_PROMPTS.map(prompt => (
              <span
                key={prompt}
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 12.5,
                  color: COLORS.textSecondary,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 18,
                  padding: '8px 13px',
                  cursor: 'pointer',
                }}
              >
                {prompt}
              </span>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '12px 16px 28px',
            borderTop: `1px solid ${COLORS.line}`,
            marginTop: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: COLORS.surface,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 11,
              padding: '11px 13px',
            }}
          >
            <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: COLORS.textMuted, letterSpacing: '0.02em' }}>
              Message MX-4
            </span>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 14,
                background: accent,
                animation: 'mx4blink 1.1s step-end infinite',
              }}
            />
          </div>
          <button
            aria-label="Send"
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 11,
              border: `1px solid ${hexA(accent, 0.5)}`,
              background: hexA(accent, 0.14),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" y1="18" x2="18" y2="6" />
              <polyline points="9,6 18,6 18,15" />
            </svg>
          </button>
        </div>
      </SheetShell>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run --config vitest.client.config.ts tests/client/components/AskSheet.test.tsx
```

Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AskSheet.tsx tests/client/components/AskSheet.test.tsx
git commit -m "feat: add AskSheet — Ask MX-4 conversation shell"
```

---

## Task 12: AppShell rewire + test updates

Wire all new components together in AppShell. Fix the API changes cascading from Tasks 7–11. Update all tests broken by prop changes.

**Files:**
- Rewrite: `client/src/components/AppShell.tsx`
- Rewrite: `tests/client/components/AppShell.test.tsx`
- Modify: `tests/client/App.test.tsx`

AppShell no longer takes `tabs`, `activeTab`, or `onTabChange`. All section pages that pass those props must remove them.

- [ ] **Step 1: Rewrite `client/src/components/AppShell.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COLORS, MX4_COLOR, SECTION_ACCENTS } from '../theme'
import type { SectionKey } from '../theme'
import { TopBar } from './TopBar'
import { BottomBar } from './BottomBar'
import { BottomSheet } from './BottomSheet'
import { AskSheet } from './AskSheet'
import { bactaTexture } from '../lib/bactaTexture'

interface AppShellProps {
  section: SectionKey
  children: React.ReactNode
}

export function AppShell({ section, children }: AppShellProps) {
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)

  const isHome = section === 'home'
  const accent = isHome ? MX4_COLOR : SECTION_ACCENTS[section]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.base,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
        color: COLORS.text,
        overflow: 'hidden',
      }}
    >
      {/* Global texture overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...bactaTexture(accent),
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <TopBar
        section={section}
        onBack={isHome ? undefined : () => navigate('/')}
      />

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
        onAsk={() => setAskOpen(true)}
        onNav={() => setNavOpen(true)}
      />

      <BottomSheet
        open={navOpen}
        onClose={() => setNavOpen(false)}
        currentSection={section}
      />

      <AskSheet
        open={askOpen}
        onClose={() => setAskOpen(false)}
        accent={accent}
      />
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `tests/client/components/AppShell.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../../client/src/components/AppShell'

function renderShell(section: 'home' | 'recovery' = 'home') {
  return render(
    <MemoryRouter initialEntries={[section === 'home' ? '/' : `/${section}`]}>
      <AppShell section={section}>
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

  it('renders BACTA·OS in home mode', () => {
    renderShell('home')
    expect(screen.getByText('BACTA')).toBeInTheDocument()
    expect(screen.getByText('·OS')).toBeInTheDocument()
  })

  it('renders section label in section mode', () => {
    renderShell('recovery')
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
  })

  it('renders ask button and nav button', () => {
    renderShell()
    expect(screen.getByTestId('ask-button')).toBeInTheDocument()
    expect(screen.getByTestId('nav-button')).toBeInTheDocument()
  })

  it('opens NavSheet when nav button is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('nav-button'))
    expect(screen.getByText('ALL SYSTEMS')).toBeInTheDocument()
  })

  it('opens AskSheet when ask button is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('ask-button'))
    expect(screen.getByText(/Standing by, Commander/)).toBeInTheDocument()
  })

  it('closes NavSheet when backdrop is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('nav-button'))
    expect(screen.getByText('ALL SYSTEMS')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(screen.queryByText('ALL SYSTEMS')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Update section pages to remove tab props**

All 6 section pages pass `tabs`, `activeTab`, `onTabChange` to AppShell which no longer accepts them. Remove those props from each page.

Check which pages have tab props:

```bash
grep -rl "tabs=" client/src/pages/
```

For each file found, remove the `tabs`, `activeTab`, and `onTabChange` props from the `<AppShell>` call. Also remove any `useState` for `activeTab` if it's only used for the tabs. The section pages become simple wrappers:

```tsx
// Example: RecoveryPage.tsx after cleanup
import { AppShell } from '../components/AppShell'

export function RecoveryPage() {
  return (
    <AppShell section="recovery">
      {/* section content */}
    </AppShell>
  )
}
```

Read each page file before editing it.

- [ ] **Step 4: Update `tests/client/App.test.tsx`**

Replace the entire file:

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

  test('renders sleep page on /sleep route', () => {
    renderApp('/sleep')
    expect(screen.getByText('SLEEP')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run the full suite**

```
npx vitest run --config vitest.client.config.ts
```

Expected: all tests pass. If any section page is still passing old tab props, TypeScript will error and the Vite test process will fail — fix each flagged page.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/AppShell.tsx tests/client/components/AppShell.test.tsx tests/client/App.test.tsx client/src/pages/
git commit -m "feat: rewire AppShell — MX-4 OS shell complete, Plan 1 done"
```

---

## Self-Review Checklist

This was done inline — issues found and fixed:

1. **Ring/Sparkline/StatusCore tests** — originally misplaced in Plan 2 scope, moved to Plan 1 (Tasks 5–6). ✅
2. **`MX4Mood` type** — exported from `MX4Sigil.tsx` so `AskSheet` and `AppShell` can reference it. ✅
3. **Sheet animation in tests** — `render` state initializes from `open` prop, so children render immediately when `open=true`. No fake timers needed. ✅
4. **`textPrimary` → `text` rename** — existing `BottomSheet.tsx` used `COLORS.textPrimary`. After Task 10 rewrites that file from scratch it uses `COLORS.text`. Any remaining files referencing `textPrimary` will cause TypeScript errors in Task 12 step 5 — fix as they appear. ✅
5. **Tab cleanup** — Task 12 Step 3 explicitly handles removing stale tab props from section pages. ✅
