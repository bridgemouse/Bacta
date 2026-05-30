# Bacta Dashboard UI — Design Spec

**Date:** 2026-04-26
**Status:** Approved

---

## Overview

Plan 2 builds the React frontend for Bacta. The data layer (SQLite, Express API, Garmin poller) is complete from Plan 1. This plan wires up the client: a PWA saved to the iPhone home screen that shows a morning health overview powered by MX-4 insight cards and live Garmin data.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS — dark mode only, no component library |
| Charts | Recharts |
| State | Local `useState` per component — no global store |
| Routing | None — tab state is local `useState` in `App.tsx` |

---

## Layout

**Bottom tab bar** with 5 tabs: **Home · Recovery · Sleep · Training · Fitness**

Tabs are lazy-mounted: a tab component is not rendered until first visited, then stays mounted for the session. Inactive tabs are hidden via `display: none` after first mount — no remounting, no repeat fetches.

---

## File Structure

```
client/
├── src/
│   ├── main.tsx
│   ├── App.tsx                   # Tab state, lazy mount logic, TabBar
│   ├── api.ts                    # All fetch helpers for /api/*
│   ├── tabs/
│   │   ├── HomeTab.tsx           # MX-4 briefing + stat grid + log form
│   │   ├── RecoveryTab.tsx       # MX-4 recovery card + HRV chart
│   │   ├── SleepTab.tsx          # MX-4 sleep card + sleep duration chart
│   │   ├── TrainingTab.tsx       # MX-4 training card + steps chart
│   │   └── FitnessTab.tsx        # MX-4 fitness card + VO2 max chart
│   ├── components/
│   │   ├── TabBar.tsx            # Bottom nav — 5 icon+label buttons
│   │   ├── StatGrid.tsx          # 3-column stat tile grid
│   │   ├── StatTile.tsx          # Single metric tile (label, value, unit, color)
│   │   ├── AziCard.tsx           # Renders MX-4 HTML via dangerouslySetInnerHTML
│   │   ├── TrendChart.tsx        # Recharts 7-day bar/line chart, parameterized
│   │   └── LogForm.tsx           # Readiness selector + caffeine + supplements
│   └── index.css                 # Tailwind directives
├── index.html
└── public/
    ├── manifest.json
    ├── icon-192.png
    └── icon-512.png
```

---

## Home Tab

The default tab and morning overview. Scroll from top to bottom follows a natural morning routine:

1. **MX-4 Daily Briefing card** — renders `GET /api/insights/recovery` as HTML via `dangerouslySetInnerHTML`. Shimmer skeleton while loading. "April 26 · Recovery section ›" link taps to the Recovery tab.
2. **Stat grid** — 3-column grid of 6 `StatTile` components. Fixed metric-to-color mapping:
   - Recovery: green (`#34d399`)
   - HRV: blue (`#60a5fa`)
   - Sleep: purple (`#a78bfa`)
   - Body Battery: amber (`#f59e0b`)
   - Stress: rose (`#fb7185`)
   - VO2 Max: indigo (`#818cf8`)
3. **Steps bar** — inline in `HomeTab.tsx` (not a separate component). Steps count + progress bar toward 10,000 goal.
4. **Force poll button** — small refresh icon in the Home header. POSTs to `POST /api/poll`, shows 2-second spinner, then refetches summary data. Triggers an immediate Garmin sync.
5. **Log form** (`<LogForm>`) — at the bottom of the scroll. Readiness 1–5 button selector, caffeine mg input, supplements multi-select (creatine, vitamin D, omega-3, magnesium — hardcoded). POSTs to `POST /api/manual`. Brief "Logged ✓" confirmation on success.

---

## Section Tabs

Each section tab has the same structure: MX-4 section card at top, 7-day trend chart below.

| Tab | MX-4 section | Chart metric |
|-----|---------------|--------------|
| Recovery | `recovery` | `hrv` |
| Sleep | `sleep-quality` | `sleep_duration` |
| Training | `training-week` | `steps` |
| Fitness | `vo2-fitness` | `vo2max` |

Section tabs are thin wrappers — each is approximately:
```tsx
<AziCard section="recovery" />
<TrendChart metric="hrv" days={7} />
```

---

## Components

### `AziCard.tsx`
- Fetches `GET /api/insights/:section` on mount
- Renders HTML fragment via `dangerouslySetInnerHTML`
- Shows shimmer skeleton while loading
- Renders nothing (no error state) if section file doesn't exist yet — handles the Blood Work stub case silently

### `TrendChart.tsx`
- Props: `metric: string`, `days: number` (default 7)
- Fetches `GET /api/garmin/:metric?from=YYYY-MM-DD&to=YYYY-MM-DD` on mount
- `BarChart` for discrete metrics (steps, sleep_duration), `LineChart` for continuous metrics (hrv, vo2max)
- Dark background (`#1f2937`), blue bars/line (`#3b82f6`), no gridlines, minimal axes

### `StatTile.tsx`
- Props: `label: string`, `value: string | number`, `unit?: string`, `color: string`
- Dark card (`#374151` background), label small and uppercase, value large and bold

### `LogForm.tsx`
- Fetches `GET /api/manual/today` on mount to pre-populate if already logged today
- Readiness: 5 inline buttons (1–5), one active at a time
- Caffeine: number input, step 25mg
- Supplements: checkboxes for creatine, vitamin D, omega-3, magnesium
- Submit: `POST /api/manual` with `{ date, readiness, caffeine_mg, supplements }` (`supplements` is an array, serialised to JSON by the server)
- On success: shows "Logged ✓" for 2 seconds, keeps values populated

### `TabBar.tsx`
- 5 fixed-bottom buttons: Home (🏠), Recovery (💙), Sleep (😴), Training (🏃), Fitness (📈)
- Active tab: blue icon + label. Inactive: grey
- Height 56px, sits above iPhone home indicator safe area

---

## Data Flow

```
Component mounts (first visit)
  → useEffect fires
  → fetch /api/*
  → useState(data) → render
```

No global state, no prop drilling. Each component fetches and owns its data independently.

**Error handling:** Failed fetches render nothing or keep last value. No retry logic — this is a local WiFi app; if the server is unreachable the page won't load regardless.

---

## API Endpoints Used

| Component | Method | Endpoint |
|-----------|--------|----------|
| `HomeTab` | GET | `/api/garmin/summary` |
| `HomeTab` / `AziCard` (briefing) | GET | `/api/insights/recovery` |
| `AziCard` (sections) | GET | `/api/insights/:section` |
| `TrendChart` | GET | `/api/garmin/:metric?from=&to=` |
| `LogForm` | GET | `/api/manual/today` |
| `LogForm` | POST | `/api/manual` |
| Force poll button | POST | `/api/poll` |

---

## PWA Configuration

**`public/manifest.json`:**
```json
{
  "name": "Bacta",
  "short_name": "Bacta",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#111827",
  "theme_color": "#111827",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Icons: dark background (`#111827`), simple "B" or medical cross. Generated as static PNG files — no build step needed.

**`index.html`** includes:
```html
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#111827">
```

No service worker for v1 — offline caching adds complexity for marginal gain on a local WiFi app. Add if needed later.

---

## Visual Design

- **Base background:** `#111827`
- **Card background:** `#1f2937`
- **Tile background:** `#374151`
- **Primary accent:** `#3b82f6` (blue)
- **Text:** `#f9fafb` (primary), `#9ca3af` (secondary)
- **Font:** system font stack — no web font imports
- **Dark mode only** — never light mode

---

## Out of Scope for Plan 2

- Nutrition tab (deferred until MacroFactor account exists)
- Blood Work tab (deferred until Factor results arrive)
- Service worker / offline caching
- MX-4 insight card generation (Plan 4)
- Containerization / deployment (Plan 5)
