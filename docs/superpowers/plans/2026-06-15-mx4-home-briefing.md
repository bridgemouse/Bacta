# MX-4 Home Briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `home` section to the MX-4 orchestrator so the Home page shows a live cross-channel briefing synthesized from the three completed section analyses.

**Architecture:** Add `mx4_briefings` to the `queryDb` tool description so MX-4 knows he can query his own completed briefings. Add `home` as the last entry in `SECTIONS` with a prompt that queries `mx4_briefings` for the three completed analyses and synthesizes a cross-channel read. Everything else (API, hook, component) is already wired.

**Tech Stack:** TypeScript, Vitest, better-sqlite3, Vercel AI SDK

---

## Files

- Modify: `server/lib/ai/tools.ts` — add `mx4_briefings` to `QUERY_DB_DESCRIPTION`
- Modify: `server/lib/ai/sections.ts` — add `home` section as last entry in `SECTIONS`
- Modify: `tests/server/tools.test.ts` — add test for querying `mx4_briefings` via `queryDb`
- Modify: `tests/server/sections.test.ts` — update tests for four sections; relax metric count check for `home`

---

### Task 1: Expose `mx4_briefings` in `queryDb` description

**Files:**
- Modify: `server/lib/ai/tools.ts`
- Modify: `tests/server/tools.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe('queryDb', ...)` block in `tests/server/tools.test.ts`, after the existing `queryDb` tests:

```ts
it('can query mx4_briefings table', async () => {
  const { queryDb } = await import('../../server/lib/ai/tools')
  // Insert a test briefing row
  const { default: db } = await import('../../server/db/client')
  db.prepare(
    'INSERT OR REPLACE INTO mx4_briefings (section, content_json, generated_at, model) VALUES (?, ?, ?, ?)'
  ).run('recovery', JSON.stringify({ tone: 'POSITIVE', headline: 'Test', summary: 'Test summary', body: 'Test body', recommendation: 'Rest', flags: [] }), new Date().toISOString(), 'test-model')

  const result = await queryDb.execute!({
    sql: "SELECT section, content_json FROM mx4_briefings WHERE section = 'recovery'",
  }) as any
  expect(result.rows).toHaveLength(1)
  expect(result.rows[0].section).toBe('recovery')
  const parsed = JSON.parse(result.rows[0].content_json)
  expect(parsed.summary).toBe('Test summary')
})

it('description mentions mx4_briefings', async () => {
  const { queryDb } = await import('../../server/lib/ai/tools')
  expect(queryDb.description).toContain('mx4_briefings')
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test:server -- --reporter=verbose tests/server/tools.test.ts
```

Expected: two new tests fail — `mx4_briefings` not in description, and table may not be queryable.

- [ ] **Step 3: Add `mx4_briefings` to `QUERY_DB_DESCRIPTION` in `server/lib/ai/tools.ts`**

After the line `  garmin_activities(date TEXT, ...)`, add:

```ts
const QUERY_DB_DESCRIPTION = `Run a read-only SQL SELECT query against the Garmin biometric database.

Schema:
  garmin_snapshots(date TEXT, metric TEXT, value REAL, unit TEXT, source_json TEXT)
  garmin_activities(date TEXT, activity_id TEXT, type_key TEXT, duration_s REAL, distance_m REAL, calories REAL, avg_hr REAL, training_effect REAL)
  mx4_briefings(section TEXT, content_json TEXT, generated_at TEXT, model TEXT)
    — section values: 'recovery', 'sleep', 'training', 'home'
    — content_json is a JSON string: { tone, headline, summary, body, recommendation, flags }
    — Query example: SELECT section, content_json FROM mx4_briefings WHERE section IN ('recovery','sleep','training')

garmin_snapshots uses EAV format...
```

Keep the rest of the description unchanged (metric list, EAV usage notes).

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:server -- --reporter=verbose tests/server/tools.test.ts
```

Expected: all tools tests pass including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add server/lib/ai/tools.ts tests/server/tools.test.ts
git commit -m "feat(mx4): expose mx4_briefings in queryDb description"
```

---

### Task 2: Add `home` section to `SECTIONS`

**Files:**
- Modify: `server/lib/ai/sections.ts`
- Modify: `tests/server/sections.test.ts`

- [ ] **Step 1: Update the sections tests**

Replace `tests/server/sections.test.ts` entirely:

```ts
import { describe, it, expect } from 'vitest'
import { SECTIONS } from '../../server/lib/ai/sections'

describe('SECTIONS', () => {
  it('defines exactly four sections in the correct run order', () => {
    const ids = SECTIONS.map(s => s.id)
    expect(ids).toEqual(['recovery', 'sleep', 'training', 'home'])
  })

  it('home section runs last', () => {
    expect(SECTIONS[SECTIONS.length - 1].id).toBe('home')
  })

  it('each non-home section has at least one metric', () => {
    for (const s of SECTIONS.filter(s => s.id !== 'home')) {
      expect(s.metrics.length).toBeGreaterThan(0)
    }
  })

  it('home section has empty metrics array (reads from mx4_briefings instead)', () => {
    const home = SECTIONS.find(s => s.id === 'home')!
    expect(home.metrics).toEqual([])
  })

  it('uses corrected metric names (no stale Python names)', () => {
    const allMetrics = SECTIONS.flatMap(s => s.metrics)
    expect(allMetrics).not.toContain('hrv_5min_high')
    expect(allMetrics).not.toContain('recovery_time_hours')
    expect(allMetrics).not.toContain('stress_score')
    expect(allMetrics).not.toContain('body_battery')
    expect(allMetrics).toContain('hrv_baseline_high')
    expect(allMetrics).toContain('recovery_time_h')
    expect(allMetrics).toContain('stress_avg')
  })

  it('each section has a non-empty promptAddendum without "patient" language', () => {
    for (const s of SECTIONS) {
      expect(s.promptAddendum.length).toBeGreaterThan(20)
      expect(s.promptAddendum.toLowerCase()).not.toContain('patient')
    }
  })

  it('home promptAddendum instructs querying mx4_briefings', () => {
    const home = SECTIONS.find(s => s.id === 'home')!
    expect(home.promptAddendum).toContain('mx4_briefings')
    expect(home.promptAddendum).toContain("section IN ('recovery', 'sleep', 'training')")
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
npm run test:server -- --reporter=verbose tests/server/sections.test.ts
```

Expected: `'defines exactly four sections'`, `'home section runs last'`, `'home section has empty metrics'`, and `'home promptAddendum instructs'` all fail.

- [ ] **Step 3: Add `home` to `server/lib/ai/sections.ts`**

Append to the `SECTIONS` array (after the `training` entry, before the closing `]`):

```ts
  {
    id: 'home',
    name: 'Home',
    metrics: [],
    includeManual: false,
    promptAddendum: `Query your three completed section analyses:
SELECT section, content_json FROM mx4_briefings WHERE section IN ('recovery', 'sleep', 'training')

Parse the summary field from each content_json result. You have already run three independent analyses — this briefing is your integrated read across all channels.

Do not restate each section in sequence. Synthesize: what is the dominant signal across the system today? Where do the channels agree, and where do they create tension? A strong recovery reading means little if sleep architecture was poor — surface the interaction.

Lead with the cross-channel verdict: primed, nominal, or under strain. Then the most significant tension or confirmation across domains. Close with one directive that accounts for all three channels.

Do not attempt readVault — vault is inaccessible per standing orders.

summary: 3–5 sentences. Cross-channel verdict, the most significant interaction between domains, the directive. No headers.
body: Use ## SYSTEM STATE, ## CHANNEL SYNTHESIS, ## TENSIONS & CONFIRMATIONS, ## DIRECTIVE. Bold all metric values referenced. Bullets for multi-point cross-channel findings.

After writing: no wiki update — home synthesis does not generate new standing knowledge.`,
  },
```

- [ ] **Step 4: Run all server tests**

```bash
npm run test:server
```

Expected: all 90+ server tests pass (sections tests updated, no regressions).

- [ ] **Step 5: Type check**

```bash
npx tsc -p tsconfig.server.json --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/lib/ai/sections.ts tests/server/sections.test.ts
git commit -m "feat(mx4): add home section — cross-channel synthesis from completed briefings"
```

---

### Task 3: Trigger orchestrator run and verify

**Files:** none — verification only

- [ ] **Step 1: Restart the server to pick up the new section**

```bash
sudo systemctl restart bacta-api
```

- [ ] **Step 2: Trigger a full orchestrator run**

```bash
curl -X POST http://localhost:3001/api/mx4/run
```

Expected: `{"ok":true}` — the run starts in the background. Watch progress:

```bash
sudo journalctl -u bacta-api -f --no-pager
```

Expected log lines:
```
[mx4] orchestrator run started
[mx4] recovery briefing written
[mx4] sleep briefing written
[mx4] training briefing written
[mx4] home briefing written
[mx4] orchestrator run complete
```

- [ ] **Step 3: Confirm home briefing written to DB**

```bash
curl http://localhost:3001/api/insights/home
```

Expected: a JSON response with real `tone`, `headline`, `summary`, `body`, `recommendation`, `generated_at` fields — not the stub text "Systems nominal. MX-4 standing by."

- [ ] **Step 4: Verify the Home page card shows live data**

Open `http://bacta.local` (or `http://localhost:5173` in dev) and navigate to the Home page. The MX-4 briefing card should show:
- A real `headline` (not "Systems nominal. MX-4 standing by.")
- Live `summary` prose
- A `FULL ANALYSIS ›` button in the footer (only appears when `liveData.summary` is truthy)
- A real timestamp in the card header
