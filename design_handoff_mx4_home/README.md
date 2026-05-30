# Handoff: Bacta — MX-4 Home + Section Nav

## Overview
Bacta is a personal health-recovery PWA (dark-only, iOS) whose assistant is **MX-4**, a complex medical/protocol droid. This package covers the **redesigned Home screen**, the **"All Systems" section nav**, the **Ask MX-4 conversation sheet**, and a **section shell** pattern for the six sections that aren't wired to a backend yet.

The visual concept is **"MX-4 OS"**: the app reads like an instrument MX-4 operates — a system status bar, an incoming "transmission" briefing panel, bracketed "System Cards," and a global scanline/grid texture. The name *Bacta* (the Star Wars healing fluid, which glows cyan) is made literal: **MX-4's signature color is bacta-cyan**.

## About the Design Files
The files in `design/` are **design references built in HTML/React-via-Babel** — prototypes that show the intended look and behavior. They are **not** production code to copy verbatim. The task is to **recreate these designs in the existing Bacta codebase** (Vite + React + TypeScript + Tailwind v4, React Router) using its established patterns. The repo already has a skeleton (`client/src/theme.ts`, `components/`, `pages/`) — extend/replace those files rather than introducing a parallel system.

Open `design/Bacta — Prototype.html` to interact with the full flow. `design/Bacta Home — Directions.html` is the exploration archive (four directions + color/expression studies) for context only.

## Screenshots (`screenshots/`)
- `01-home.png` — Home: status bar, MX-4 transmission briefing, SYSTEMS rail, six System Cards, dock.
- `02-all-systems-nav.png` — the All Systems nav sheet (Home·Overview row + six channels + MX-4 footer).
- `03-section-shell-recovery.png` — a section shell (Recovery), showing contextual periwinkle color + shimmer skeletons.
- `04-ask-mx4.png` — the Ask MX-4 conversation sheet (greeting, suggested prompts, input bar).

## Fidelity
**High-fidelity.** Colors, typography, spacing, iconography, and interactions are final. Recreate pixel-faithfully. The one deliberately-unfinished part is the **section interiors** (Recovery, Training, Sleep, Nutrition, Blood Work, Daily Log), which are intentionally **shells** (skeleton placeholders) to be filled section-by-section as each backend lands.

---

## Design Tokens

### Fonts
- **UI / body:** `Hanken Grotesk` (weights 400–800). Google Fonts.
- **Data / chrome / labels:** `JetBrains Mono` (400–700). Google Fonts.
- All-caps mono labels use `letter-spacing` 0.08–0.20em.

### Core colors
| Token | Hex | Use |
|---|---|---|
| base | `#0f1117` | app background |
| surface | `#111827` | cards, sheets |
| elevated | `#1e2d3d` | raised tiles |
| border | `#1e2d3d` | card borders (subtle) |
| line | `#27384a` | dividers, chip borders |
| text | `#f4f7fb` | primary text |
| text2 | `#94a3b8` | secondary |
| text3 | `#56657a` | tertiary / mono meta |
| green | `#4ade80` | **connection = ONLINE** + "healthy" semantics |
| amber | `#fbbf24` | caution tone |
| red | `#f87171` | **connection = OFFLINE** + flag tone |

### MX-4 identity
- **`#2bc4e8` (bacta-cyan)** — MX-4's signature. Used for all MX-4 chrome on Home: status-bar sigil, transmission panel border/glow/labels, SYSTEMS rail, Ask button, dock border, global texture grid lines.
- Translucent ramps are generated from the accent via an alpha helper (`hexA(hex, a)` in `bacta-core.jsx`): typical alphas 0.035 (texture), 0.08–0.16 (fills), 0.28–0.55 (borders).

### Section channels (clinical palette — each clears the cyan band)
| Section | Hex | Name |
|---|---|---|
| Recovery | `#7c9af8` | periwinkle |
| Training | `#f5853a` | ember |
| Sleep | `#b08cf0` | lilac |
| Nutrition | `#3ecf8e` | clinical green |
| Blood Work | `#ef6f6c` | coral |
| Daily Log | `#f5cf5e` | gold |

> Replace the current values in `client/src/theme.ts` `SECTION_ACCENTS`/equivalent with these.

### Radius / spacing
- Card radius 7px (System Cards), 11px (nav items), 12–14px (transmission panel), 22px (sheet top corners), 50% (dock circular buttons).
- Card padding ~12–14px. Screen gutters 13–16px. Grid gap 9–10px.
- Status bar top padding 50px (under the notch); dock bottom padding 24–26px (home indicator).

### Texture (global)
A fixed overlay (`pointer-events:none`) layering: a 3px horizontal scanline (`rgba(255,255,255,0.016)`) + a 26px accent grid (`hexA(accent,0.035)` lines). On Home the accent is cyan; in a section it is the channel color.

---

## Iconography — the MX-4 sigil system
One hexagonal aperture motif with **moods** (see `MX4Sigil` in `bacta-core.jsx`). All are stroked, on a `0 0 48 48` viewBox:
- **transmit** — full concentric rings + core (speaking / briefing; used in transmission header).
- **idle** — calm single ring + side ticks (status bar).
- **listen** — open "eye" (wide lens + pupil); used on the Ask button.
- **think** — scan dashes + swept bar (loading/calibrating).
- **alert** — narrowed slit core (caution/flag).
- **pleased** — upward squint arc (positive read; Ask greeting avatar).
`spin` slowly rotates the aperture; `glow` adds a soft blur filter.

**Section sigils** (`Sigil` in `bacta-core.jsx`) are abstract geometric line glyphs (1.6px stroke) per section — replace the emoji placeholders in the current `SECTION_ICONS`.

**Nav icon** (`NavIcon`) — a stroked hexagon (MX-4's shape) containing 3 menu lines. Reads as "all systems" menu.

### Contextual color rule (important)
MX-4 is **bacta-cyan system-wide (Home)**, but **adopts the active section's channel color** when you're inside that section (status bar, transmission, Ask button, texture all shift). His core can also shift by **tone** (green=positive, amber=caution, red=flag). This is the only sanctioned way MX-4 changes color — keep the identity disciplined.

---

## Screens / Views

### 1. Home (`pages/HomePage.tsx`)
Column layout: status bar (fixed) · scrolling content · dock (fixed).

- **Status bar** — left: idle sigil (cyan, 18px) + `BACTA·OS` (mono 700, ·OS in text3). Right: green `StatusCore` dot + `MX-4 ONLINE` (green mono). 1px cyan bottom border + faint cyan glow. Bg `rgba(17,24,39,0.92)`.
- **Transmission panel** — rounded 14px, cyan gradient wash + 1px cyan border + outer glow. Header row: transmit sigil (19px) + `INCOMING // MX-4` (cyan mono) + right `MON · MAY 29 · 06:00` (text3). Body: assessment paragraph (Hanken 16.5px/1.5, `#eef4fb`) ending in a blinking cyan caret. Footer (1px cyan top divider): three mono chips `TONE POSITIVE` / `FLAGS 0` / `SYNC OK` (value in cyan) + right-aligned animated telemetry bars.
- **SYSTEMS rail** — `SYSTEMS` (cyan mono) · gradient divider · `6 ONLINE` (text3).
- **System Cards** — 2-col grid. Each card (`SystemCard`): surface bg, 1px line border, radius 7, **rounded bracket corner ticks** in the channel color, a channel-colored top accent edge, sigil + section label (mono) + index `01`–`06`. Big mono value + unit, mono sub-line, and a viz: sparkline (Recovery/Training), ring with % (Sleep/Nutrition), check + `NOMINAL` (Blood Work), or readiness dots (Daily Log). Tapping a card → that section.
- **Dock** (`components/BottomBar.tsx`) — left: **Ask MX-4** button = 44px circular ring (cyan border + radial fill + breathing glow) holding the `listen` eye, with `Ask MX-4` / `TAP TO TALK` label. Right: 44px circular ring (neutral `line` border) holding the `NavIcon`. Both 44px for balance.

**Exact Home data (current mock values):**
| Section | value | unit | sub | status | viz |
|---|---|---|---|---|---|
| Recovery | 74 | battery | HRV ↑ 61ms | Good | sparkline [50,54,49,57,55,60,66,74] |
| Training | 342 | load | Moderate · wk 4 / 8 | On track | sparkline [280,300,260,320,340,310,330,342] |
| Sleep | 8.1 | h | Score 82 | Solid | ring 0.82 |
| Nutrition | 2,340 | kcal | Protein 142 / 160g | On target | ring 0.94 |
| Blood Work | Clear | — | No flags · 0 panels | Nominal | check |
| Daily Log | 4 | / 5 | Logged today | Logged | 4/5 dots |

MX-4 assessment copy: *"Recovery is solid and trending up. Training load is on track for week four. Nutrition is close — protein is the only gap worth closing tonight."*

### 2. All Systems nav sheet (`components/BottomSheet.tsx`)
Bottom sheet, slides up over a dimmed/blurred backdrop. Rounded-22 top, cyan top border, MX-4 OS texture, grab handle.
- **Header:** NavIcon + `ALL SYSTEMS` (cyan) + `SELECT A CHANNEL` sub + circular close (×).
- **Home · Overview** — full-width row: cyan idle-sigil chip + `Home · Overview` + `6 systems nominal` + chevron. Active state = cyan tint border.
- **CHANNELS** divider, then a **2-col grid of the six channels**. Each item: channel-colored hex chip (sigil), label, current value+unit, and right-aligned status, with a channel top edge + rounded brackets. Tapping → navigate + close.
- **Footer:** idle sigil + `WHERE TO, COMMANDER?` (mono) + telemetry bars.

### 3. Section shell (one per section, e.g. `pages/RecoveryPage.tsx`)
Until a section's backend exists, render a **shell**:
- Status bar: back chevron + section sigil + `SECTION` title — **all in the channel color** + green `MX-4 ONLINE`.
- Transmission panel in the **channel color** (MX-4 wearing the room): `MX-4 // RECOVERY`, `STANDBY` meta, a one-line greeting, chips `CH RECOVERY` / `DATA PENDING`.
- A channel rail (`RECOVERY … CALIBRATING`) and 2–3 **shimmer skeleton** instrument cards.
- Footer: `think` sigil + `MX-4 IS CALIBRATING THIS SYSTEM`.
Replace this body with real instruments as each section is built.

### 4. Ask MX-4 sheet
Taller bottom sheet (~88%). Header: transmit sigil + `MX-4` + `ASK ANYTHING · MEDICAL & PROTOCOL` + close. Body: an MX-4 greeting bubble (accent-tinted, avatar = `pleased` sigil), a `SUGGESTED` row of prompt chips, and a pinned input bar (`Message MX-4` field with blinking caret + accent send button). **The text input lives here, not in the dock.** The sheet adopts the current screen's accent (cyan on Home, channel color in a section).

---

## Interactions & Behavior
- **Open nav:** tap dock hex button → nav sheet animates up (transform translateY 100%→0, 0.36s `cubic-bezier(.22,.61,.36,1)`; backdrop fades to `rgba(6,9,14,0.62)` + blur 3px).
- **Open Ask:** tap dock Ask button → Ask sheet animates up identically.
- **Navigate to section:** tap a System Card (Home) or a channel (nav sheet) → set active section; nav sheet closes. Status bar/dock/transmission recolor to the channel.
- **Back:** section status-bar chevron → Home.
- **Close sheet:** tap backdrop or × → animates down then unmounts (~0.34s).
- **Ambient motion:** sigil slow-spin (14s), Ask-button breathing glow (3.6s), telemetry bars (`mx4tele`), blinking caret (1.1s step), skeleton shimmer (`mx4shimmer` 1.6s). Respect `prefers-reduced-motion` — gate these in production.

## State Management
Minimal, all local to an app shell (see `BactaApp` in `design/bacta-app.jsx`) — but in the real app this maps to **React Router** routes you already have:
- `view` → the current route (`/`, `/recovery`, …). Use the router instead of local state.
- `navOpen` / `askOpen` → booleans for the two sheets (local UI state or a small context).
- `accent` is derived: `view === home ? '#2bc4e8' : SECTION_ACCENTS[section]`.

## Keyframes (CSS)
`mx4spin` (rotate 360), `mx4breathe` (scale 0.82→1 / opacity), `mx4ping` (expand+fade), `mx4tele` (scaleY 0.35→1), `mx4blink` (step opacity), `mx4glowbreathe` (box-shadow pulse), `mx4shimmer` (background-position 200%→-200%). Exact definitions are in the `<style>` block of `design/Bacta — Prototype.html`.

## Assets
No raster/image assets — everything is SVG (sigils, icons, charts) and CSS. Fonts via Google Fonts (Hanken Grotesk, JetBrains Mono). Charts (sparklines, rings) are hand-built SVG primitives in `bacta-core.jsx` (`Sparkline`, `Ring`, `ReadinessDots`) — reimplement as small React components or swap for your charting lib, matching stroke weights (sparkline 1.6–1.8, ring stroke 3–3.5, rounded caps).

## Files (in `design/`)
- `Bacta — Prototype.html` — **the interactive prototype** (start here).
- `bacta-core.jsx` — design tokens (`BACTA`), `hexA`, sigils (`Sigil`, `MX4Sigil`, `NavIcon`), viz primitives (`Ring`, `Sparkline`, `StatusCore`, `ReadinessDots`), `Bracket`.
- `bacta-final.jsx` — Home building blocks: `TransmissionPanel`, `SystemCard`, `BactaStatusBar`, `BactaDock`, `HomeBody`.
- `bacta-navsheet.jsx` — `Sheet` wrapper, `NavSheet` (All Systems), `AskSheet`.
- `bacta-app.jsx` — `BactaApp` (state/routing shell) + `SectionShell`.
- `bacta-colors.jsx` — color/expression studies (reference only).
- `ios-frame.jsx` — preview device bezel (do NOT ship; it's only for the prototype).
- `Bacta Home — Directions.html` — exploration archive (reference only).

## Codebase mapping (existing skeleton → design)
| Existing file | Becomes |
|---|---|
| `client/src/theme.ts` | update `SECTION_ACCENTS` to the clinical palette; add `MX4_COLOR = '#2bc4e8'`, ONLINE/OFFLINE = green/red |
| `components/TopBar.tsx` | → `BactaStatusBar` (home + section/back variants, contextual color) |
| `components/BottomBar.tsx` | → `BactaDock` (Ask + hex nav) |
| `components/BottomSheet.tsx` | → `NavSheet` (All Systems) + the shared `Sheet` wrapper |
| `components/MX4Card.tsx` | → `TransmissionPanel` |
| `components/MetricTile.tsx` | → `SystemCard` |
| `pages/HomePage.tsx` | → status bar + `HomeBody` + dock |
| `pages/*Page.tsx` (6) | → `SectionShell` for now; fill per backend |
