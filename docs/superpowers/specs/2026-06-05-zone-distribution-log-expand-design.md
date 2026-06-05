# Spec: ZoneDistribution + LogEntry Expand
**Date:** 2026-06-05  
**Scope:** Training page — HR Zones vertical layout + expandable activity log entries

---

## Background

Visual audit of the production app against the v3 prototype (`bacta-v3-viz.jsx`, `bacta-viz-v2.jsx`) revealed two gaps in the Training page:

1. HR Zones shows a top stacked bar + compact flat legend. The prototype's `ZoneDistribution` component adds a vertical per-zone list with mini bars and a summary footer.
2. Activity log entries are static divs. The prototype's `LogEntryV3` makes each row a tappable toggle with chevron rotation and an expandable details panel.

All other sections (Recovery, Sleep, Training — overview/trends/overlays) match the prototype.

---

## Feature 1 — `ZoneDistribution` component

### New file
`client/src/components/viz/ZoneDistribution.tsx`

### Props
```ts
interface ZoneDistributionProps {
  zones: Array<{ zone: number; label: string; mins: number; pct: number; color: string }>
  accent: string
}
```
This matches the exact shape returned by `useTrainingData` (no hook changes needed).

### Layout — three layers

**Layer 1: Top stacked bar** (`height: 18`, `borderRadius: 6`, `overflow: hidden`, `gap: 2`, `marginBottom: 13`)
- One segment per zone where `pct > 0`: `width: pct%`, `background: zone.color`, `borderRadius: 3`
- Zone label inside segment if `pct >= 13`: `"Z{zone}"` — 8px mono, bold, `#0b0d12`

**Layer 2: Vertical zone rows** (`flexDirection: column`, `gap: 7`) — all 5 zones always shown
Each row: `display: flex`, `alignItems: center`, `gap: 8`
- Color dot: `10×10px`, `borderRadius: 2`, `background: zone.color`, `opacity: mins > 0 ? 1 : 0.25`
- Zone number: `"Z{zone}"` — 8.5px mono, `textMuted`, `minWidth: 16`
- Zone name: `11.5px` UI font, `textSecondary`, `flex: 1`
- Time value: `"{mins}m"` if active, `"—"` if 0 — 10px mono, `fontWeight: 700` if active, `minWidth: 34`, `textAlign: right`
- Mini bar: `width: 48`, `height: 4`, `borderRadius: 2`, `background: rgba(255,255,255,0.06)` — inner fill div `width: pct%`, `background: zone.color`, `opacity: mins > 0 ? 1 : 0.15`
- Percentage: `"{pct}%"` if active, `""` if 0 — 8px mono, `textMuted`, `minWidth: 26`, `textAlign: right`

**Layer 3: Summary footer** (`marginTop: 10`, `display: flex`, `gap: 14`)
- `"TOTAL "` + `"{totalMins} min"` — 8.5px mono, textMuted / textSecondary bold
- `"Z2+ "` + `"{z2PlusMins} min"` — 8.5px mono, textMuted / accent bold

Where:
- `totalMins = Math.round(zones.reduce((s, z) => s + z.mins, 0))`
- `z2PlusMins = zones.filter(z => z.zone >= 2).reduce((s, z) => s + z.mins, 0).toFixed(1)`

### `TrainingPage.tsx` change
Replace the inline stacked bar + flat legend block (current lines 167–183) with `<ZoneDistribution zones={TRN.hrZones} accent={A} />` inside the existing card `<div>`. The outer card structure (Bracket, padding, InfoOverlay) is unchanged.

Add import: `import { ZoneDistribution } from '../components/viz/ZoneDistribution'`

---

## Feature 2 — `LogEntry.tsx` expand mechanic

### File changed
`client/src/components/viz/LogEntry.tsx` — in-place update, no new component.

### Behavior
- Every entry has a tappable header row. Tapping toggles `open` state.
- `›` chevron rotates 90° when open (`transition: 'transform 0.18s ease'`).
- Card border color transitions from `COLORS.line` → `hexA(accent, 0.4)` when open (`transition: 'border-color 0.18s ease'`).
- Expanded panel renders only when `open && hasContent`. `hasContent` is `false` until Phase C data fields are added to `GarminActivity` — so currently tapping only animates the chevron/border with no panel.

### Structure
```tsx
// outer wrapper div — border animated
<div style={{ border: `1px solid ${open ? hexA(accent, 0.4) : COLORS.line}`, transition: 'border-color 0.18s ease', overflow: 'hidden', ... }}>

  // header row — full-width button
  <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}>
    <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s ease', ... }}>›</span>
    {/* activity glyph, name, stats, timestamp — unchanged */}
  </button>

  {/* expanded panel — Phase C placeholder, renders nothing today */}
  {open && hasContent && (
    <div style={{ borderTop: `1px solid ${hexA(accent, 0.2)}`, padding: '12px 13px 13px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Training Effect, HR Zones, Run Dynamics — all conditional on Phase C fields */}
    </div>
  )}
</div>
```

`hasContent` computed from activity fields that don't yet exist on `GarminActivity`:
```ts
const hasContent = false // will become: !!(a.trainingEffect || a.activityHrZones || (isRun && a.runDynamics))
```

### No API or data changes
`GarminActivity` interface, `garmin_activities` table, and `useTrainingData` are unchanged.

---

## Tests

### `ZoneDistribution.test.tsx` (new)
- Renders one segment per active zone in the stacked bar
- Renders all 5 rows in the vertical list
- Active zone shows `"{mins}m"` and `"{pct}%"`
- Inactive zone shows `"—"` and no percentage
- Summary shows correct TOTAL and Z2+ values
- Returns null (or empty) when all zones have 0 mins

### `LogEntry.test.tsx` (new)
- Renders activity name, stats, timestamp
- Clicking the button toggles open state
- Chevron has `rotate(90deg)` transform when open
- Border color contains `0.4` opacity accent when open
- Expanded panel not rendered when `hasContent` is false

---

## Out of scope
- Phase C data (Training Effect, per-activity HR Zones, Running Dynamics)
- Body Battery intraday arc (Recovery)
- Sleep Consistency card (Sleep)
- Any changes to `useTrainingData`, API endpoints, or DB schema
