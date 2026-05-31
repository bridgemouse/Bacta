# Handoff: Bacta — Section Content (Recovery · Sleep · Training · Home)

## Overview

Bacta is one person's private health dashboard — an iOS PWA styled as a sci-fi
instrument console. An AI companion named **MX-4** (a droid with a cyan
"bacta healing-fluid" identity) narrates the user's biometrics, which are pulled
nightly from **Garmin Connect**.

Round 1 established the app shell and design system (top status bar, bottom
command dock, navigation sheet, "Ask MX-4" sheet, the dark instrument palette,
per-section accent colors, typography, and the bracket-framed card language).

**This handoff covers Round 2: the content inside each of the four live sections.**
Three data channels are live — **Recovery, Sleep, Training** — plus **Home**, a
cross-section overview where MX-4 synthesizes the whole picture. The other three
sections (Nutrition, Blood Work, Daily Log) are not yet wired and appear as
dimmed "CALIBRATING" placeholders.

Each section has two states, switched by a segmented control in the bottom dock:
- **Overview** — today's snapshot. MX-4's briefing card pinned at top, then the
  section's headline metrics.
- **Trends** — 7-day charts/sparklines for the section's core metrics. Less text,
  more visual — like Garmin Connect's weekly view, but moodier and more personal.

## About the Design Files

The files in `design/` are **design references created in HTML/React (via inline
Babel)** — prototypes that demonstrate the intended look, layout, data shape, and
behavior. **They are not production code to copy directly.** Everything is
inline-styled JSX loaded through an in-browser Babel transform; there is no build
system, no component library, no state management beyond React `useState`.

The task is to **recreate these designs in the target codebase** (the real app is
a **React + Vite** project per the original brief) using its established patterns,
component primitives, and conventions. If starting fresh, React + Vite with plain
inline styles or CSS-in-JS is a faithful match for how these were built. **Use
inline styles** — the brief specifies no CSS modules and no Tailwind utility
classes in components. CSS keyframe animations are defined globally (see
[Animations](#animations--transitions)).

## Fidelity

**High-fidelity.** These are pixel-level mockups with final colors, typography,
spacing, data values, and interactions. Recreate the UI faithfully using the
codebase's primitives. All hex values, font sizes, and spacing below are exact and
taken directly from the source.

---

## Design Tokens

All tokens live in `design/bacta-core.jsx` on the `BACTA` object. Reproduce them as
your app's theme.

### Core palette (`BACTA.color`)
| Token | Hex | Use |
|---|---|---|
| `base` | `#0f1117` | App background (base layer) |
| `surface` | `#111827` | Card / panel background |
| `elevated` | `#1e2d3d` | Elevated surfaces |
| `border` | `#1e2d3d` | Default border |
| `line` | `#27384a` | Hairline dividers, card borders |
| `text` | `#f4f7fb` | Primary text |
| `text2` | `#94a3b8` | Secondary text (labels) |
| `text3` | `#56657a` | Tertiary text (meta, axis ticks) |
| `green` | `#4ade80` | Tone: positive |
| `amber` | `#fbbf24` | Tone: caution |
| `red` | `#f87171` | Tone: flag |

### Section accent colors (locked by brief — do not change)
| Section | Accent | Meaning |
|---|---|---|
| Home | `#2bc4e8` | MX-4's own surface → bacta cyan |
| Recovery | `#64b5f6` | sky blue — restoration |
| Training | `#fb923c` | ember — exertion |
| Sleep | `#a78bfa` | violet — rest |
| Nutrition | `#3ecf8e` | clinical green — fuel (pending) |
| Blood Work | `#ef6f6c` | coral red — labs (pending) |
| Daily Log | `#f5cf5e` | gold — log (pending) |

> Note: the original Round-2 brief listed Home as `#4ade80` (green). This was
> intentionally overridden to bacta cyan `#2bc4e8` — Home is MX-4's own surface,
> so it wears his signature color. Green now only ever means "positive tone."

### MX-4 signature
- `BACTA.mx4Color` = `#2bc4e8` (bacta healing-fluid cyan). MX-4's sigil, the
  bottom command dock, and the Overview/Trends toggle are **always** this cyan,
  on every section — it's his persistent identity/control deck.

### Tone system
`BACTA.toneColor(tone)` maps `'positive' → green`, `'caution' → amber`,
`'flag' → red`. Tone applies to MX-4's verdict badge and the per-signal status
dots — **not** to whole cards (see [MX-4 Briefing Card](#mx-4-briefing-card)).

### Typography
| Family | Stack | Use |
|---|---|---|
| UI | `'Hanken Grotesk', system-ui, sans-serif` | Headlines, body, narrative prose |
| Mono | `'JetBrains Mono', ui-monospace, monospace` | Numbers, labels, meta, all instrument readouts |

Mono is the workhorse — nearly every metric value, unit, label, and axis tick is
JetBrains Mono. Hanken Grotesk is reserved for MX-4's narrative sentences and a
few large display words (e.g. the Training status word).

Common type sizes (px): display numbers 30–38 / 700; section metric values
18–26 / 700; rail + card labels 9–9.5 / 600 uppercase, letter-spacing 0.12em;
meta/axis 8–8.5; MX-4 narrative 15.5 / 450, line-height 1.5.

### Radius & spacing
- Card radius: 8–14px (hero cards 13–14, standard cards 8–10).
- Content zone padding: `13px 13px 20px`.
- Inter-card gap: 9px; grid gap 8–9px; rail margin `16px 0 11px`.
- Cards use a subtle 1px `line` border; hero cards add a 1px top accent edge and
  bracket corner ticks (see `Bracket`).

### Shadows / glows
- Accent glow on active elements: `0 0 8px <accent>80` (≈50% alpha).
- MX-4 card: `0 0 26px <accent>1a, inset 0 0 30px <accent>0a`.
- Dock cluster: `0 0 20px <cyan>17, inset 0 1px 0 rgba(255,255,255,0.04)`.
- `hexA(hex, alpha)` helper in `bacta-core.jsx` converts hex+alpha → rgba().

---

## App Shell (Round 1 — context)

A fixed phone frame: **no browser chrome, no page scroll**. Three fixed rows:

1. **Top status bar** (`BactaStatusBar` in `bacta-final.jsx`) — channel-tinted.
   On Home shows `BACTA·OS` + MX-4 sigil; on a section shows a back chevron + the
   section name. Carries a faux iOS clock/battery row.
2. **Content zone** — the **only** scrollable region. `flex: 1; overflow-y: auto;
   overscroll-behavior: none;` padding `13px 13px 20px`.
3. **Bottom command dock** (`BactaDock` in `bacta-final.jsx`) — see below.

A faint radial texture (`bactaTexture`) tints the whole screen with the active
accent at very low alpha.

### Bottom command dock
One rounded "command cluster" pill, centered, **always MX-4 cyan** regardless of
section:
- **Left:** circular "Ask MX-4" button — animated cyan aperture sigil with a
  breathing glow (`mx4glowbreathe`). Opens the Ask MX-4 sheet.
- **Center (sections only):** the **Overview / Trends** segmented control —
  a chamfered octagonal "tech panel" (clip-path polygon with cut corners), cyan
  active segment. Hidden on not-yet-built sections.
- **Right:** circular nav button — hexagonal menu icon with a soft neutral-slate
  glow (`0 0 11px` slate at ~22% alpha). Opens the All Systems nav sheet.
- Hairline cyan dividers (1px, 24px tall, ~22% alpha) separate the three zones.

The two end buttons (42–44px circles) are visually symmetric so the cluster reads
balanced. The toggle stays cyan so it reads as MX-4's control surface, not the
channel's data color.

---

## MX-4 Briefing Card

`MX4Briefing` in `design/bacta-viz.jsx`. Pinned at the top of every **Overview**
(and atop the Home/section **Trends** views too). This is MX-4 *speaking* about
that section — it must feel like it's from him, with a contextual expression.

**Color rule (important — iterated several times):**
- The **card** (frame, glow, top edge, sigil, label, chips, telemetry, blinking
  cursor) wears the **section's accent color** — Recovery blue, Sleep violet,
  Training ember, Home cyan.
- The **tone** (positive/caution/flag) appears **only** in a small verdict
  **badge pill** in the top-right (e.g. green `POSITIVE`, amber `CAUTION`),
  with a breathing `StatusCore` dot. Tone never colors the whole card.

**Structure (top → bottom):**
1. **Header row:** `MX4Sigil` (animated aperture, `mood` per section) · "MX-4 //
   {SECTION}" label · `{meta}` line (e.g. `LAST NIGHT · 11:42–06:31`) · verdict
   badge pill pushed right.
2. **Narrative:** one paragraph in MX-4's voice, 15.5px Hanken Grotesk, color
   `#eef4fb`, line-height 1.5, followed by a blinking block cursor in the accent
   color (`mx4blink` animation).
3. **Footer row:** 2–3 mono "chips" (key + accent-colored value, e.g. `HRV +7ms`)
   and a small `FTelemetry` bar graphic, separated by a 1px top border.

**Per-section voice & mood** (data in `design/bacta-data.jsx` → `BACTA.brief`):
- **Home** — `mood: transmit`, tone positive. Synthesizes across all channels:
  "Recovery is charged and HRV is up seven points. You slept long but lightly —
  REM ran short. Training is productive, though load is creeping…"
- **Recovery** — `mood: pleased`, tone positive. "Strong overnight. HRV climbed to
  61ms, well above your 54ms baseline… You are cleared for a hard session."
- **Sleep** — `mood: alert`, tone caution. "Duration was generous at 8h 06m, but
  the night was light — REM held but deep sleep finished early and you stirred
  near 03:00…"
- **Training** — `mood: transmit`, tone positive. "Status holds at Productive —
  VO2max ticked to 52. Acute load is 342 and climbing toward the top of your
  optimal band…"

MX-4 sigil moods are defined in `MX4Sigil` (`bacta-core.jsx`): `transmit` (full
aperture, speaking), `idle`, `listen` (open lens), `think` (scanning dashes),
`alert` (narrowed slit), `pleased` (upward squint arc). Each is a distinct SVG
expression of one aperture motif.

---

## The Data (from Garmin Connect)

All section data lives in `design/bacta-data.jsx` → `BACTA.metrics`,
`BACTA.signals`, `BACTA.brief`. These are realistic sample values shaped exactly
like the Garmin metrics. Replace with live data of the same shape. **Do not invent
metrics beyond these** — the design is built around exactly this data.

7-day trend arrays are ordered oldest→today; the window ends on the current day.
`BACTA.day = ['Tu','We','Th','Fr','Sa','Su','Mo']` labels them (last = today).

### What the Garmin metrics mean (for accurate copy/labels)
- **HRV** (heart-rate variability, ms): overnight average; compared against a
  rolling **baseline** (here 54ms). Higher vs baseline = more recovered.
- **Body Battery** (0–100): Garmin's energy gauge. It **charges** during rest/sleep
  and **drains** with stress/activity. Report daily **max** (peak, usually on
  waking) and **min** (low). Shown as a charge cell from min→max with a live marker.
- **Resting Heart Rate** (bpm): lower is better.
- **Recovery Score / Training Readiness** (0–100): the synthesizing number — how
  ready the body is to train, derived from HRV, sleep, load, etc.
- **Stress** (0–100): Garmin's HRV-derived all-day stress; lower is better.
- **SpO2** (%): blood oxygen saturation.
- **Respiration** (breaths/min): lower (at rest) is better.
- **Sleep Score** (0–100) and **stages**: deep / light / REM / awake, as durations
  and percentages. "Time in bed" ≥ "time asleep" (the difference is awake time).
- **VO2max** (mL/kg/min): aerobic fitness; drives the **Fitness Age** readout.
- **Training Status**: Garmin's verdict — Productive, Maintaining, Detraining,
  Peaking, etc.
- **Acute Training Load**: rolling load number with an **optimal band** (here
  280–420). Above the band = overreaching; the design shows a marker on the band.
- **Endurance Score** (0–100): long-duration aerobic capability.
- **Intensity Minutes**: weekly moderate + vigorous minutes toward a goal (150/wk).
  Vigorous counts double (Garmin weighting) — the bar reflects this.

---

## Screens / Views

There are 4 sections × 2 tabs = 8 primary views, plus the nav and Ask sheets
(Round 1). Each section view file exports a single `<XView tab="overview|trends">`
component. The content zone wrapper is `RecScroll` (in `bacta-recovery.jsx`).

### 1. Home — Overview  (`design/bacta-home.jsx` → `HomeView tab="overview"`)
**Purpose:** the daily briefing — MX-4 synthesizes all live channels into one
narrative, then the user sees the Round-1 System Card grid.
**Layout:**
- `MX4Briefing` (Home, cyan, positive badge) pinned top.
- `Rail` label `SYSTEMS`, right text `3 ONLINE · 3 CALIBRATING`.
- 2-column grid (`gap: 9`) of System Cards (`SystemCard` from `bacta-final.jsx`,
  Round-1 component): one card per section, each tappable → opens that section.
  - Live cards (Recovery, Training, Sleep, …) show the metric value/unit/sub,
    a sparkline or ring, and a status word.
  - Pending cards (Nutrition, Blood Work, Daily Log) render as `PendingCard` —
    dashed border, 0.6 opacity, dimmed sigil, `CALIBRATING` state, no fabricated
    numbers. Still tappable (→ `SectionShell` placeholder).
**Note:** Home Overview deliberately reuses the Round-1 System Card grid (don't
replace it with a list) — only the MX-4 briefing is layered above it.

### 2. Home — Trends  (`HomeView tab="trends"`)
**Purpose:** the week, read across all live channels.
**Layout:** MX-4 briefing → `Rail` `WEEK IN REVIEW` → a vertical stack of
`TrendRow`s, one per cross-channel metric (Recovery score, HRV, Sleep duration,
Training load, Intensity), each colored in its **own channel accent** so the eye
can tell channels apart. Footer: "SYNTHESIZED FROM 3 LIVE CHANNELS" with a
thinking MX-4 sigil.

### 3. Recovery — Overview  (`design/bacta-recovery.jsx` → `RecoveryView tab="overview"`)
**Purpose:** today's recovery snapshot. HRV + Body Battery are the headliners;
Recovery Score is the synthesizing hero.
**Layout (top → bottom):**
- MX-4 briefing (blue card, positive badge).
- `Rail` `READINESS` / `SYNTHESIZED`.
- **Hero:** a 270° instrument `Gauge` (size 108, accent blue) showing Recovery
  Score `74 / 100`, beside a "READY" status chip + a one-line plain-language
  verdict. Gradient-tinted panel with bracket ticks.
- **Two headliner cards** side by side (`HeadlineCard`, flex row, gap 9):
  - **HRV · last night:** big `61 ms`, delta vs 54 avg (`+7ms`, green up-arrow),
    sparkline footer.
  - **Body Battery:** big `74 now`, PEAK 88 / LOW 22, `BodyBattery` charge-cell
    footer (gradient band from min→max with a glowing current-fill marker + tick
    marks at 25/50/75).
- `Rail` `VITALS` / `LAST NIGHT`.
- 2×2 grid of `VitalTile`s: Rest HR (48 bpm, lower-better delta), Stress (28),
  SpO2 (96%), Respiration (14 br/min). Each tile: label, directional delta,
  big value+unit, tiny sparkline.

### 4. Recovery — Trends  (`RecoveryView tab="trends"`)
**Layout:** MX-4 briefing → `Rail` `7-DAY READINESS` → a featured Recovery Score
card with a 7-bar `Bars7` chart (today's bar highlighted) → a stack of `TrendRow`s
for HRV, Body Battery (peak), Rest HR, Stress, SpO2, Respiration — each with a
mini value, directional delta over the week, and a sparkline. `lowerBetter` is set
on RHR/Stress/Respiration so the delta color reads correctly.

### 5. Sleep — Overview  (`design/bacta-sleep.jsx` → `SleepView tab="overview"`)
**Purpose:** last night's sleep. Duration + Score are the anchors; **stage
architecture is the star** (shown as graphics, never a table).
**Layout (top → bottom):**
- MX-4 briefing (violet card, **amber CAUTION** badge).
- `Rail` `LAST NIGHT` / `11:42 — 06:31`.
- **Anchors panel:** big **Time Asleep** `8h 06m` (display numerals) + "in bed /
  awake" sub, beside a `Gauge` (size 96) showing Sleep Score `82` / "GOOD".
- **Architecture card (the star)** — two stacked treatments of the same night:
  1. **Depth Field** (`SleepDepth`): a filled topographic area chart of sleep
     depth over the night (deeper = lower), violet gradient fill + glowing stepped
     line, 4 depth gridlines, with a time axis (`11:42p · 02:00 · 04:00 · 06:31a`).
     Reads as *how deep*, not just which stage.
  2. **Split Bar** (`StageSplit`): a proportional horizontal bar of the four
     stages (Deep 18% / Light 57% / REM 25% / Awake), % labels inside segments
     ≥18%.
  - **Stage legend** (`StageLegend`) below: color swatch + name + duration + %
    for Deep / Light / REM / Awake.
  - Stage colors: Deep `#7c5cff`, Light `#a78bfa`, REM `#c4b5fd`, Awake `#56657a`
    (Awake rendered at ~45–50% opacity).
- `Rail` `OXYGEN & BREATH` / `ASLEEP`.
- 2 tiles: **SpO2 · sleep** (95% avg, LOW 91% in amber) and **Respiration**
  (13 br/min, "steady overnight").

> An alternate exploration of 5 stage-graph treatments lives in
> `Bacta - Sleep Stage Options.html` (Hypnogram, Depth Field, Stage Ribbon, Split
> Bar, Depth Column). The shipped design uses **Depth Field + Split Bar**.

### 6. Sleep — Trends  (`SleepView tab="trends"`)
**Layout:** MX-4 briefing → `Rail` `7-NIGHT DURATION` (avg hours) → featured
duration card with a 7-bar `Bars7` chart formatted in hours → `Rail` `SLEEP SCORE`
(avg) → `TrendRow`s for Score (bars) and Duration (sparkline).

### 7. Training — Overview  (`design/bacta-training.jsx` → `TrainingView tab="overview"`)
**Purpose:** today's training picture. Training Status + VO2max are the anchors;
recent activity reads like a **log entry**, not a data row.
**Layout (top → bottom):**
- MX-4 briefing (ember card, positive badge).
- `Rail` `STATUS` / `BLOCK 4 OF 8`.
- **Status banner** (`StatusBanner`): a wide gradient panel with the Training
  sigil and the big word **Productive** (Hanken Grotesk, ember) + "Block 4 of 8".
- **Two anchor cards** (`HeadlineCard`, row): **VO2max** `52` (+1 delta, fitness
  age 31) and **Endurance** `71/100` ("TRAINED", sparkline).
- **Acute Load card:** big `342` + "OPTIMAL", over a `LoadBand` — a horizontal
  scale (200→480) with the optimal zone (280–420) tinted and a glowing marker at
  the current value, LOW / OPTIMAL / HIGH labels.
- **Intensity Minutes card:** `IntensityBar` — a stacked bar of Moderate (210) +
  Vigorous (75, double-weighted) toward a 150/wk goal marker, with a legend.
- `Rail` `ACTIVITY LOG` / `3 SESSIONS`.
- A vertical stack of `LogEntry`s — each reads like a log line:
  `› [glyph] Run  AEROBIC` on top, `10.2 km · 52:14 · 612 kcal · 148 bpm` mono
  stat line below, timestamp (`TODAY · 06:40`) right-aligned. Activity glyphs:
  custom SVG runner / strength icons (`ActivityGlyph`).

### 8. Training — Trends  (`TrainingView tab="trends"`)
**Layout:** MX-4 briefing → `Rail` `7-DAY INTENSITY` (goal 150/wk) → featured
Intensity card with a 7-bar `Bars7` chart (weekly total) → `TrendRow`s for Load
(bars), VO2max (sparkline), Endurance (sparkline).

### Not-yet-built sections (Nutrition, Blood Work, Daily Log)
Render `SectionShell` (`bacta-app.jsx`): MX-4 "STANDBY" transmission panel + a
shimmering skeleton of instrument cards + "MX-4 IS CALIBRATING THIS SYSTEM". The
Overview/Trends toggle is hidden for these. Wire each in as its data goes live.

---

## Reusable Components (visualization primitives)

All in `design/bacta-viz.jsx` unless noted. Inline-styled, accent-driven.

| Component | What it renders |
|---|---|
| `SectionTabs` | Overview/Trends chamfered-octagon segmented control (always cyan) |
| `Gauge` | 270° instrument arc gauge with centered children (value) |
| `Delta` | ▲/▼ change badge; `lowerBetter` flips the good/bad color |
| `BodyBattery` | Charge-cell bar: min→max band + current fill marker + ticks |
| `StageBar` / `StageSplit` | Proportional sleep-stage bars |
| `SleepDepth` | Filled topographic sleep-depth area chart |
| `Hypnogram` | Stepped sleep-stage line (used in the options explorer) |
| `StageLegend` | Stage swatch + name + duration + % legend |
| `Bars7` | 7-day bar chart, today highlighted, optional goal line + value fmt |
| `IntensityBar` | Stacked moderate/vigorous intensity bar with goal marker |
| `TrendRow` | Trends-tab row: label/value/delta + sparkline or bars |
| `VitalTile` | Compact secondary metric tile with sparkline |
| `StatusBanner` | Training status hero banner |
| `LogEntry` + `ActivityGlyph` | Activity-log line with sport glyph |
| `Rail` | Section divider rail (accent label + gradient line + right meta) |
| `MX4Briefing` | The MX-4 narrative card (see its own section) |
| `HeadlineCard` (`bacta-recovery.jsx`) | Two-up headliner metric card shell |
| `SignalCard`/`PendingCard` (`bacta-home.jsx`) | Home grid cards |
| `Gauge`/`Ring`/`Sparkline`/`StatusCore`/`Bracket`/`Sigil`/`MX4Sigil` (`bacta-core.jsx`) | Shared primitives |

---

## Interactions & Behavior

- **Section navigation:** tap a Home System Card, or use the All Systems nav sheet
  (hex grid). Entering a section resets its tab to **Overview**.
- **Back:** chevron in the top bar returns to Home.
- **Overview ⇄ Trends:** the dock segmented control. State is per-app (`tab`), reset
  to `overview` on each section change. Built sections only.
- **Ask MX-4 sheet** / **All Systems nav sheet** (`bacta-navsheet.jsx`): bottom
  sheets with smooth enter/exit transitions.
- **Scrolling:** only the content zone scrolls; top bar and dock are fixed.

### Animations & transitions
Global CSS keyframes (defined in the host HTML, see `Bacta - Prototype.html`):
| Keyframe | Use |
|---|---|
| `mx4spin` | MX-4 sigil aperture rotation (14s / 18s reverse) |
| `mx4breathe` | StatusCore breathing pulse (2.6s) |
| `mx4ping` | StatusCore expanding ring ping (2.6s) |
| `mx4blink` | MX-4 narrative cursor blink (1.1s step) |
| `mx4glowbreathe` | Ask-MX-4 button halo breathing (3.6s) |
| `mx4shimmer` | Skeleton-card shimmer on pending sections (1.6s) |

- Gauge/Ring arcs animate on mount: `stroke-dashoffset/dasharray` over ~1.1s
  `cubic-bezier(.4,0,.2,1)`.
- `Bars7` bars animate height over ~0.8s on mount.
- **The Overview/Trends toggle must remount on accent change** (it's keyed) and
  has **no CSS transition** on its active-segment style — an earlier transition
  caused a stale interpolated color. Keep it transition-free.

## State Management

Minimal — all React `useState` in `BactaApp` (`bacta-app.jsx`):
- `view`: `'home' | 'recovery' | 'sleep' | 'training' | 'nutrition' | 'bloodwork' | 'dailylog'`
- `tab`: `'overview' | 'trends'` (reset to `overview` when `view` changes)
- `nav`: nav sheet open/closed
- `ask`: Ask-MX-4 sheet open/closed
- `BUILT` map gates which sections show the toggle and real content.

In production, replace the static `BACTA.metrics` / `BACTA.signals` / `BACTA.brief`
with data fetched from the Garmin sync (same shape). MX-4's `brief` text + `tone`
+ `mood` would come from the AI synthesis step; everything else is direct metrics.

## Assets

No external image assets. All iconography is inline SVG:
- Section sigils (`Sigil`), MX-4 aperture (`MX4Sigil`), nav hex (`NavIcon`),
  activity glyphs (`ActivityGlyph`), bracket ticks (`Bracket`) — all code.
- Fonts: **Hanken Grotesk** + **JetBrains Mono** from Google Fonts.

## Files (in `design/`)

Loaded in this order by `Bacta - Prototype.html`:
1. `ios-frame.jsx` — phone frame wrapper (prototype-only; replace with real device/PWA shell)
2. `bacta-core.jsx` — **tokens, palette, fonts, shared primitives** (start here)
3. `bacta-data.jsx` — **all section data, signals, and MX-4 briefings**
4. `bacta-final.jsx` — Round-1 shell: status bar, dock, System Card, transmission panel
5. `bacta-viz.jsx` — **Round-2 visualization primitives + MX4Briefing**
6. `bacta-recovery.jsx` — Recovery Overview + Trends
7. `bacta-sleep.jsx` — Sleep Overview + Trends (Depth Field + Split Bar)
8. `bacta-training.jsx` — Training Overview + Trends
9. `bacta-home.jsx` — Home Overview (System Card grid) + Trends
10. `bacta-navsheet.jsx` — All Systems nav sheet + Ask MX-4 sheet
11. `bacta-app.jsx` — root `BactaApp`, routing, SectionShell placeholder

Open `Bacta - Prototype.html` in a browser to run the full prototype.
`Bacta - Sleep Stage Options.html` shows the 5 sleep-stage graph explorations.

## Screenshots (`screenshots/`)

Reference renders of each view (captured from the live prototype):
- `01-home-overview.png` — Home Overview: MX-4 briefing + start of System Card grid
- `02-home-overview-grid.png` — Home Overview: full System Card grid + cyan dock
- `03-home-trends.png` — Home Trends: cross-channel week, per-channel colors
- `04-recovery-overview.png` — Recovery Overview: MX-4 card + Readiness gauge
- `05-recovery-vitals.png` — Recovery Overview: HRV + Body Battery headliners + vitals
- `06-recovery-trends.png` — Recovery Trends: score bars + metric trend rows
- `07-sleep-overview.png` — Sleep Overview: violet card + amber CAUTION + anchors
- `08-sleep-architecture.png` — Sleep Overview: Depth Field + Split Bar + legend
- `09-sleep-trends.png` — Sleep Trends: duration bars + score
- `10-training-overview.png` — Training Overview: ember card + Productive status banner
- `11-training-detail.png` — Training Overview: VO2max/Endurance + Load band + Intensity
- `12-training-trends.png` — Training Trends: 7-day intensity bars

> The Training Overview also ends in an **Activity Log** (`LogEntry` × 3 — Run /
> Strength / Trail Run) below the Intensity card; it sits past the capture fold in
> the fixed device frame but is fully specified under
> [Training — Overview](#7--training--overview-designbacta-trainingjsx--trainingview-taboverview)
> and rendered by `bacta-training.jsx`.
