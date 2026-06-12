---
name: bacta-component
description: Use when creating any new reusable UI component in Bacta
---

# Bacta Component Creation

## Overview
Enforces design system consistency for every new component. Read before writing a single line.

## Before Writing Code

1. Read `client/src/theme.ts` — identify the exact tokens you'll use
2. Find the component in `design_bacta-handoff-package/Bacta - Prototype v3.html` — match it exactly
3. Check `client/src/components/` — can you extend an existing component instead of creating a new one?

## Style Rules — no exceptions

**Inline styles only.** No CSS files, no Tailwind, no CSS modules.
```tsx
// ✅
<div style={{ background: COLORS.surface, borderRadius: 12 }}>

// ❌ — wrong approach
<div className="bg-surface rounded-xl">

// ❌ — never hardcode hex
<div style={{ background: '#111827' }}>
```

**Fonts:**
- Numbers, labels, readouts → `fontFamily: "'JetBrains Mono', ui-monospace, monospace"`
- Prose, narrative, headlines → `fontFamily: "'Hanken Grotesk', system-ui, sans-serif"`

**Colors — always from `theme.ts`:**
- Surfaces, text, borders → `COLORS.*`
- Section identity → `SECTION_ACCENTS.*`
- MX-4 identity → `MX4_COLOR`
- RGBA values → `hexA(hex, alpha)` from `client/src/lib/hexA.ts` — never write `rgba(...)` by hand
- Scanline/grid backgrounds → `bactaTexture(accent)` from `client/src/lib/bactaTexture.ts`

## Card Components

Apply the card size system as `minHeight` (never `height` — cards must grow with content):

| Size | px | Use for |
|---|---|---|
| hero | 220 | Score gauges |
| chart | 170 | Chart cards |
| bar | 140 | Trend bar cards |
| pair | 110 | Half-width paired cards |
| tile | 88 | 2×2 quarter-grid tiles |
| row | 52 | Status banners, compact rows |

If the component is a card, wrap it with `InfoCard` from `client/src/components/InfoCard.tsx` and pass `title`, `description`, and `source` props for the frosted overlay behavior.

## Animations

Use only keyframes defined in `client/index.css` — never define new `@keyframes` inside a component:

`mx4spin` · `mx4breathe` · `mx4ping` · `mx4tele` · `mx4blink` · `mx4glowbreathe` · `mx4shimmer`

Reference in inline styles: `animation: 'mx4spin 1s linear infinite'`

## After Writing

1. `npx tsc --noEmit` — fix any type errors before continuing
2. `/run` + Playwright `browser_take_screenshot` — compare against prototype
3. `/code-review` on the new component file

## Common Mistakes
| Mistake | Fix |
|---|---|
| Hardcoded hex in component | Replace with `COLORS.*` or `SECTION_ACCENTS.*` |
| `rgba(...)` written by hand | Replace with `hexA(hex, alpha)` |
| New `@keyframes` in component | Use existing keyframes from `client/index.css` |
| `height` instead of `minHeight` | Always `minHeight` on card root divs |
| Card without InfoCard wrapper | Wrap and pass `title`, `description`, `source` |
