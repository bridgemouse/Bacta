# Bacta — Design System Reference

## Design Philosophy

**Dark UI always.** There is no light mode. There will never be a light mode. This is an instrument console, not a health app. Every design decision starts from this premise and works outward.

The aesthetic is a piece of equipment from the Star Wars galaxy — a dark sci-fi instrument console that reads biometrics. The design language is hardware, not software. Cards are panels. Sections are channels. Navigation is a system selector. MX-4's briefings are transmissions.

This means:
- Colors come from physical objects: bacta fluid cyan, ember, periwinkle, void black
- Typography uses monospace for all numbers and labels — data on an instrument reads in mono
- Animations are mechanical (aperture rotation, telemetry bars, breathing glow) not playful
- No rounded corners softer than 7–8px; these are panels, not cards in a wellness app
- The texture overlay is a literal scanline pattern — a visual reference to CRT instrumentation

When a design decision feels wrong, ask: "Would this look at home in the cockpit of a ship from the Star Wars galaxy?" If yes, it probably works. If it looks like a mobile health app, it doesn't.

---

## Color Tokens

Source of truth: `client/src/theme.ts`. CLAUDE.md has incorrect accent values — use `theme.ts`.

### Core Palette

```typescript
// From client/src/theme.ts
export const MX4_COLOR = '#2bc4e8'   // bacta cyan — MX-4's signature

export const COLORS = {
  base:            '#0f1117',   // app background
  surface:         '#111827',   // card/panel background
  surfaceElevated: '#1e2d3d',   // elevated surfaces, active states
  border:          '#1e2d3d',   // card borders (subtle)
  line:            '#27384a',   // hairline dividers, chip borders
  text:            '#f4f7fb',   // primary text
  textSecondary:   '#94a3b8',   // secondary text (labels)
  textMuted:       '#56657a',   // tertiary / mono meta
  green:           '#4ade80',   // tone: POSITIVE only
  amber:           '#fbbf24',   // tone: CAUTION only
  red:             '#f87171',   // tone: FLAG only
  mx4Green:        '#4ade80',   // alias — same as green
  mx4Amber:        '#fbbf24',   // alias — same as amber
  mx4Red:          '#f87171',   // alias — same as red
}
```

**Tone color rule:** `green` means POSITIVE, `amber` means CAUTION, `red` means FLAG. These are the only sanctioned uses of these three colors. They appear in verdict badges and delta indicators. **Never use tone colors to tint whole cards.** The MX-4 Briefing Card and metric cards always wear the section's accent color — only the badge reads the tone.

### Section Accent Colors

These are locked. Do not change them. `theme.ts` is authoritative — confirmed against `design_bacta-handoff-package/` (v3 design baseline; production has since iterated but accent values are unchanged).

```typescript
export const SECTION_ACCENTS: Record<SectionKey, string> = {
  home:      '#2bc4e8',   // MX-4 cyan — Home is MX-4's own surface
  recovery:  '#64b5f6',   // sky blue
  training:  '#fb923c',   // ember
  sleep:     '#a78bfa',   // violet
  nutrition: '#3ecf8e',   // clinical green
  bloodwork: '#ef6f6c',   // coral
  dailylog:  '#f5cf5e',   // gold
}
```

**Why `home` is cyan:** Home is MX-4's own surface. The other sections wear their own colors; he adapts his presentation to them. But Home is his — it stays bacta cyan.

**Why MX-4's sigil and dock stay cyan in every section:** MX-4's identity is cyan. The section accent colors the section's *frame* around him. His sigil, the BottomBar, and the Overview/Trends toggle remain `#2bc4e8` regardless of which section is active. Accent is context. Cyan is identity.

---

## Typography

| Family | Stack | Use |
|---|---|---|
| Hanken Grotesk | `'Hanken Grotesk', system-ui, sans-serif` | MX-4 narrative prose, headlines, the training status word |
| JetBrains Mono | `'JetBrains Mono', ui-monospace, monospace` | **ALL** numbers, labels, readouts, rail headers, chip text, axes, timestamps |

```typescript
export const FONT_UI   = "'Hanken Grotesk', system-ui, sans-serif"
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
```

**JetBrains Mono is the workhorse.** Nearly every metric value, unit, label, and axis tick uses it. Hanken Grotesk is reserved for MX-4's narrative sentences and large display words. When in doubt, use mono.

Loaded via Google Fonts in `client/index.html`.

---

## Utility Functions

### `hexA(hex, alpha)` — `client/src/lib/hexA.ts`

Converts a hex color and alpha value (0–1) to an `rgba()` string. Used everywhere for transparent variants of accent colors.

```typescript
hexA('#2bc4e8', 0.35)  // → 'rgba(43, 196, 232, 0.35)'
hexA('#64b5f6', 0.08)  // → 'rgba(100, 181, 246, 0.08)'
```

Common alpha values:
- `0.035` — texture grid lines
- `0.08–0.16` — background fills
- `0.18–0.28` — card borders and top edges
- `0.35–0.55` — prominent borders, active states

### `bactaTexture(accent)` — `client/src/lib/bactaTexture.ts`

Returns a CSS `background` string that generates the scanline/grid texture overlay. Applied to `AppShell` with `pointer-events: none`. On Home, accent is `#2bc4e8`. In sections, accent is the section color.

```typescript
bactaTexture('#64b5f6')  // → CSS background with 3px scanlines + 26px accent grid
```

---

## CSS Keyframes

Defined in `client/index.css`. Referenced by name in inline `animation` style strings (e.g., `animation: 'mx4spin 14s linear infinite'`). Never define additional keyframes in component files — add to `client/index.css`.

| Keyframe | Definition | Typical Use |
|---|---|---|
| `mx4spin` | `to { transform: rotate(360deg) }` | MX-4 sigil aperture rotation — used at 14s for idle, 18s reverse for some moods |
| `mx4breathe` | Scale 0.82→1, opacity 0.7→1 | StatusCore breathing pulse — indicates liveness |
| `mx4ping` | Scale 1→2.4, opacity 0.8→0 | StatusCore expanding ring ping — pulses outward every cycle |
| `mx4tele` | ScaleY 0.35→1 | FTelemetry bars — simulates signal telemetry data activity |
| `mx4blink` | Opacity step 1→0 at 50% | MX-4 narrative cursor — the blinking block at end of briefing text |
| `mx4shimmer` | Background-position 200%→-200% | Skeleton card shimmer on calibrating sections |
| `mx4glowbreathe` | Box-shadow pulse via CSS `var(--mx4-accent)` | Ask MX-4 button halo — breathing glow on the cyan aperture button |

---

## Inline Styles Rule

**No CSS files in components. No Tailwind utility classes in components. No CSS modules.**

All component styles use React inline style objects. This is a hard constraint from the project's design origin — the Claude Design handoff was built in inline-styled JSX, and the production code matches that approach.

**The one exception:** `client/index.css` — this is the only CSS file that components may reference, and only by keyframe animation name (e.g., `animation: 'mx4shimmer 1.6s ease infinite'`). No class-based styles from this file should be applied to components.

**Why:** The design system is token-based. `hexA(accent, 0.18)` produces the correct border color for any accent without a class lookup. Inline styles make this explicit and debuggable — you can inspect an element and immediately see exactly where every style value comes from.

**What breaks if violated:** Adding Tailwind utility classes to a component would couple it to the Tailwind CSS bundle and break the inline-style contract. Adding a new CSS file would introduce a parallel styling system with no enforcement boundary. Either introduces hidden dependencies that survive component moves or tree-shaking.

---

## Component Catalog

### Shell & Navigation

**`AppShell.tsx`** — Fixed iOS viewport shell. Provides the three-row layout (TopBar, content zone, BottomBar), the global texture overlay, and sheet mounting points for NavSheet and AskSheet.

**`TopBar.tsx`** (`BactaStatusBar`) — Two modes: Home (`BACTA·OS` + idle MX4Sigil + MX-4 ONLINE indicator) and section (back chevron + section `Sigil` + channel label). Has a cyan bottom border and glow on Home; section color in sections.

**`BottomBar.tsx`** (`BactaDock`) — Always cyan. Three zones: left Ask MX-4 button (animated aperture with breathing glow), center Overview/Trends toggle (hidden for unbuilt sections), right nav circle (hex menu icon).

**`BottomSheet.tsx`** (`NavSheet`) — All Systems nav sheet. Slides up from bottom with dimmed backdrop. Two-column channel grid with section sigils, current metric values, and status words. Full-width Home row at top.

**`AskSheet.tsx`** — Ask MX-4 conversational sheet (~88% height). MX-4 greeting bubble, suggested prompts, pinned input bar.

**`Sheet.tsx`** — Animated bottom-sheet wrapper primitive used by both NavSheet and AskSheet. Handles enter/exit animation (`translateY` 100%→0, `cubic-bezier(.22,.61,.36,1)`, 0.36s) and backdrop.

**`MX4Card.tsx`** — Contains three exported items:
- `MX4Briefing` — The section briefing card with verdict badge. Used in all four built sections.
- `TransmissionPanel` — Simpler transmission card without verdict badge. Used in SectionShell.
- `MX4Card` — **Deprecated**, returns `null`. Left in place to avoid import breakage.

**`MetricTile.tsx`** — `SystemCard` for the Home grid and `MetricTile` for individual metrics.

**`SectionShell.tsx`** — Calibrating skeleton for Nutrition, BloodWork, DailyLog. Renders shimmer skeletons + STANDBY TransmissionPanel.

### Primitives

**`MX4Sigil.tsx`** — The MX-4 aperture icon. Six moods (see Sigil Mood Map below). Accepts `color`, `size`, `spin`, `mood` props.

**`Sigil.tsx`** — Per-section geometric line glyph (SVG, 1.6px stroke). One design per section. Replaces the emoji placeholders from early development.

**`NavIcon.tsx`** — Stroked hexagon containing three menu lines. "All Systems" nav trigger.

**`Ring.tsx`** — Circular progress ring (SVG). Used in Sleep score gauge and Home grid.

**`Sparkline.tsx`** — Area sparkline (SVG). Used in metric tiles and trend rows.

**`StatusCore.tsx`** — Breathing status dot with ping ring. Green = ONLINE/positive, colored by tone in verdict badges.

**`ReadinessDots.tsx`** — 1–5 filled dot readiness indicator.

**`Bracket.tsx`** — Four-corner console bracket ticks. Applied to hero cards (Gauge panels, HeadlineCards) in the section color.

**`FTelemetry.tsx`** — Animated telemetry bar graph. Used in briefing card footers.

### Visualization

**`Bars7.tsx`** — 7-bar chart with today's bar highlighted. Accepts optional goal line and value formatter. Used in Sleep Trends (duration) and Recovery Trends (score).

**`BodyBattery.tsx`** — Charge-cell bar showing min→max band with a glowing current-fill marker and tick marks at 25/50/75.

**`Delta.tsx`** — ▲/▼ change badge. `lowerBetter` prop flips the good/bad color assignment (lower = green for RHR, Stress, Respiration).

**`Gauge.tsx`** — 270° arc gauge with centered value content. Used for Recovery Score and Sleep Score.

**`HeadlineCard.tsx`** — Two-up headliner metric card shell with bracket ticks. Used for HRV/Body Battery in Recovery, VO2max/Endurance in Training.

**`HealthStatusTile.tsx`** — Overnight vitals tile with section-accent chrome and StatusCore badge for in-range status.

**`IntensityBar.tsx`** — Stacked moderate/vigorous intensity bar with goal marker. Vigorous counts double (Garmin's weighting).

**`LoadBand.tsx`** — Horizontal load band with optimal zone tinted and glowing marker at current value. Low / Optimal / High labels.

**`LogEntry.tsx`** — Activity log line. Expandable to show training effect, HR zones per activity. Phase C expansion (HR zones per activity) currently behind `hasContent = false`.

**`Rail.tsx`** — Section divider rail with accent label (left), gradient line, and right-side meta text.

**`SleepDepth.tsx`** — Topographic sleep depth area chart (SVG). Shows sleep depth over the night as a filled area — deeper sleep = lower fill. Violet gradient with glowing stepped line, time axis labels.

**`StageDistribution.tsx`** — Sleep stage bar with percentage labels in segment, per-stage breakdown rows, and a footer.

**`StageLegend.tsx`** — Stage color swatch + name + duration + percentage legend. Used below the SleepDepth/StageSplit block.

**`StageSplit.tsx`** — Proportional horizontal bar of four sleep stages (Deep/Light/REM/Awake). Percentage labels inside segments ≥18%.

**`StatusBanner.tsx`** — Training status hero panel. Displays the big training status word (Productive, Maintaining, etc.) in Hanken Grotesk + ember.

**`TrendRow.tsx`** — Trends-tab row: label, current value, directional delta, sparkline or bar chart. Takes `lowerBetter` for RHR/Stress/Respiration.

**`VitalTile.tsx`** — Compact secondary metric tile with sparkline. Used in Recovery vitals 2×2 grid (RHR, Stress, SpO2, Respiration).

**`ZoneDistribution.tsx`** — HR zone vertical list with proportion bars and summary footer. Used in Training Overview.

---

## MX-4 Sigil Mood Map

The MX-4 aperture has six moods. Each is a distinct SVG expression of one hexagonal aperture motif. All moods can optionally spin (`spin` prop, default 14s).

| Mood | Visual | When Used | Character Context |
|---|---|---|---|
| `transmit` | Full concentric rings + bright core | Home (MX-4 speaking to Ethan), Training | Active transmission — MX-4 is actively briefing, sending information outward |
| `idle` | Calm single ring + side ticks | TopBar status indicator | At rest but present — monitoring, not transmitting |
| `listen` | Open "eye" (wide lens + pupil) | Ask MX-4 button, AskSheet | Receiving — waiting for Ethan's input, attention fully inward |
| `think` | Scan dashes + swept arc | SectionShell (calibrating) | Processing — data intake in progress, analysis underway |
| `alert` | Narrowed slit core | Sleep briefing (caution flag) | Elevated attention — something in the data warrants focus |
| `pleased` | Upward squint arc | Recovery briefing (positive) | The closest MX-4 gets to satisfaction — a quiet acknowledgment that the data is good |

**Why these moods express MX-4's character:** MX-4's TC-Series foundation means he doesn't emote dramatically. His expressions are aperture states — mechanical, controlled, precise. `pleased` is a squint, not a smile. `alert` is a narrowed slit, not a flashing warning light. The moods are functional expressions of attentiveness, not performance of feeling.

**Home uses `transmit`** — Home is the briefing, the synthesis, the active delivery of information. MX-4 is speaking.

**Recovery uses `pleased`** — Recovery data, when good, is the most directly satisfying outcome for MX-4's purpose. A rested, recovered Ethan is the system working correctly.

**Sleep uses `alert`** — Sleep data is where MX-4 most often has something to flag. Even when sleep score is high, there's usually an architecture note worth making. Alert is appropriate default attentiveness.

**Training uses `transmit`** — Training briefings are performance readouts. MX-4 is delivering the load and status data. Transmit.

**AskSheet uses `listen`** — Ethan is about to speak. MX-4's aperture opens to receive.

**SectionShell uses `think`** — Calibrating sections have no data yet. MX-4 is in data intake mode.

---

## Card Sizing Reference

```typescript
export const CARD_SIZES = {
  hero:  220,   // Gauge panels, full-width hero cards
  chart: 170,   // Bars7, SleepDepth
  bar:   140,   // IntensityBar, LoadBand
  pair:  110,   // HeadlineCard pairs
  tile:   88,   // VitalTile, compact metrics
  row:    52,   // TrendRow
}
```

---

## Spacing & Radius Reference

From design handoff — not enforced programmatically, but followed consistently.

- **Content zone padding:** `13px 13px 20px`
- **Card radius:** 7–8px (standard), 13–14px (hero/briefing cards), 22px (sheet top corners)
- **Card gap:** 9px
- **Rail margin:** `16px 0 11px`
- **Card border:** 1px `line` color; hero cards add 1px top accent edge
- **Glow:** `0 0 8px <accent>80` (active elements), `0 0 26px <accent>1a` (briefing card shadow)
