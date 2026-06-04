# Bacta — Claude Code Session Briefing

## What is this?
Bacta is a private health dashboard iOS PWA for one user. It pulls biometrics nightly from
Garmin Connect. An AI companion named **MX-4** (a Star Wars-inspired droid with a
"bacta healing-fluid" cyan identity) narrates the data. The aesthetic is a dark sci-fi
instrument console — not a health app, not a wellness product.

**Tech stack (target app):** React + Vite, inline styles only (no CSS modules, no Tailwind
utility classes in components). Global CSS keyframe animations defined in `index.html`.
iOS PWA — fixed shell, one scrollable content zone, no browser chrome.

**Run the prototype:** open `design/Bacta - Prototype.html` in a browser to see everything live.

---

## Design Tokens

### Colors
```
base:      #0f1117   app background
surface:   #111827   card / panel backgrounds
elevated:  #1e2d3d   elevated surfaces
line:      #27384a   card borders, hairlines
text:      #f4f7fb   primary
text2:     #94a3b8   labels / secondary
text3:     #56657a   meta / axis / tertiary
green:     #4ade80   tone: POSITIVE only
amber:     #fbbf24   tone: CAUTION only
red:       #f87171   tone: FLAG only
```

### Section accents — locked, do not change
```
Home:       #2bc4e8   MX-4's cyan (also his signature color)
Recovery:   #64b5f6   sky blue
Training:   #fb923c   ember
Sleep:      #a78bfa   violet
Nutrition:  #3ecf8e   (not yet wired)
Blood Work: #ef6f6c   (not yet wired)
Daily Log:  #f5cf5e   (not yet wired)
```

### Fonts
- **UI / body:** `'Hanken Grotesk', system-ui, sans-serif` — narrative prose, headlines
- **Mono:** `'JetBrains Mono', ui-monospace, monospace` — ALL numbers, labels, readouts

### Global keyframe animations (define in CSS)
`mx4spin`, `mx4breathe`, `mx4ping`, `mx4blink`, `mx4glowbreathe`, `mx4shimmer`
Exact definitions in the prototype `<style>` block and `design/bacta-final.jsx`.

---

## App Shell Structure
```
<fixed column, full viewport height>
  <BactaStatusBar />        channel-tinted top bar (~52px)
  <content zone />          flex:1, overflow-y:auto, overscroll-behavior:none
                            padding: 13px 13px 20px
  <BactaDock />             fixed bottom command cluster (~80px + safe area)
```

### Bottom Dock — ALWAYS MX-4 cyan (#2bc4e8), on every section
One rounded pill housing, three zones:
- **Left:** circular Ask-MX-4 button (44px circle, animated aperture sigil, breathing glow)
- **Center:** Overview / Trends segmented control — chamfered octagonal "tech panel"
  (clip-path cut corners). Only shown on built sections. Always cyan — not the channel accent.
- **Right:** circular nav button (44px circle, hex menu icon, soft slate glow)
- Hairline cyan dividers between zones.

---

## Routing & State
```js
// In BactaApp (bacta-app.jsx)
const BUILT = { home: true, recovery: true, sleep: true, training: true };

// view: 'home' | 'recovery' | 'sleep' | 'training' | 'nutrition' | 'bloodwork' | 'dailylog'
// tab: 'overview' | 'trends'  — reset to 'overview' on every section change
// nav: boolean — All Systems nav sheet
// ask: boolean — Ask MX-4 sheet

// Routing:
if (view === 'home')       → <HomeView tab={tab} onOpenSection={go} />
if (view === 'recovery')   → <RecoveryView tab={tab} />
if (view === 'sleep')      → <SleepView tab={tab} />
if (view === 'training')   → <TrainingView tab={tab} />
else                       → <SectionShell sectionKey={view} />  // shimmer placeholder
```

---

## MX-4 Briefing Card — Top of every Overview + Trends view
**Critical color rule (iterated several times — get this right):**
- Card **frame** (border, glow, background tint, top accent edge, sigil label, chips, telemetry)
  = **section accent color** (Recovery blue, Sleep violet, Training ember, Home cyan)
- **Tone** (POSITIVE / CAUTION / FLAG) = only in the small **badge pill** top-right
- MX-4's **sigil** is always `#2bc4e8` regardless of section
- Narrative text: 15.5px Hanken Grotesk, `#eef4fb`, line-height 1.5
- Blinking cursor after narrative = accent color, `mx4blink` animation

### Per-section voice & tone
| Section | Card color | Tone badge | MX-4 mood |
|---|---|---|---|
| Home | `#2bc4e8` | POSITIVE (green) | transmit |
| Recovery | `#64b5f6` | POSITIVE (green) | pleased |
| Sleep | `#a78bfa` | CAUTION (amber) | alert |
| Training | `#fb923c` | POSITIVE (green) | transmit |

Briefing copy and chip data: `design/bacta-data.jsx` → `BACTA.brief`

---

## The Four Built Sections

### Home — Overview
- MX-4 briefing (cyan card, green POSITIVE badge)
- "SYSTEMS" rail → `3 ONLINE · 3 CALIBRATING`
- **2-column System Card grid** (this is the Round-1 layout — keep it)
  - Live cards: Recovery / Training / Sleep — show value, sparkline or ring, status word
  - Pending cards: Nutrition / Blood Work / Daily Log — dashed border, 60% opacity, "CALIBRATING"

### Home — Trends
- MX-4 briefing → "WEEK IN REVIEW" rail → stack of TrendRows, each in **its own channel accent**
  (Recovery rows = blue, Sleep = violet, Training = ember)
- Metrics: Recovery score, HRV, Sleep duration, Training load, Intensity minutes

### Recovery — Overview
1. MX-4 briefing (blue card)
2. **Readiness hero** — 270° Gauge (`value=74, max=100`) + "READY" status chip + plain-English verdict
3. **Two headliner cards** (side by side): HRV `61ms` with delta vs 54ms baseline + sparkline |
   Body Battery `74 now` with PEAK 88 / LOW 22 + charge-cell bar
4. 2×2 VitalTile grid: Rest HR / Stress / SpO2 / Respiration — each with directional delta + sparkline

### Recovery — Trends
- Recovery score: featured Bars7 chart
- Trend rows: HRV, Body Battery peak, Rest HR, Stress, SpO2, Respiration
- Use `lowerBetter=true` on RHR / Stress / Respiration so delta arrow colors correctly

### Sleep — Overview
1. MX-4 briefing (violet card, **amber CAUTION** badge)
2. **Anchors panel**: big `8h 06m` duration + `82 GOOD` Gauge (size 96, side by side)
3. **Architecture card — the star — two stacked treatments:**
   - `SleepDepth`: filled topographic depth area chart + time axis `11:42p · 02:00 · 04:00 · 06:31a`
   - `StageSplit`: proportional bar Deep/Light/REM/Awake with % labels inside ≥18% segments
   - `StageLegend`: swatch + name + duration + % for all four stages
4. Two tiles: SpO2 avg / Respiration avg

Stage colors: Deep `#7c5cff`, Light `#a78bfa`, REM `#c4b5fd`, Awake `#56657a` (50% opacity)

### Sleep — Trends
- Duration: featured Bars7 formatted in hours (`v/60`)
- Score + Duration trend rows

### Training — Overview
1. MX-4 briefing (ember card)
2. `StatusBanner`: gradient panel with Training sigil + big word **"Productive"** (Hanken Grotesk, ember) + "Block 4 of 8"
3. Two anchor cards: VO2max `52` (+1 delta, Fitness Age 31) | Endurance `71/100` (TRAINED, sparkline)
4. **Acute Load card**: `LoadBand` — horizontal scale 200→480, tinted optimal zone 280–420, glowing position marker
5. **Intensity Minutes card**: `IntensityBar` — moderate + vigorous (2×) stacked toward 150/wk goal
6. **Activity Log** (`LogEntry` × 3): each line = `› [sport glyph] Run  AEROBIC` + `10.2 km · 52:14 · 612 kcal · 148 bpm` + timestamp

LogEntry layout: flex row, sport glyph in a 32px circle, activity name + feel tag left, stat line below, timestamp pushed right.

### Training — Trends
- Intensity: featured Bars7 (weekly total)
- Load / VO2max / Endurance trend rows

---

## Key Visualization Components (`design/bacta-viz.jsx`)

| Component | Description |
|---|---|
| `Gauge` | 270° arc, `value/max`, centered children (the number), stroke 7, glow drop-shadow |
| `BodyBattery` | Gradient charge cell: min→max band + glowing current fill + tick marks at 25/50/75 |
| `SleepDepth` | Stepped area chart: each data point is a depth level (0=awake, 3=deep), filled gradient below the line |
| `StageSplit` | Proportional horizontal bar of sleep stages |
| `StageLegend` | Stage swatch + name + duration + % row |
| `Bars7` | 7-bar chart, today highlighted accent, past bars at 28% alpha, optional goal dashed line |
| `IntensityBar` | Stacked moderate / vigorous bar; vigorous visually 2× weight; goal marker hairline |
| `LoadBand` | Horizontal 200–480 scale, optimal zone tinted, marker at current value |
| `TrendRow` | Trends-tab card: label, value, unit, delta badge, + sparkline or bars right side |
| `VitalTile` | Compact metric tile: label, directional delta, big value, tiny sparkline |
| `StatusBanner` | Training status hero panel with gradient + sigil + big status word |
| `LogEntry` | Activity log line — see Training section above |
| `ActivityGlyph` | SVG sport icons (run / strength) |
| `Rail` | Section divider: accent label + gradient line + right meta text |
| `Delta` | ▲/▼ badge; `lowerBetter` prop flips good/bad coloring |
| `Bracket` | Four corner-tick CSS spans (console framing on cards) |
| `MX4Briefing` | The MX-4 narrative card — see dedicated section above |

Shared primitives in `design/bacta-core.jsx`: `Gauge` (same), `Ring` (circular progress),
`Sparkline` (soft area fill), `StatusCore` (breathing dot), `MX4Sigil` (aperture sigil with moods),
`Sigil` (section geometric icon), `NavIcon`, `hexA(hex, alpha)` utility.

---

## Garmin Metric Notes (for accurate labels and copy)
- **Body Battery** (0–100): charges overnight during sleep, drains with stress + activity.
  Surface `max` (peak, usually on waking), `min` (overnight low), `now` (current).
- **HRV** (ms): last night's average vs rolling `baseline`. Higher vs baseline = better recovered.
- **Training Status**: Garmin's verdict from VO2max trajectory + load + HRV. Productive means fitness is improving.
- **Acute Training Load**: rolling load with an **optimal band** (here 280–420). Above = overreaching.
- **Intensity Minutes**: vigorous counts double (Garmin weighting). Goal = 150 weighted min/week.
- **Sleep stages**: Deep / Light / REM / Awake. "Time in bed" ≥ "time asleep" (difference = awake time).

---

## What Comes Next
- **Nutrition, Blood Work, Daily Log** — data pipelines not live. Wire in as data arrives;
  render `SectionShell` until then.
- **Ask MX-4 sheet** — input/response UI. Shell exists (`design/bacta-navsheet.jsx`),
  AI response not wired. Should call the AI sync API with the nightly metrics as context.
- **Live Garmin sync** — replace static `BACTA.metrics` in `design/bacta-data.jsx` with
  nightly pulled data of the same shape.
- **MX-4 briefing text** — should be AI-generated from the nightly sync, not hardcoded.
  The `BACTA.brief` shape shows the required fields: `line`, `tone`, `mood`, `meta`, `chips`.

---

## Source Files (in `design/`)
Load order matters — later files depend on earlier ones:
```
bacta-core.jsx      tokens, shared primitives, hexA(), all exported to window
bacta-data.jsx      static metric data + MX-4 briefings (replace with live API)
bacta-final.jsx     shell: BactaStatusBar, BactaDock, SystemCard, TransmissionPanel
bacta-viz.jsx       all Round-2 visualization primitives + MX4Briefing
bacta-recovery.jsx  RecoveryView (Overview + Trends)
bacta-sleep.jsx     SleepView (Overview + Trends)
bacta-training.jsx  TrainingView (Overview + Trends)
bacta-home.jsx      HomeView (Overview + Trends)
bacta-navsheet.jsx  NavSheet (All Systems) + AskSheet (Ask MX-4)
bacta-app.jsx       BactaApp root — routing, state, SectionShell placeholder
```

Screenshots of every view in `screenshots/`. Full layout spec per-view in `README.md`.
