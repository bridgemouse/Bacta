# Plan 2: Dashboard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React PWA frontend for Bacta — a bottom-tab dashboard showing Garmin health data and MX-4 insight cards, saved to the iPhone home screen.

**Architecture:** Single-page React app with no router — active tab is local state in `App.tsx`. Tabs are lazy-mounted (only rendered on first visit, then kept alive). Each component fetches its own data from the existing Express API. No global state store.

**Tech Stack:** React 19, Vite 8, TypeScript, Tailwind CSS v4 (via `@tailwindcss/vite`), Recharts, Vitest + @testing-library/react for tests.

---

## File Map

| File | Status | Role |
|------|--------|------|
| `client/index.html` | Create | Vite HTML entry, PWA meta tags |
| `client/index.css` | Create | Tailwind v4 import + global base styles |
| `client/src/main.tsx` | Create | React root mount |
| `client/src/api.ts` | Create | All fetch helpers for `/api/*` |
| `client/src/App.tsx` | Create | Tab state, lazy mount logic, layout shell |
| `client/src/tabs/HomeTab.tsx` | Create | MX-4 briefing + stat grid + steps bar + log form + poll button |
| `client/src/tabs/RecoveryTab.tsx` | Create | MX-4 recovery card + HRV trend chart |
| `client/src/tabs/SleepTab.tsx` | Create | MX-4 sleep card + sleep duration chart |
| `client/src/tabs/TrainingTab.tsx` | Create | MX-4 training card + steps chart |
| `client/src/tabs/FitnessTab.tsx` | Create | MX-4 fitness card + VO2 max chart |
| `client/src/components/TabBar.tsx` | Create | 5-tab bottom nav |
| `client/src/components/StatTile.tsx` | Create | Single metric display tile |
| `client/src/components/StatGrid.tsx` | Create | 3-column grid of StatTiles |
| `client/src/components/AziCard.tsx` | Create | Renders MX-4 HTML insight via dangerouslySetInnerHTML |
| `client/src/components/TrendChart.tsx` | Create | Recharts 7-day bar/line chart |
| `client/src/components/LogForm.tsx` | Create | Readiness + caffeine + supplements form |
| `client/public/manifest.json` | Create | PWA manifest |
| `client/public/icon-192.png` | Create | PWA icon (generated) |
| `client/public/icon-512.png` | Create | PWA icon (generated) |
| `scripts/generate-icons.js` | Create | One-time icon generation script (pure Node.js) |
| `vitest.client.config.ts` | Create | Vitest config for React component tests |
| `tests/client/setup.ts` | Create | @testing-library/jest-dom setup |
| `tests/client/api.test.ts` | Create | Unit tests for api.ts |
| `tests/client/StatTile.test.tsx` | Create | Render tests |
| `tests/client/TabBar.test.tsx` | Create | Interaction tests |
| `tests/client/AziCard.test.tsx` | Create | Fetch + render tests |
| `tests/client/TrendChart.test.tsx` | Create | Fetch + render tests |
| `tests/client/LogForm.test.tsx` | Create | Form pre-population + submit tests |
| `tests/client/App.test.tsx` | Create | Lazy mount behaviour tests |
| `vite.config.ts` | Modify | Add Tailwind plugin |
| `package.json` | Modify | Add dependencies, update test scripts |

---

## Task 1: Dependencies, Tailwind, and Client Scaffold

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `vitest.client.config.ts`
- Create: `tests/client/setup.ts`
- Create: `client/index.html`
- Create: `client/index.css`
- Create: `client/src/main.tsx`

- [ ] **Step 1: Install Tailwind v4, Recharts, and test dependencies**

```bash
cd /mnt/c/Users/ebrid/GitHub/Bacta
npm install recharts
npm install --save-dev @tailwindcss/vite @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Expected: No errors. `node_modules/@tailwindcss` and `node_modules/recharts` appear.

- [ ] **Step 2: Add Tailwind plugin to vite.config.ts**

Replace the entire file:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'client',
  build: { outDir: '../dist/client' },
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

- [ ] **Step 3: Create vitest.client.config.ts**

```typescript
// vitest.client.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/client/setup.ts'],
    include: ['tests/client/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 4: Create tests/client/setup.ts**

```typescript
// tests/client/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Update package.json scripts**

In `package.json`, update the `"scripts"` section:

```json
"scripts": {
  "dev:server": "tsx watch server/index.ts",
  "dev:client": "vite",
  "build": "tsc -p tsconfig.server.json && vite build",
  "start": "node dist/server/index.js",
  "test": "vitest run --config vitest.config.ts && vitest run --config vitest.client.config.ts",
  "test:server": "vitest run --config vitest.config.ts",
  "test:client": "vitest run --config vitest.client.config.ts"
}
```

- [ ] **Step 6: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#111827" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Bacta" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <title>Bacta</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create client/index.css**

```css
/* client/index.css */
@import "tailwindcss";

:root {
  color-scheme: dark;
}

* {
  -webkit-tap-highlight-color: transparent;
}

body {
  background-color: #111827;
  color: #f9fafb;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  overscroll-behavior: none;
}

/* Safe area padding for iPhone home indicator */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
```

- [ ] **Step 8: Create client/src/main.tsx**

```tsx
// client/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'

// Placeholder until App.tsx exists
function Placeholder() {
  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-400">Bacta loading...</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>
)
```

- [ ] **Step 9: Verify the dev server starts**

```bash
npm run dev:client
```

Expected: Vite starts on port 5173. Open http://localhost:5173 — should show "Bacta loading..." on a dark background. Stop with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: client scaffold — Tailwind v4, Recharts, vitest client config"
```

---

## Task 2: PWA Manifest and Icons

**Files:**
- Create: `scripts/generate-icons.js`
- Create: `client/public/manifest.json`
- Create: `client/public/icon-192.png` (generated)
- Create: `client/public/icon-512.png` (generated)

- [ ] **Step 1: Create scripts/generate-icons.js**

```javascript
// scripts/generate-icons.js
// Generates solid dark-background PNG icons for the PWA manifest.
// Pure Node.js — no dependencies.
// Run: node scripts/generate-icons.js

import { writeFileSync, mkdirSync } from 'fs'
import zlib from 'zlib'

// CRC32 — required by PNG format
const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[i] = c >>> 0
}
function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff]
  return ((crc ^ 0xffffffff) >>> 0)
}

function makeChunk(type, data) {
  const typeB = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeB, data])))
  return Buffer.concat([len, typeB, data, crcBuf])
}

function makeSolidPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)  // width
  ihdr.writeUInt32BE(size, 4)  // height
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // colour type: RGB truecolour

  // One scanline: filter byte (0 = None) + R G B per pixel
  const row = Buffer.alloc(1 + size * 3)
  row[0] = 0
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r
    row[2 + x * 3] = g
    row[3 + x * 3] = b
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  const idat = zlib.deflateSync(raw)

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('client/public', { recursive: true })

// Background colour: #111827 = rgb(17, 24, 39)
const png192 = makeSolidPNG(192, 17, 24, 39)
const png512 = makeSolidPNG(512, 17, 24, 39)

writeFileSync('client/public/icon-192.png', png192)
writeFileSync('client/public/icon-512.png', png512)

console.log('Generated client/public/icon-192.png and client/public/icon-512.png')
```

- [ ] **Step 2: Run the icon generator**

```bash
node scripts/generate-icons.js
```

Expected: `Generated client/public/icon-192.png and client/public/icon-512.png`

- [ ] **Step 3: Create client/public/manifest.json**

```json
{
  "name": "Bacta",
  "short_name": "Bacta",
  "description": "Personal health dashboard",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#111827",
  "theme_color": "#111827",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 4: Verify manifest loads in dev server**

```bash
npm run dev:client
```

Open http://localhost:5173/manifest.json — should return the JSON above. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add client/public/ scripts/generate-icons.js
git commit -m "feat: PWA manifest and dark-background icons"
```

---

## Task 3: api.ts — Fetch Helpers

**Files:**
- Create: `client/src/api.ts`
- Create: `tests/client/api.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/client/api.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  getGarminSummary,
  getInsight,
  getMetricHistory,
  getManualToday,
  postManual,
  triggerPoll,
} from '../../client/src/api'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('getGarminSummary', () => {
  test('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ steps: 7813, hrv: 58 }) })
    const result = await getGarminSummary()
    expect(result).toEqual({ steps: 7813, hrv: 58 })
    expect(mockFetch).toHaveBeenCalledWith('/api/garmin/summary')
  })

  test('returns empty object on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await getGarminSummary()
    expect(result).toEqual({})
  })
})

describe('getInsight', () => {
  test('returns HTML string on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('<p>MX-4</p>') })
    const result = await getInsight('recovery')
    expect(result).toBe('<p>MX-4</p>')
    expect(mockFetch).toHaveBeenCalledWith('/api/insights/recovery')
  })

  test('returns null on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await getInsight('bloodwork')
    expect(result).toBeNull()
  })
})

describe('getMetricHistory', () => {
  test('returns rows array on success', async () => {
    const rows = [{ date: '2026-04-27', metric: 'hrv', value: 58, unit: 'ms' }]
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ metric: 'hrv', rows }) })
    const result = await getMetricHistory('hrv', 7)
    expect(result).toEqual(rows)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/garmin/hrv?from='))
  })

  test('returns empty array on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await getMetricHistory('vo2max', 7)
    expect(result).toEqual([])
  })
})

describe('getManualToday', () => {
  test('returns entry on success', async () => {
    const entry = { date: '2026-04-27', readiness: 3, caffeine_mg: 200, supplements: '["creatine"]' }
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ entry }) })
    const result = await getManualToday()
    expect(result).toEqual(entry)
  })

  test('returns null when no entry', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ entry: null }) })
    const result = await getManualToday()
    expect(result).toBeNull()
  })
})

describe('postManual', () => {
  test('posts JSON to /api/manual', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await postManual({ readiness: 4, caffeine_mg: 100, supplements: ['creatine'] })
    expect(mockFetch).toHaveBeenCalledWith('/api/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readiness: 4, caffeine_mg: 100, supplements: ['creatine'] }),
    })
  })
})

describe('triggerPoll', () => {
  test('posts to /api/poll/force', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await triggerPoll()
    expect(mockFetch).toHaveBeenCalledWith('/api/poll/force', { method: 'POST' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:client
```

Expected: FAIL — "Cannot find module '../../client/src/api'"

- [ ] **Step 3: Create client/src/api.ts**

```typescript
// client/src/api.ts

const BASE = '/api'

export type GarminSummary = {
  steps?: number
  hrv?: number
  body_battery?: number
  resting_hr?: number
  sleep_duration?: number
  recovery_score?: number
  stress_score?: number
  vo2max?: number
}

export type MetricRow = {
  date: string
  metric: string
  value: number
  unit: string
}

export type ManualEntry = {
  date: string
  readiness: number | null
  caffeine_mg: number | null
  supplements: string | null  // JSON-serialised array e.g. '["creatine","vitamin_d"]'
}

export async function getGarminSummary(): Promise<GarminSummary> {
  const res = await fetch(`${BASE}/garmin/summary`)
  if (!res.ok) return {}
  return res.json()
}

export async function getInsight(section: string): Promise<string | null> {
  const res = await fetch(`${BASE}/insights/${section}`)
  if (!res.ok) return null
  return res.text()
}

export async function getMetricHistory(metric: string, days: number): Promise<MetricRow[]> {
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10)
  const res = await fetch(`${BASE}/garmin/${metric}?from=${from}&to=${to}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.rows ?? []
}

export async function getManualToday(): Promise<ManualEntry | null> {
  const res = await fetch(`${BASE}/manual/today`)
  if (!res.ok) return null
  const data = await res.json()
  return data.entry
}

export async function postManual(payload: {
  readiness?: number
  caffeine_mg?: number
  supplements?: string[]
}): Promise<void> {
  await fetch(`${BASE}/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function triggerPoll(): Promise<void> {
  await fetch(`${BASE}/poll/force`, { method: 'POST' })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:client
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/api.ts tests/client/api.test.ts tests/client/setup.ts vitest.client.config.ts
git commit -m "feat: api.ts fetch helpers with tests"
```

---

## Task 4: StatTile and StatGrid

**Files:**
- Create: `client/src/components/StatTile.tsx`
- Create: `client/src/components/StatGrid.tsx`
- Create: `tests/client/StatTile.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/StatTile.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import { StatTile } from '../../client/src/components/StatTile'
import { StatGrid } from '../../client/src/components/StatGrid'
import type { GarminSummary } from '../../client/src/api'

describe('StatTile', () => {
  test('renders label, value, and unit', () => {
    render(<StatTile label="HRV" value={58} unit="ms" color="#60a5fa" />)
    expect(screen.getByText('HRV')).toBeInTheDocument()
    expect(screen.getByText('58')).toBeInTheDocument()
    expect(screen.getByText('ms')).toBeInTheDocument()
  })

  test('renders dash when value is undefined', () => {
    render(<StatTile label="VO2 MAX" value={undefined} color="#818cf8" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('StatGrid', () => {
  test('renders all 6 stat tiles', () => {
    const summary: GarminSummary = {
      recovery_score: 74,
      hrv: 58,
      sleep_duration: 432,
      body_battery: 62,
      stress_score: 28,
      vo2max: 52,
    }
    render(<StatGrid summary={summary} />)
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
    expect(screen.getByText('74')).toBeInTheDocument()
    expect(screen.getByText('HRV')).toBeInTheDocument()
    expect(screen.getByText('SLEEP')).toBeInTheDocument()
    // sleep_duration 432 minutes → 7.2h
    expect(screen.getByText('7.2h')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:client
```

Expected: FAIL — "Cannot find module '../../client/src/components/StatTile'"

- [ ] **Step 3: Create client/src/components/StatTile.tsx**

```tsx
// client/src/components/StatTile.tsx

type Props = {
  label: string
  value: number | string | undefined
  unit?: string
  color: string
}

export function StatTile({ label, value, unit, color }: Props) {
  const display = value !== undefined && value !== null ? String(value) : '—'

  return (
    <div className="flex flex-col items-center justify-center rounded-xl p-3 bg-gray-700">
      <span className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color }}>
        {label}
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-xl font-bold text-gray-50">{display}</span>
        {unit && value !== undefined && (
          <span className="text-xs text-gray-400">{unit}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create client/src/components/StatGrid.tsx**

```tsx
// client/src/components/StatGrid.tsx
import { StatTile } from './StatTile'
import type { GarminSummary } from '../api'

type Props = {
  summary: GarminSummary
}

function formatSleep(minutes: number | undefined): string | undefined {
  if (minutes === undefined) return undefined
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}.${Math.round(m / 6)}h`
}

export function StatGrid({ summary }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatTile
        label="Recovery"
        value={summary.recovery_score}
        color="#34d399"
      />
      <StatTile
        label="HRV"
        value={summary.hrv}
        unit="ms"
        color="#60a5fa"
      />
      <StatTile
        label="Sleep"
        value={formatSleep(summary.sleep_duration)}
        color="#a78bfa"
      />
      <StatTile
        label="Battery"
        value={summary.body_battery}
        color="#f59e0b"
      />
      <StatTile
        label="Stress"
        value={summary.stress_score}
        color="#fb7185"
      />
      <StatTile
        label="VO2 Max"
        value={summary.vo2max}
        color="#818cf8"
      />
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:client
```

Expected: All tests PASS (including api.test.ts from Task 3).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/StatTile.tsx client/src/components/StatGrid.tsx tests/client/StatTile.test.tsx
git commit -m "feat: StatTile and StatGrid components"
```

---

## Task 5: TabBar

**Files:**
- Create: `client/src/components/TabBar.tsx`
- Create: `tests/client/TabBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/TabBar.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi } from 'vitest'
import { TabBar } from '../../client/src/components/TabBar'
import type { TabId } from '../../client/src/components/TabBar'

describe('TabBar', () => {
  test('renders all 5 tab labels', () => {
    render(<TabBar active="home" onChange={vi.fn()} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
    expect(screen.getByText('Sleep')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Fitness')).toBeInTheDocument()
  })

  test('calls onChange with correct tab id when clicked', async () => {
    const onChange = vi.fn()
    render(<TabBar active="home" onChange={onChange} />)
    await userEvent.click(screen.getByText('Recovery'))
    expect(onChange).toHaveBeenCalledWith('recovery')
  })

  test('active tab has blue colour class', () => {
    render(<TabBar active="sleep" onChange={vi.fn()} />)
    const sleepBtn = screen.getByText('Sleep').closest('button')
    expect(sleepBtn).toHaveClass('text-blue-400')
  })

  test('inactive tabs have grey colour class', () => {
    render(<TabBar active="home" onChange={vi.fn()} />)
    const recoveryBtn = screen.getByText('Recovery').closest('button')
    expect(recoveryBtn).toHaveClass('text-gray-500')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:client
```

Expected: FAIL — "Cannot find module '../../client/src/components/TabBar'"

- [ ] **Step 3: Create client/src/components/TabBar.tsx**

```tsx
// client/src/components/TabBar.tsx

export type TabId = 'home' | 'recovery' | 'sleep' | 'training' | 'fitness'

type Tab = { id: TabId; label: string; icon: string }

const TABS: Tab[] = [
  { id: 'home',     label: 'Home',     icon: '🏠' },
  { id: 'recovery', label: 'Recovery', icon: '💙' },
  { id: 'sleep',    label: 'Sleep',    icon: '😴' },
  { id: 'training', label: 'Training', icon: '🏃' },
  { id: 'fitness',  label: 'Fitness',  icon: '📈' },
]

type Props = {
  active: TabId
  onChange: (tab: TabId) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 pb-safe z-50">
      <div className="flex h-14">
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:client
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TabBar.tsx tests/client/TabBar.test.tsx
git commit -m "feat: TabBar component with 5 tabs"
```

---

## Task 6: AziCard

**Files:**
- Create: `client/src/components/AziCard.tsx`
- Create: `tests/client/AziCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/client/AziCard.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { AziCard } from '../../client/src/components/AziCard'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('AziCard', () => {
  test('renders fetched HTML content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<p data-testid="azi-content">MX-4 briefing</p>'),
    })
    render(<AziCard section="recovery" />)
    await waitFor(() =>
      expect(screen.getByTestId('azi-content')).toBeInTheDocument()
    )
  })

  test('renders nothing when section not found (404)', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const { container } = render(<AziCard section="bloodwork" />)
    await waitFor(() =>
      expect(container.querySelector('[data-azi-card]')).toBeEmptyElement()
    )
  })

  test('shows skeleton while loading', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))  // never resolves
    render(<AziCard section="recovery" />)
    expect(screen.getByTestId('azi-skeleton')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:client
```

Expected: FAIL — "Cannot find module '../../client/src/components/AziCard'"

- [ ] **Step 3: Create client/src/components/AziCard.tsx**

```tsx
// client/src/components/AziCard.tsx
import { useState, useEffect } from 'react'
import { getInsight } from '../api'

type Props = {
  section: string
}

export function AziCard({ section }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getInsight(section).then((result) => {
      if (!cancelled) {
        setHtml(result)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [section])

  if (loading) {
    return (
      <div data-testid="azi-skeleton" className="rounded-xl bg-blue-950 border border-blue-800 p-4">
        <div className="h-3 bg-blue-900 rounded animate-pulse w-1/3 mb-3" />
        <div className="h-2 bg-blue-900 rounded animate-pulse mb-2" />
        <div className="h-2 bg-blue-900 rounded animate-pulse w-4/5" />
      </div>
    )
  }

  return (
    <div
      data-azi-card
      dangerouslySetInnerHTML={{ __html: html ?? '' }}
    />
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:client
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AziCard.tsx tests/client/AziCard.test.tsx
git commit -m "feat: AziCard component with shimmer skeleton"
```

---

## Task 7: TrendChart

**Files:**
- Create: `client/src/components/TrendChart.tsx`
- Create: `tests/client/TrendChart.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/client/TrendChart.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { TrendChart } from '../../client/src/components/TrendChart'

// Recharts uses ResizeObserver which jsdom doesn't have
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('TrendChart', () => {
  test('renders chart container after data loads', async () => {
    const rows = [
      { date: '2026-04-21', metric: 'hrv', value: 55, unit: 'ms' },
      { date: '2026-04-22', metric: 'hrv', value: 58, unit: 'ms' },
    ]
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ metric: 'hrv', rows }),
    })
    render(<TrendChart metric="hrv" days={7} />)
    await waitFor(() =>
      expect(screen.getByTestId('trend-chart')).toBeInTheDocument()
    )
  })

  test('renders empty state when no data', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    render(<TrendChart metric="vo2max" days={7} />)
    await waitFor(() =>
      expect(screen.getByTestId('trend-chart-empty')).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:client
```

Expected: FAIL — "Cannot find module '../../client/src/components/TrendChart'"

- [ ] **Step 3: Create client/src/components/TrendChart.tsx**

```tsx
// client/src/components/TrendChart.tsx
import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  Tooltip,
} from 'recharts'
import { getMetricHistory } from '../api'
import type { MetricRow } from '../api'

// Metrics that look better as a smooth line than bars
const LINE_METRICS = new Set(['hrv', 'vo2max', 'resting_hr', 'recovery_score'])

type Props = {
  metric: string
  days?: number
}

type ChartPoint = { date: string; value: number }

const tooltipStyle = {
  contentStyle: {
    background: '#1f2937',
    border: 'none',
    borderRadius: 6,
    color: '#f9fafb',
    fontSize: 12,
  },
}

export function TrendChart({ metric, days = 7 }: Props) {
  const [data, setData] = useState<ChartPoint[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getMetricHistory(metric, days).then((rows: MetricRow[]) => {
      if (!cancelled) {
        setData(rows.map((r) => ({ date: r.date.slice(5), value: r.value })))
      }
    })
    return () => { cancelled = true }
  }, [metric, days])

  if (data === null) {
    return <div className="h-24 rounded-xl bg-gray-800 animate-pulse" />
  }

  if (data.length === 0) {
    return (
      <div
        data-testid="trend-chart-empty"
        className="h-24 rounded-xl bg-gray-800 flex items-center justify-center"
      >
        <span className="text-xs text-gray-500">No data yet</span>
      </div>
    )
  }

  const isLine = LINE_METRICS.has(metric)

  return (
    <div data-testid="trend-chart" className="rounded-xl bg-gray-800 p-3">
      <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
        {metric.replace(/_/g, ' ')} — {days}d
      </p>
      <ResponsiveContainer width="100%" height={80}>
        {isLine ? (
          <LineChart data={data}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Tooltip {...tooltipStyle} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Tooltip {...tooltipStyle} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:client
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TrendChart.tsx tests/client/TrendChart.test.tsx
git commit -m "feat: TrendChart component — 7-day bar/line chart using Recharts"
```

---

## Task 8: LogForm

**Files:**
- Create: `client/src/components/LogForm.tsx`
- Create: `tests/client/LogForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/client/LogForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { LogForm } from '../../client/src/components/LogForm'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('LogForm', () => {
  test('pre-populates readiness and caffeine from today entry', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          entry: { readiness: 3, caffeine_mg: 200, supplements: '["creatine"]' },
        }),
    })
    render(<LogForm />)
    await waitFor(() => {
      const btn3 = screen.getByRole('button', { name: '3' })
      expect(btn3).toHaveClass('bg-blue-500')
    })
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('200')
  })

  test('pre-populates supplements checkboxes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          entry: { readiness: null, caffeine_mg: null, supplements: '["creatine","vitamin_d"]' },
        }),
    })
    render(<LogForm />)
    await waitFor(() => {
      expect((screen.getByRole('checkbox', { name: /creatine/i }) as HTMLInputElement).checked).toBe(true)
      expect((screen.getByRole('checkbox', { name: /vitamin d/i }) as HTMLInputElement).checked).toBe(true)
      expect((screen.getByRole('checkbox', { name: /omega/i }) as HTMLInputElement).checked).toBe(false)
    })
  })

  test('submits correct payload on save', async () => {
    // First call: GET /api/manual/today (no entry)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry: null }),
    })
    // Second call: POST /api/manual
    mockFetch.mockResolvedValueOnce({ ok: true })

    render(<LogForm />)
    await waitFor(() => screen.getByRole('button', { name: '4' }))

    await userEvent.click(screen.getByRole('button', { name: '4' }))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(mockFetch).toHaveBeenLastCalledWith('/api/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readiness: 4, caffeine_mg: undefined, supplements: [] }),
    })
  })

  test('shows logged confirmation after save', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry: null }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })

    render(<LogForm />)
    await waitFor(() => screen.getByRole('button', { name: /save/i }))

    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/logged/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:client
```

Expected: FAIL — "Cannot find module '../../client/src/components/LogForm'"

- [ ] **Step 3: Create client/src/components/LogForm.tsx**

```tsx
// client/src/components/LogForm.tsx
import { useState, useEffect } from 'react'
import { getManualToday, postManual } from '../api'

const SUPPLEMENTS = [
  { id: 'creatine',   label: 'Creatine' },
  { id: 'vitamin_d',  label: 'Vitamin D' },
  { id: 'omega_3',    label: 'Omega-3' },
  { id: 'magnesium',  label: 'Magnesium' },
]

export function LogForm() {
  const [readiness, setReadiness]       = useState<number | undefined>(undefined)
  const [caffeine, setCaffeine]         = useState<number | undefined>(undefined)
  const [supplements, setSupplements]   = useState<string[]>([])
  const [saved, setSaved]               = useState(false)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    getManualToday().then((entry) => {
      if (entry) {
        if (entry.readiness) setReadiness(entry.readiness)
        if (entry.caffeine_mg) setCaffeine(entry.caffeine_mg)
        if (entry.supplements) {
          try { setSupplements(JSON.parse(entry.supplements)) } catch { /* ignore */ }
        }
      }
      setLoading(false)
    })
  }, [])

  function toggleSupplement(id: string) {
    setSupplements((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    await postManual({
      readiness,
      caffeine_mg: caffeine,
      supplements,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="h-32 rounded-xl bg-gray-800 animate-pulse" />
  }

  return (
    <div className="rounded-xl bg-gray-700 p-4 space-y-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Daily Log</p>

      {/* Readiness */}
      <div>
        <p className="text-sm text-gray-300 mb-2">Readiness</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setReadiness(n)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                readiness === n
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-600 text-gray-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Caffeine */}
      <div>
        <label className="text-sm text-gray-300 block mb-2">Caffeine (mg)</label>
        <input
          type="number"
          step={25}
          min={0}
          value={caffeine ?? ''}
          onChange={(e) => setCaffeine(e.target.value ? Number(e.target.value) : undefined)}
          placeholder="0"
          className="w-full bg-gray-600 rounded-lg px-3 py-2 text-gray-50 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Supplements */}
      <div>
        <p className="text-sm text-gray-300 mb-2">Supplements</p>
        <div className="grid grid-cols-2 gap-2">
          {SUPPLEMENTS.map(({ id, label }) => (
            <label key={id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={supplements.includes(id)}
                onChange={() => toggleSupplement(id)}
                className="accent-blue-500"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
      >
        {saved ? 'Logged ✓' : 'Save'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:client
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/LogForm.tsx tests/client/LogForm.test.tsx
git commit -m "feat: LogForm — readiness, caffeine, supplements with pre-population"
```

---

## Task 9: HomeTab

**Files:**
- Create: `client/src/tabs/HomeTab.tsx`
- Create: `tests/client/HomeTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/client/HomeTab.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { HomeTab } from '../../client/src/tabs/HomeTab'

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  // Default: all fetches return empty/null
  mockFetch.mockResolvedValue({ ok: false })
})

function mockSummary(data = {}) {
  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/garmin/summary') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
    }
    return Promise.resolve({ ok: false })
  })
}

describe('HomeTab', () => {
  test('renders stat grid after summary loads', async () => {
    mockSummary({ recovery_score: 74, hrv: 58, sleep_duration: 432 })
    render(<HomeTab />)
    await waitFor(() => expect(screen.getByText('74')).toBeInTheDocument())
    expect(screen.getByText('58')).toBeInTheDocument()
  })

  test('renders steps progress bar when steps available', async () => {
    mockSummary({ steps: 7813 })
    render(<HomeTab />)
    await waitFor(() => expect(screen.getByText('7,813')).toBeInTheDocument())
    expect(screen.getByText(/steps/i)).toBeInTheDocument()
  })

  test('poll button triggers POST /api/poll/force', async () => {
    mockSummary({ steps: 1000 })
    render(<HomeTab />)
    await waitFor(() => screen.getByRole('button', { name: /sync/i }))
    await userEvent.click(screen.getByRole('button', { name: /sync/i }))
    expect(mockFetch).toHaveBeenCalledWith('/api/poll/force', { method: 'POST' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:client
```

Expected: FAIL — "Cannot find module '../../client/src/tabs/HomeTab'"

- [ ] **Step 3: Create client/src/tabs/HomeTab.tsx**

```tsx
// client/src/tabs/HomeTab.tsx
import { useState, useEffect, useCallback } from 'react'
import { getGarminSummary, triggerPoll } from '../api'
import { AziCard } from '../components/AziCard'
import { StatGrid } from '../components/StatGrid'
import { LogForm } from '../components/LogForm'
import type { GarminSummary } from '../api'

export function HomeTab() {
  const [summary, setSummary] = useState<GarminSummary>({})
  const [polling, setPolling] = useState(false)

  const fetchSummary = useCallback(async () => {
    const data = await getGarminSummary()
    setSummary(data)
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  async function handlePoll() {
    setPolling(true)
    await triggerPoll()
    // Brief wait so the poller has time to write, then refresh
    await new Promise((r) => setTimeout(r, 2000))
    await fetchSummary()
    setPolling(false)
  }

  const steps = summary.steps

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-lg font-bold text-gray-50">Bacta</h1>
        <button
          aria-label="Sync"
          onClick={handlePoll}
          disabled={polling}
          className="text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-40 p-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={polling ? 'animate-spin' : ''}
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>

      {/* MX-4 Daily Briefing */}
      <div className="px-4">
        <AziCard section="recovery" />
      </div>

      {/* Stat Grid */}
      <div className="px-4">
        <StatGrid summary={summary} />
      </div>

      {/* Steps Progress */}
      {steps !== undefined && (
        <div className="mx-4 rounded-xl bg-gray-700 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Steps</span>
            <span className="text-base font-bold text-gray-50">{steps.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min((steps / 10000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">
            {Math.round((steps / 10000) * 100)}% of 10k
          </p>
        </div>
      )}

      {/* Log Form */}
      <div className="px-4">
        <LogForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:client
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/tabs/HomeTab.tsx tests/client/HomeTab.test.tsx
git commit -m "feat: HomeTab — MX-4 briefing, stat grid, steps bar, log form, poll button"
```

---

## Task 10: Section Tabs

**Files:**
- Create: `client/src/tabs/RecoveryTab.tsx`
- Create: `client/src/tabs/SleepTab.tsx`
- Create: `client/src/tabs/TrainingTab.tsx`
- Create: `client/src/tabs/FitnessTab.tsx`

These are thin wrappers. No separate test file — they're covered by AziCard and TrendChart tests.

- [ ] **Step 1: Create client/src/tabs/RecoveryTab.tsx**

```tsx
// client/src/tabs/RecoveryTab.tsx
import { AziCard } from '../components/AziCard'
import { TrendChart } from '../components/TrendChart'

export function RecoveryTab() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <AziCard section="recovery" />
      <TrendChart metric="hrv" days={7} />
    </div>
  )
}
```

- [ ] **Step 2: Create client/src/tabs/SleepTab.tsx**

```tsx
// client/src/tabs/SleepTab.tsx
import { AziCard } from '../components/AziCard'
import { TrendChart } from '../components/TrendChart'

export function SleepTab() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <AziCard section="sleep-quality" />
      <TrendChart metric="sleep_duration" days={7} />
    </div>
  )
}
```

- [ ] **Step 3: Create client/src/tabs/TrainingTab.tsx**

```tsx
// client/src/tabs/TrainingTab.tsx
import { AziCard } from '../components/AziCard'
import { TrendChart } from '../components/TrendChart'

export function TrainingTab() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <AziCard section="training-week" />
      <TrendChart metric="steps" days={7} />
    </div>
  )
}
```

- [ ] **Step 4: Create client/src/tabs/FitnessTab.tsx**

```tsx
// client/src/tabs/FitnessTab.tsx
import { AziCard } from '../components/AziCard'
import { TrendChart } from '../components/TrendChart'

export function FitnessTab() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <AziCard section="vo2-fitness" />
      <TrendChart metric="vo2max" days={30} />
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify nothing broke**

```bash
npm run test:client
```

Expected: All existing tests PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/tabs/
git commit -m "feat: section tabs — Recovery, Sleep, Training, Fitness"
```

---

## Task 11: App.tsx — Lazy Mount and Layout

**Files:**
- Create: `client/src/App.tsx`
- Create: `tests/client/App.test.tsx`
- Modify: `client/src/main.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/client/App.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { App } from '../../client/src/App'

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Silence all fetches in App tests — components handle their own data
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
})

describe('App', () => {
  test('renders tab bar with 5 tabs', () => {
    render(<App />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
    expect(screen.getByText('Sleep')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Fitness')).toBeInTheDocument()
  })

  test('shows Home content on initial render', () => {
    render(<App />)
    // Home tab content mounts on first render
    expect(screen.getByTestId('home-tab')).toBeInTheDocument()
  })

  test('lazy-mounts Recovery tab only on first visit', async () => {
    render(<App />)
    expect(screen.queryByTestId('recovery-tab')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Recovery'))
    expect(screen.getByTestId('recovery-tab')).toBeInTheDocument()
  })

  test('keeps tab mounted after switching away', async () => {
    render(<App />)
    await userEvent.click(screen.getByText('Recovery'))
    expect(screen.getByTestId('recovery-tab')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Home'))
    // Recovery tab is still in DOM, just hidden
    expect(screen.getByTestId('recovery-tab')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:client
```

Expected: FAIL — "Cannot find module '../../client/src/App'"

- [ ] **Step 3: Create client/src/App.tsx**

```tsx
// client/src/App.tsx
import { useState } from 'react'
import { TabBar } from './components/TabBar'
import { HomeTab } from './tabs/HomeTab'
import { RecoveryTab } from './tabs/RecoveryTab'
import { SleepTab } from './tabs/SleepTab'
import { TrainingTab } from './tabs/TrainingTab'
import { FitnessTab } from './tabs/FitnessTab'
import type { TabId } from './components/TabBar'

export function App() {
  const [active, setActive] = useState<TabId>('home')
  // Track which tabs have been mounted — once mounted, they stay mounted
  const [mounted, setMounted] = useState<Set<TabId>>(new Set(['home']))

  function handleTabChange(tab: TabId) {
    setActive(tab)
    setMounted((prev) => new Set([...prev, tab]))
  }

  function show(tab: TabId) {
    return active === tab ? undefined : 'none'
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Scrollable content area — padded for tab bar */}
      <main className="pb-20 overflow-y-auto">
        <div style={{ display: show('home') }} data-testid="home-tab">
          <HomeTab />
        </div>

        {mounted.has('recovery') && (
          <div style={{ display: show('recovery') }} data-testid="recovery-tab">
            <RecoveryTab />
          </div>
        )}

        {mounted.has('sleep') && (
          <div style={{ display: show('sleep') }} data-testid="sleep-tab">
            <SleepTab />
          </div>
        )}

        {mounted.has('training') && (
          <div style={{ display: show('training') }} data-testid="training-tab">
            <TrainingTab />
          </div>
        )}

        {mounted.has('fitness') && (
          <div style={{ display: show('fitness') }} data-testid="fitness-tab">
            <FitnessTab />
          </div>
        )}
      </main>

      <TabBar active={active} onChange={handleTabChange} />
    </div>
  )
}
```

- [ ] **Step 4: Update client/src/main.tsx to use App**

```tsx
// client/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 5: Run all tests**

```bash
npm run test:client
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/App.tsx client/src/main.tsx tests/client/App.test.tsx
git commit -m "feat: App.tsx — lazy-mount tab architecture and layout shell"
```

---

## Task 12: Smoke Test and Production Build

**Files:** None created — verification only.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All server tests (vitest.config.ts) AND all client tests (vitest.client.config.ts) PASS. Zero failures.

- [ ] **Step 2: Start the dev server and verify the UI**

In one terminal:
```bash
npm run dev:server
```

In a second terminal:
```bash
npm run dev:client
```

Open http://localhost:5173 in a browser.

Verify:
- Dark background loads
- Tab bar appears at the bottom with 5 tabs
- Home tab is active by default
- Tapping Recovery, Sleep, Training, Fitness tabs switches content
- AziCard shows a shimmer skeleton (no insight files exist yet — that's expected)
- StatGrid shows dashes or real values if the server has data
- LogForm appears at bottom of Home scroll
- Sync button in header is clickable

- [ ] **Step 3: Verify the production build**

```bash
npm run build
```

Expected: No TypeScript errors. `dist/client/` directory created with `index.html`, `assets/`, etc.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Plan 2 complete — dashboard UI with all tabs, components, and PWA manifest"
```
