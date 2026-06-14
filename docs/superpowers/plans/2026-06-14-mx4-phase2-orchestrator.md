# MX-4 Phase 2: Orchestrator + Wiki + Briefing Delivery

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the MX-4 intelligence pipeline end-to-end — sections → orchestrator → DB → API → UI — so live AI-generated briefings replace stub text in Recovery, Sleep, and Training section pages.

**Architecture:** Two-step per section: `generateText` (MX-4 analysis with tools, free voice) → `generateObject` (Zod schema extraction, no tools). Results persist to `mx4_briefings` table. Section pages fetch `/api/insights/:section` on mount and render live data via an updated `MX4Briefing` component with `react-markdown` body. `node-cron` drives nightly scheduling; `/api/mx4/run` triggers immediate fire-and-forget runs.

**Tech Stack:** Vercel AI SDK v6 (`generateText`, `generateObject`), `node-cron` ^4.2.1 (already installed), `react-markdown` ^10.1.0 (already installed), Zod, better-sqlite3, Vitest + supertest.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `server/lib/ai/types.ts` | BriefingResultSchema (Zod) + SectionDef interface |
| Create | `server/lib/ai/sections.ts` | Section definitions (ported from Python, fixed metric names) |
| Create | `server/lib/ai/wiki.ts` | Plain wiki file I/O helpers called by orchestrator/wrap |
| Modify | `server/lib/ai/tools.ts` | Import wiki functions from wiki.ts instead of inline fs calls |
| Create | `server/lib/ai/orchestrator.ts` | Two-step briefing pipeline, writes to mx4_briefings |
| Create | `server/lib/ai/wrap.ts` | Post-session wiki maintenance (archive oversized pages, update log) |
| Create | `server/lib/ai/scheduler.ts` | node-cron nightly scheduler, rescheduled on settings change |
| Modify | `server/api/mx4.ts` | `/run` calls orchestrator fire-and-forget (drop signal file) |
| Modify | `server/api/insights.ts` | Read from mx4_briefings table; updated stub shape |
| Modify | `server/api/settings.ts` | Reschedule cron on nightly time/enabled key change |
| Modify | `server/index.ts` | Call scheduleNightly() on startup |
| Modify | `mx4/system-prompt.md` | Remove HTML output section; add voice/analysis instructions |
| Create | `mx4/HEARTBEAT.md` | Standing orders file (MX-4 reads at each run start) |
| Create | `mx4/wiki/SCHEMA.md` | Wiki structure and maintenance rules |
| Create | `mx4/wiki/ethan-profile.md` | Ethan's stable profile facts (goals, background, targets) |
| Create | `mx4/wiki/weekly-observations.md` | Empty — MX-4 fills on first run |
| Create | `mx4/wiki/hrv-patterns.md` | Empty |
| Create | `mx4/wiki/sleep-patterns.md` | Empty |
| Create | `mx4/wiki/training-patterns.md` | Empty |
| Create | `mx4/wiki/correlations.md` | Empty |
| Create | `mx4/wiki/archive/.gitkeep` | Keep archive dir in git |
| Create | `client/src/lib/briefing.ts` | Client-side BriefingResult type |
| Create | `client/src/hooks/useBriefing.ts` | Fetch hook for /api/insights/:section |
| Modify | `client/src/components/MX4Card.tsx` | Add liveData?: BriefingResult to MX4Briefing; render with react-markdown |
| Modify | `client/src/pages/RecoveryPage.tsx` | Use useBriefing('recovery') |
| Modify | `client/src/pages/SleepPage.tsx` | Use useBriefing('sleep') |
| Modify | `client/src/pages/TrainingPage.tsx` | Use useBriefing('training') |
| Modify | `tests/server/insights.test.ts` | Update for new response shape (headline/body/recommendation/flags) |
| Modify | `tests/server/mx4.test.ts` | Update for new /run behavior (no signal file) |

---

## Task 1: Server Types

**Files:**
- Create: `server/lib/ai/types.ts`
- Create: `tests/server/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/server/types.test.ts
import { describe, it, expect } from 'vitest'
import { BriefingResultSchema } from '../../server/lib/ai/types'

describe('BriefingResultSchema', () => {
  it('parses a valid briefing result', () => {
    const result = BriefingResultSchema.parse({
      tone: 'POSITIVE',
      headline: 'HRV elevated above baseline.',
      body: 'Detailed analysis here.',
      recommendation: 'Proceed with hard session.',
      flags: [],
    })
    expect(result.tone).toBe('POSITIVE')
    expect(result.flags).toEqual([])
  })

  it('rejects unknown tone values', () => {
    expect(() => BriefingResultSchema.parse({
      tone: 'GREAT',
      headline: 'x', body: 'x', recommendation: 'x', flags: [],
    })).toThrow()
  })

  it('accepts all three tone values', () => {
    for (const tone of ['POSITIVE', 'CAUTION', 'FLAG'] as const) {
      expect(() => BriefingResultSchema.parse({
        tone, headline: 'x', body: 'x', recommendation: 'x', flags: [],
      })).not.toThrow()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /opt/bacta && npx vitest run tests/server/types.test.ts
```
Expected: FAIL — `Cannot find module '../../server/lib/ai/types'`

- [ ] **Step 3: Create `server/lib/ai/types.ts`**

```typescript
import { z } from 'zod'

export const BriefingResultSchema = z.object({
  tone:           z.enum(['POSITIVE', 'CAUTION', 'FLAG']),
  headline:       z.string(),
  body:           z.string(),
  recommendation: z.string(),
  flags:          z.array(z.string()),
})

export type BriefingResult = z.infer<typeof BriefingResultSchema>

export interface SectionDef {
  id:             string
  name:           string
  metrics:        string[]
  includeManual:  boolean
  promptAddendum: string
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /opt/bacta && npx vitest run tests/server/types.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta && git add server/lib/ai/types.ts tests/server/types.test.ts
git commit -m "feat(mx4): BriefingResultSchema and SectionDef types"
```

---

## Task 2: Section Definitions

**Files:**
- Create: `server/lib/ai/sections.ts`
- Create: `tests/server/sections.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/server/sections.test.ts
import { describe, it, expect } from 'vitest'
import { SECTIONS } from '../../server/lib/ai/sections'

describe('SECTIONS', () => {
  it('defines exactly three sections with correct IDs', () => {
    const ids = SECTIONS.map(s => s.id)
    expect(ids).toEqual(['recovery', 'sleep', 'training'])
  })

  it('each section has at least one metric', () => {
    for (const s of SECTIONS) {
      expect(s.metrics.length).toBeGreaterThan(0)
    }
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
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /opt/bacta && npx vitest run tests/server/sections.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/lib/ai/sections.ts`**

```typescript
import type { SectionDef } from './types'

export const SECTIONS: SectionDef[] = [
  {
    id: 'recovery',
    name: 'Recovery',
    metrics: [
      'hrv', 'hrv_baseline_high', 'recovery_score', 'recovery_time_h',
      'stress_avg', 'body_battery_charged', 'body_battery_drained',
      'body_battery_wake', 'body_battery_current', 'resting_hr', 'sleep_duration',
    ],
    includeManual: false,
    promptAddendum: `Focus: overall recovery status — is Ethan ready to train hard today or should he pull back?
Lead with the most significant finding. HRV is the primary autonomic signal; recovery_score and body_battery are corroborating.
stress_avg and resting_hr provide additional autonomic context.
Include a clear training recommendation: green (go hard) / yellow (moderate only) / red (rest or easy).
Use queryDb to pull 30-day HRV and recovery_score trends before drawing conclusions.
Do not reference "patients" or clinical framing — this is Ethan's data, analyzed for his use.`,
  },
  {
    id: 'sleep',
    name: 'Sleep',
    metrics: [
      'sleep_duration', 'sleep_score',
      'sleep_deep_minutes', 'sleep_rem_minutes',
      'sleep_light_minutes', 'sleep_awake_minutes',
      'sleep_stress', 'sleep_spo2', 'respiration_avg',
    ],
    includeManual: false,
    promptAddendum: `Focus: sleep architecture and quality — not just duration but composition.
Deep sleep (slow-wave) drives physical recovery and GH release. REM drives cognitive consolidation and memory.
Flag chronic deficiency in any stage. Ideal targets for a 26-year-old male athlete: deep ≥15% of total, REM ≥20%, awake <5%.
Use queryDb to pull 14-day sleep stage trends before assessing whether last night is anomalous or part of a pattern.
sleep_stress is Garmin's overnight autonomic stress estimate — lower is better; it correlates with parasympathetic recovery.`,
  },
  {
    id: 'training',
    name: 'Training',
    metrics: [
      'steps', 'intensity_minutes', 'training_load',
      'recovery_time_h', 'vo2max', 'training_status',
      'acwr', 'fitness_age', 'fitness_age_achievable',
    ],
    includeManual: true,
    promptAddendum: `Focus: training stimulus and load management — is Ethan building fitness or accumulating excessive stress?
Ethan's declared goal: VO2 max 52–55 ml/kg/min ('Excellent' for age 26 male) by late July/pre-wedding.
Use queryDb to pull 90 days of vo2max history to project current trajectory toward that target.
training_load is Garmin's 4-week weighted EPOC-based load score; acwr is acute:chronic workload ratio.
Optimal ACWR band is 0.8–1.3. Flag if above 1.5 (injury risk) or below 0.6 (detraining).
Use readVault to check the summer running plan and current training block targets if available.
If manual inputs are included, look for correlations: high caffeine + low readiness on the same day is worth noting.`,
  },
]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /opt/bacta && npx vitest run tests/server/sections.test.ts
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta && git add server/lib/ai/sections.ts tests/server/sections.test.ts
git commit -m "feat(mx4): section definitions with corrected metric names"
```

---

## Task 3: Wiki Utility Functions + Refactor tools.ts

**Files:**
- Create: `server/lib/ai/wiki.ts`
- Modify: `server/lib/ai/tools.ts` (import from wiki.ts)
- Create: `tests/server/wiki.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/server/wiki.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const TEST_WIKI_DIR = path.join(os.tmpdir(), 'bacta-wiki2-test-' + process.pid)
process.env.WIKI_DIR = TEST_WIKI_DIR

describe('wiki utilities', () => {
  beforeAll(() => { fs.mkdirSync(TEST_WIKI_DIR, { recursive: true }) })
  afterAll(() => { fs.rmSync(TEST_WIKI_DIR, { recursive: true, force: true }) })

  it('readAllWikiPagesSync returns placeholder when wiki is empty', async () => {
    const { readAllWikiPagesSync } = await import('../../server/lib/ai/wiki')
    const result = readAllWikiPagesSync()
    expect(result).toContain('empty')
  })

  it('writeWikiPageSync creates a page and returns token estimate', async () => {
    const { writeWikiPageSync } = await import('../../server/lib/ai/wiki')
    const result = writeWikiPageSync('hrv-patterns', '# HRV Patterns\nBaseline 52ms.')
    expect(result.tokenEstimate).toBeGreaterThan(0)
    expect(fs.existsSync(path.join(TEST_WIKI_DIR, 'hrv-patterns.md'))).toBe(true)
  })

  it('readAllWikiPagesSync includes page content after write', async () => {
    const { readAllWikiPagesSync } = await import('../../server/lib/ai/wiki')
    const content = readAllWikiPagesSync()
    expect(content).toContain('HRV Patterns')
    expect(content).toContain('Baseline 52ms.')
  })

  it('listWikiPagesSync returns pages with name and tokenEstimate', async () => {
    const { listWikiPagesSync } = await import('../../server/lib/ai/wiki')
    const pages = listWikiPagesSync()
    expect(pages.length).toBeGreaterThan(0)
    expect(pages[0]).toHaveProperty('name')
    expect(pages[0]).toHaveProperty('tokenEstimate')
  })

  it('archiveWikiPageSync copies page to archive dir', async () => {
    const { archiveWikiPageSync } = await import('../../server/lib/ai/wiki')
    archiveWikiPageSync('hrv-patterns')
    const archiveDir = path.join(TEST_WIKI_DIR, 'archive')
    const files = fs.readdirSync(archiveDir)
    expect(files.some(f => f.includes('hrv-patterns'))).toBe(true)
  })

  it('loadHeartbeat returns empty string when HEARTBEAT.md does not exist', async () => {
    const { loadHeartbeat } = await import('../../server/lib/ai/wiki')
    const result = loadHeartbeat()
    expect(typeof result).toBe('string')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /opt/bacta && npx vitest run tests/server/wiki.test.ts
```
Expected: FAIL — `Cannot find module '../../server/lib/ai/wiki'`

- [ ] **Step 3: Create `server/lib/ai/wiki.ts`**

```typescript
import fs from 'fs'
import path from 'path'

const WIKI_DIR     = () => process.env.WIKI_DIR ?? path.join(process.cwd(), 'mx4', 'wiki')
const HEARTBEAT_PATH = () => path.join(process.cwd(), 'mx4', 'HEARTBEAT.md')

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function readAllWikiPagesSync(): string {
  const dir = WIKI_DIR()
  if (!fs.existsSync(dir)) return '(wiki not yet initialized)'
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()
  if (files.length === 0) return '(wiki is empty)'
  return files
    .map(f => `\n\n=== ${f} ===\n${fs.readFileSync(path.join(dir, f), 'utf-8')}`)
    .join('')
}

export function writeWikiPageSync(name: string, content: string): { tokenEstimate: number; warning?: string } {
  const dir = WIKI_DIR()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${name}.md`), content, 'utf-8')
  const tokenEstimate = estimateTokens(content)
  const warning = tokenEstimate > 1500
    ? `Page is ~${tokenEstimate} estimated tokens (soft limit 1500, hard limit 2000). Synthesis required if over 2000.`
    : undefined
  return { tokenEstimate, warning }
}

export function listWikiPagesSync(): { name: string; tokenEstimate: number }[] {
  const dir = WIKI_DIR()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => ({
      name: f.replace('.md', ''),
      tokenEstimate: estimateTokens(fs.readFileSync(path.join(dir, f), 'utf-8')),
    }))
}

export function archiveWikiPageSync(name: string): void {
  const dir = WIKI_DIR()
  const srcPath = path.join(dir, `${name}.md`)
  if (!fs.existsSync(srcPath)) throw new Error(`Wiki page not found: ${name}`)
  const archiveDir = path.join(dir, 'archive')
  fs.mkdirSync(archiveDir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  fs.copyFileSync(srcPath, path.join(archiveDir, `${date}-${name}.md`))
}

export function loadHeartbeat(): string {
  try {
    return fs.readFileSync(HEARTBEAT_PATH(), 'utf-8')
  } catch {
    return ''
  }
}
```

- [ ] **Step 4: Refactor `server/lib/ai/tools.ts` to import from wiki.ts**

Replace the inline `fs` calls in `readAllWikiPages`, `writeWikiPage`, `listWikiPages`, and `archiveWikiPage` with imports from wiki.ts. The tool definitions (Zod schemas, descriptions) stay in tools.ts. Only the logic moves:

```typescript
import { tool } from 'ai'
import { z } from 'zod'
import db from '../../db/client'
import {
  readAllWikiPagesSync,
  writeWikiPageSync,
  listWikiPagesSync,
  archiveWikiPageSync,
} from './wiki'

const VAULT_ROOT = process.env.VAULT_WIKI_ROOT ?? '/mnt/vault/wiki'

import fs from 'fs'
import path from 'path'

export const queryDb = tool({
  description: 'Run a read-only SQL SELECT query against the Garmin biometric database (garmin_snapshots, garmin_activities)',
  inputSchema: z.object({
    sql: z.string().describe('SQL SELECT query to execute'),
  }),
  execute: async ({ sql }) => {
    if (!sql.trim().toUpperCase().startsWith('SELECT')) {
      return { error: 'Only SELECT queries are permitted' }
    }
    try {
      const rows = db.prepare(sql).all()
      return { rows }
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  },
})

export const readVault = tool({
  description: "Read a file from Ethan's Obsidian vault wiki for personal context",
  inputSchema: z.object({
    relativePath: z.string().describe('Path relative to vault wiki root'),
  }),
  execute: async ({ relativePath }) => {
    try {
      const content = fs.readFileSync(path.join(VAULT_ROOT, relativePath), 'utf-8')
      return { content }
    } catch {
      return { error: `Vault not accessible or file not found: ${relativePath}` }
    }
  },
})

export const readAllWikiPages = tool({
  description: "Load all of MX-4's persistent wiki pages into context",
  inputSchema: z.object({}),
  execute: async () => ({ content: readAllWikiPagesSync() }),
})

export const writeWikiPage = tool({
  description: 'Write or update a wiki page. Returns a warning if the page exceeds 1500 estimated tokens.',
  inputSchema: z.object({
    name:    z.string().describe('Page filename without extension'),
    content: z.string().describe('Full markdown content'),
  }),
  execute: async ({ name, content }) => {
    const result = writeWikiPageSync(name, content)
    return { ok: true, ...result }
  },
})

export const listWikiPages = tool({
  description: 'List all wiki pages with estimated token counts.',
  inputSchema: z.object({}),
  execute: async () => ({ pages: listWikiPagesSync() }),
})

export const archiveWikiPage = tool({
  description: 'Copy the current version of a wiki page to the archive directory.',
  inputSchema: z.object({
    name: z.string().describe('Page filename without extension'),
  }),
  execute: async ({ name }) => {
    try {
      archiveWikiPageSync(name)
      const date = new Date().toISOString().slice(0, 10)
      return { ok: true, archivedTo: `archive/${date}-${name}.md` }
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  },
})
```

- [ ] **Step 5: Run wiki test + existing tools test to verify both pass**

```bash
cd /opt/bacta && npx vitest run tests/server/wiki.test.ts tests/server/tools.test.ts
```
Expected: all tests in both files pass.

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add server/lib/ai/wiki.ts server/lib/ai/tools.ts tests/server/wiki.test.ts
git commit -m "feat(mx4): wiki.ts utility functions; tools.ts imports from wiki.ts"
```

---

## Task 4: Orchestrator

**Files:**
- Create: `server/lib/ai/orchestrator.ts`
- Create: `tests/server/orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/server/orchestrator.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

process.env.DB_PATH   = ':memory:'
process.env.WIKI_DIR  = path.join(os.tmpdir(), 'bacta-orch-wiki-' + process.pid)

// Mock generateText and generateObject from 'ai' before any imports
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'MX-4 mock analysis: HRV looks good. Recovery is strong.' }),
  generateObject: vi.fn().mockResolvedValue({
    object: {
      tone: 'POSITIVE',
      headline: 'Recovery nominal.',
      body: 'HRV above baseline. Body battery charged.',
      recommendation: 'Clear for hard session.',
      flags: [],
    },
  }),
}))

describe('runOrchestrator', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const testWikiDir = process.env.WIKI_DIR!
    fs.mkdirSync(testWikiDir, { recursive: true })
  })

  it('writes a briefing row to mx4_briefings for each section', async () => {
    const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')
    await runOrchestrator()

    const { default: db } = await import('../../server/db/client')
    const rows = db.prepare('SELECT section, content_json FROM mx4_briefings').all() as { section: string; content_json: string }[]
    expect(rows.length).toBe(3)

    const sections = rows.map(r => r.section).sort()
    expect(sections).toEqual(['recovery', 'sleep', 'training'])

    const parsed = JSON.parse(rows[0].content_json)
    expect(parsed).toHaveProperty('tone')
    expect(parsed).toHaveProperty('headline')
    expect(parsed).toHaveProperty('body')
    expect(parsed).toHaveProperty('recommendation')
    expect(parsed).toHaveProperty('flags')
  })

  it('each briefing row has a generated_at timestamp and model name', async () => {
    const { default: db } = await import('../../server/db/client')
    const row = db.prepare('SELECT generated_at, model FROM mx4_briefings WHERE section = ?').get('recovery') as { generated_at: string; model: string }
    expect(new Date(row.generated_at).getTime()).toBeGreaterThan(0)
    expect(row.model.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /opt/bacta && npx vitest run tests/server/orchestrator.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/lib/ai/orchestrator.ts`**

```typescript
import { generateText, generateObject } from 'ai'
import { getModel } from './provider'
import { getSetting } from '../settings'
import { SECTIONS } from './sections'
import { readAllWikiPagesSync, loadHeartbeat } from './wiki'
import { queryDb, readVault, readAllWikiPages } from './tools'
import { BriefingResultSchema, type BriefingResult } from './types'
import db from '../../db/client'
import fs from 'fs'
import path from 'path'

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), 'mx4', 'system-prompt.md')

function loadSystemPrompt(): string {
  try {
    return fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8')
  } catch {
    return 'You are MX-4, a data analysis droid. Analyze Ethan\'s biometric data and provide insights.'
  }
}

async function runSection(
  sectionId: string,
  sectionName: string,
  promptAddendum: string,
  wikiContext: string,
  heartbeat: string,
): Promise<BriefingResult> {
  const systemPrompt = loadSystemPrompt()
  const model = getModel('briefing')
  const modelId = (model as unknown as { modelId?: string }).modelId ?? getSetting('mx4_briefing_model') ?? 'unknown'

  const systemWithContext = [systemPrompt, heartbeat ? `\n\n## Standing Orders\n${heartbeat}` : '', `\n\n## Wiki Knowledge\n${wikiContext}`].join('')

  const sectionPrompt = `You are generating MX-4's ${sectionName} briefing.

Section focus: ${promptAddendum}

Use queryDb to pull the last 30 days of relevant metrics. Use readVault if you need personal context from the Obsidian vault. Use readAllWikiPages if you need to review accumulated knowledge.

Produce a complete analysis in your voice. Cover: what the data shows today, how it compares to the 30-day trend, what it means for Ethan's current training block, and one specific recommendation.`

  const { text: fullAnalysis } = await generateText({
    model,
    system: systemWithContext,
    prompt: sectionPrompt,
    tools: { queryDb, readVault, readAllWikiPages },
    maxSteps: 8,
  })

  const { object } = await generateObject({
    model,
    schema: BriefingResultSchema,
    prompt: `Extract a structured briefing from this analysis. Preserve MX-4's voice in the body field.\n\nAnalysis:\n\n${fullAnalysis}`,
  })

  const briefing: BriefingResult = object

  db.prepare(
    'INSERT OR REPLACE INTO mx4_briefings (section, content_json, generated_at, model) VALUES (?, ?, ?, ?)'
  ).run(sectionId, JSON.stringify(briefing), new Date().toISOString(), modelId)

  return briefing
}

export async function runOrchestrator(): Promise<void> {
  console.log('[mx4] orchestrator run started', new Date().toISOString())

  const wikiContext = readAllWikiPagesSync()
  const heartbeat   = loadHeartbeat()

  const errors: { section: string; error: string }[] = []

  for (const section of SECTIONS) {
    let attempts = 0
    while (attempts < 3) {
      try {
        await runSection(section.id, section.name, section.promptAddendum, wikiContext, heartbeat)
        console.log(`[mx4] ${section.id} briefing written`)
        break
      } catch (e: unknown) {
        attempts++
        const message = e instanceof Error ? e.message : String(e)
        if (message.includes('quota') || message.includes('rate') || message.includes('429')) {
          console.error(`[mx4] ${section.id} usage limit error — aborting run`)
          errors.push({ section: section.id, error: message })
          break
        }
        if (attempts >= 3) {
          console.error(`[mx4] ${section.id} failed after 3 attempts: ${message}`)
          errors.push({ section: section.id, error: message })
        } else {
          await new Promise(r => setTimeout(r, 30_000))
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('[mx4] run completed with errors:', errors)
  } else {
    console.log('[mx4] orchestrator run complete')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /opt/bacta && npx vitest run tests/server/orchestrator.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 5: Type check**

```bash
cd /opt/bacta && npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add server/lib/ai/orchestrator.ts tests/server/orchestrator.test.ts
git commit -m "feat(mx4): orchestrator — two-step generateText+generateObject pipeline"
```

---

## Task 5: Wrap Step

**Files:**
- Create: `server/lib/ai/wrap.ts`
- Create: `tests/server/wrap.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/server/wrap.test.ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

process.env.DB_PATH  = ':memory:'
process.env.WIKI_DIR = path.join(os.tmpdir(), 'bacta-wrap-wiki-' + process.pid)

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'Synthesized content: patterns observed across 14 days.' }),
}))

describe('wrapSession', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const dir = process.env.WIKI_DIR!
    fs.mkdirSync(dir, { recursive: true })
    // Seed a normal page
    fs.writeFileSync(path.join(dir, 'weekly-observations.md'), '# Weekly Observations\nInitial entry.')
  })

  afterAll(() => {
    fs.rmSync(process.env.WIKI_DIR!, { recursive: true, force: true })
  })

  it('runs without throwing when wiki has normal-sized pages', async () => {
    const { wrapSession } = await import('../../server/lib/ai/wrap')
    await expect(wrapSession()).resolves.not.toThrow()
  })

  it('archives and rewrites pages over 2000 estimated tokens', async () => {
    const dir = process.env.WIKI_DIR!
    const bigContent = 'word '.repeat(2100)
    fs.writeFileSync(path.join(dir, 'oversized-page.md'), bigContent)

    const { wrapSession } = await import('../../server/lib/ai/wrap')
    await wrapSession()

    const archiveDir = path.join(dir, 'archive')
    const files = fs.existsSync(archiveDir) ? fs.readdirSync(archiveDir) : []
    expect(files.some(f => f.includes('oversized-page'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /opt/bacta && npx vitest run tests/server/wrap.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/lib/ai/wrap.ts`**

```typescript
import { generateText } from 'ai'
import { getModel } from './provider'
import { listWikiPagesSync, archiveWikiPageSync, writeWikiPageSync, readAllWikiPagesSync } from './wiki'

const SYNTHESIS_PROMPT = (name: string, content: string) =>
  `The following wiki page has grown too long. Synthesize it into a denser version that preserves all established patterns and key findings but removes redundancy. Keep it under 1200 words. Write in a factual, analytical register.\n\nPage: ${name}\n\n${content}`

export async function wrapSession(): Promise<void> {
  const pages = listWikiPagesSync()

  for (const page of pages) {
    if (page.tokenEstimate > 2000) {
      try {
        const wikiContext = readAllWikiPagesSync()
        archiveWikiPageSync(page.name)

        const { text: synthesis } = await generateText({
          model:  getModel('briefing'),
          prompt: SYNTHESIS_PROMPT(page.name, wikiContext),
        })

        writeWikiPageSync(page.name, synthesis)
        console.log(`[mx4:wrap] synthesized ${page.name} (was ${page.tokenEstimate} tokens)`)
      } catch (e: unknown) {
        console.error(`[mx4:wrap] failed to synthesize ${page.name}:`, e instanceof Error ? e.message : e)
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /opt/bacta && npx vitest run tests/server/wrap.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta && git add server/lib/ai/wrap.ts tests/server/wrap.test.ts
git commit -m "feat(mx4): wrap step — archives and synthesizes oversized wiki pages"
```

---

## Task 6: Scheduler

**Files:**
- Create: `server/lib/ai/scheduler.ts`

- [ ] **Step 1: Create `server/lib/ai/scheduler.ts`**

```typescript
import cron from 'node-cron'
import { getSetting } from '../settings'
import { runOrchestrator } from './orchestrator'

let nightlyTask: cron.ScheduledTask | null = null

export function scheduleNightly(): void {
  if (nightlyTask) {
    nightlyTask.stop()
    nightlyTask = null
  }

  const enabled = getSetting('mx4_nightly_enabled')
  if (enabled !== 'true') {
    console.log('[mx4] nightly run disabled')
    return
  }

  const time   = getSetting('mx4_nightly_time') ?? '04:00'
  const [hour, minute] = time.split(':')
  const expr   = `${minute} ${hour} * * *`

  nightlyTask = cron.schedule(expr, () => {
    runOrchestrator().catch(err => console.error('[mx4] nightly run error:', err))
  })

  console.log(`[mx4] nightly run scheduled at ${time} (cron: ${expr})`)
}
```

- [ ] **Step 2: Update `server/index.ts` to call scheduleNightly() after migrate()**

Add import and call at the top of `server/index.ts`. The full updated file:

```typescript
import 'dotenv/config'
import express from 'express'
import path from 'path'
import { migrate } from './db/migrate'
import healthRouter from './api/health'
import garminRouter from './api/garmin'
import manualRouter from './api/manual'
import insightsRouter from './api/insights'
import bloodworkRouter from './api/bloodwork'
import pollRouter from './api/poll'
import mx4Router from './api/mx4'
import settingsRouter from './api/settings'
import { scheduleNightly } from './lib/ai/scheduler'

migrate()
scheduleNightly()

export const app = express()
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/garmin', garminRouter)
app.use('/api/manual', manualRouter)
app.use('/api/insights', insightsRouter)
app.use('/api/bloodwork', bloodworkRouter)
app.use('/api/poll', pollRouter)
app.use('/api/mx4', mx4Router)
app.use('/api/settings', settingsRouter)

if (process.env.NODE_ENV === 'production') {
  const clientDir = path.join(process.cwd(), 'dist/client')
  app.use(express.static(clientDir, { etag: false }))
  app.get('/{*splat}', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.sendFile(path.join(clientDir, 'index.html'))
  })
}

if (require.main === module) {
  const port = process.env.PORT ?? 3001
  app.listen(port, () => console.log(`[server] listening on :${port}`))
}
```

- [ ] **Step 3: Update `server/api/settings.ts` to reschedule on nightly config change**

Read the current `server/api/settings.ts`, then add a call to `scheduleNightly()` when `mx4_nightly_time` or `mx4_nightly_enabled` is updated:

```typescript
// In the PUT /api/settings/:key handler, after setSetting(key, value):
import { scheduleNightly } from '../lib/ai/scheduler'

// Inside the PUT handler, after the setSetting call:
if (key === 'mx4_nightly_time' || key === 'mx4_nightly_enabled') {
  scheduleNightly()
}
```

Read `server/api/settings.ts` to find the exact insertion point, then edit.

- [ ] **Step 4: Type check**

```bash
cd /opt/bacta && npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors.

- [ ] **Step 5: Run full server test suite**

```bash
cd /opt/bacta && npm run test:server
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add server/lib/ai/scheduler.ts server/index.ts server/api/settings.ts
git commit -m "feat(mx4): node-cron nightly scheduler; reschedules on settings change"
```

---

## Task 7: Update Insights API

**Files:**
- Modify: `server/api/insights.ts`
- Modify: `tests/server/insights.test.ts`

- [ ] **Step 1: Update `tests/server/insights.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

describe('Insights API', () => {
  it('GET /api/insights/:section returns stub briefing shape for valid section with no DB data', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/recovery')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('tone')
    expect(res.body).toHaveProperty('headline')
    expect(res.body).toHaveProperty('body')
    expect(res.body).toHaveProperty('recommendation')
    expect(res.body).toHaveProperty('flags')
    expect(['POSITIVE', 'CAUTION', 'FLAG']).toContain(res.body.tone)
  })

  it('GET /api/insights/:section returns 404 for unknown section', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/unknown')
    expect(res.status).toBe(404)
  })

  it('GET /api/insights/:section returns DB row content when a briefing exists', async () => {
    const { default: db } = await import('../../server/db/client')
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const content = JSON.stringify({
      tone: 'CAUTION',
      headline: 'HRV declining.',
      body: 'Seven-day HRV trend is down 12%.',
      recommendation: 'Drop intensity today.',
      flags: ['HRV below 7-day average'],
    })
    db.prepare(
      'INSERT OR REPLACE INTO mx4_briefings (section, content_json, generated_at, model) VALUES (?, ?, ?, ?)'
    ).run('training', content, new Date().toISOString(), 'gemini-2.5-flash')

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/insights/training')
    expect(res.status).toBe(200)
    expect(res.body.tone).toBe('CAUTION')
    expect(res.body.headline).toBe('HRV declining.')
    expect(res.body.flags).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run updated test to verify it fails (old implementation, new assertions)**

```bash
cd /opt/bacta && npx vitest run tests/server/insights.test.ts
```
Expected: FAIL — `summary` field assertions no longer match new shape expected by tests.

- [ ] **Step 3: Rewrite `server/api/insights.ts`**

```typescript
import { Router } from 'express'
import db from '../../db/client'

const insightsRouter = Router()

const VALID_SECTIONS = ['home', 'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog']

const STUB_BRIEFINGS: Record<string, object> = {
  home: {
    tone: 'POSITIVE',
    headline: 'Systems nominal. MX-4 standing by.',
    body: 'Recovery is charged. Training is on track. MX-4 has not yet generated a live briefing for this section.',
    recommendation: 'Configure an AI provider in Settings to enable live briefings.',
    flags: [],
  },
  recovery: {
    tone: 'POSITIVE',
    headline: 'HRV up 4ms. Body battery at 74.',
    body: 'Recovery metrics are within normal range. No live briefing has been generated yet — configure an AI provider in Settings.',
    recommendation: 'Run the orchestrator to generate a live assessment.',
    flags: [],
  },
  training: {
    tone: 'POSITIVE',
    headline: 'Training load moderate. VO2 trajectory on target.',
    body: 'Training status nominal. No live briefing has been generated yet — configure an AI provider in Settings.',
    recommendation: 'Run the orchestrator to generate a live assessment.',
    flags: [],
  },
  sleep: {
    tone: 'CAUTION',
    headline: 'Sleep score 82. Architecture review pending.',
    body: 'Sleep data is available but no live briefing has been generated yet — configure an AI provider in Settings.',
    recommendation: 'Run the orchestrator to generate a live assessment.',
    flags: [],
  },
  nutrition: {
    tone: 'CAUTION',
    headline: 'No nutrition data source configured.',
    body: 'MacroFactor integration is pending. No data available.',
    recommendation: 'Set up a nutrition tracking source.',
    flags: ['no data source'],
  },
  bloodwork: {
    tone: 'CAUTION',
    headline: 'No lab panels uploaded.',
    body: 'Blood work section is ready but no panels have been uploaded yet.',
    recommendation: 'Upload lab results when available.',
    flags: [],
  },
  dailylog: {
    tone: 'POSITIVE',
    headline: 'Daily log ready.',
    body: 'Daily log section is ready.',
    recommendation: 'Start logging daily inputs.',
    flags: [],
  },
}

insightsRouter.get('/:section', (req, res) => {
  const { section } = req.params

  if (!VALID_SECTIONS.includes(section)) {
    res.status(404).json({ error: 'Unknown section' })
    return
  }

  const row = db.prepare(
    'SELECT content_json, generated_at, model FROM mx4_briefings WHERE section = ?'
  ).get(section) as { content_json: string; generated_at: string; model: string } | undefined

  if (row) {
    try {
      const content = JSON.parse(row.content_json)
      res.json({ ...content, generated_at: row.generated_at, model: row.model })
      return
    } catch {
      // fall through to stub
    }
  }

  res.json(STUB_BRIEFINGS[section] ?? STUB_BRIEFINGS.home)
})

export default insightsRouter
```

- [ ] **Step 4: Run updated test to verify it passes**

```bash
cd /opt/bacta && npx vitest run tests/server/insights.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta && git add server/api/insights.ts tests/server/insights.test.ts
git commit -m "feat(mx4): insights API reads from mx4_briefings table; updated stub shape"
```

---

## Task 8: Update mx4 API /run Endpoint

**Files:**
- Modify: `server/api/mx4.ts`
- Modify: `tests/server/mx4.test.ts`

- [ ] **Step 1: Update `tests/server/mx4.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

// Mock the orchestrator so /run doesn't make real AI calls in tests
vi.mock('../../server/lib/ai/orchestrator', () => ({
  runOrchestrator: vi.fn().mockResolvedValue(undefined),
}))

describe('MX-4 API', () => {
  it('POST /api/mx4/run returns 202 with ok:true', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/mx4/run')
    expect(res.status).toBe(202)
    expect(res.body.ok).toBe(true)
  })

  it('POST /api/mx4/run response arrives before orchestrator completes', async () => {
    const { app } = await import('../../server/index')
    const start = Date.now()
    await request(app).post('/api/mx4/run')
    const elapsed = Date.now() - start
    // Should return almost immediately (fire-and-forget), not block
    expect(elapsed).toBeLessThan(500)
  })
})
```

- [ ] **Step 2: Run updated test to see it fail (signal file test no longer matches)**

```bash
cd /opt/bacta && npx vitest run tests/server/mx4.test.ts
```
Expected: FAIL — old tests reference signal file behavior.

- [ ] **Step 3: Rewrite `server/api/mx4.ts`**

```typescript
import { Router } from 'express'
import { runOrchestrator } from '../lib/ai/orchestrator'

const mx4Router = Router()

mx4Router.post('/run', (_req, res) => {
  res.status(202).json({ ok: true })
  setImmediate(() => {
    runOrchestrator().catch(err => console.error('[mx4] manual run error:', err))
  })
})

export default mx4Router
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /opt/bacta && npx vitest run tests/server/mx4.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /opt/bacta && git add server/api/mx4.ts tests/server/mx4.test.ts
git commit -m "feat(mx4): /run triggers TypeScript orchestrator fire-and-forget; drop signal file"
```

---

## Task 9: Update System Prompt

**Files:**
- Modify: `mx4/system-prompt.md`

The current system prompt ends with an `## Output Format` section that instructs HTML fragment output. That section is obsolete — the orchestrator's two-step pipeline owns output format now. Replace it with voice and analytical depth guidance.

- [ ] **Step 1: Read `mx4/system-prompt.md` to find the Output Format section**

Read the file, locate `## Output Format` (around line 113).

- [ ] **Step 2: Replace the Output Format section**

Replace the entire `## Output Format` section (from `## Output Format` to the end of the file) with:

```markdown
---

## Analysis Depth — Non-Negotiable

Every briefing must include all of the following. If any are absent, the analysis is incomplete.

1. **Physiological context** — explain what the metric measures biologically. Not "your HRV is good." What does HRV measure? What does a 14% week-over-week decline indicate at the autonomic level?

2. **Personal trend** — compare to Ethan's own 30-day baseline, not population norms alone. Use queryDb to pull the trend data. His data is available. Use it.

3. **Population comparison** — compare to peer-reviewed norms for a 26-year-old male recreational runner/athlete where relevant. State the comparison directly.

4. **Forward projection** — given current trajectory, where does this metric land in 4–8 weeks? Be specific. "Appears stable" is not a projection.

5. **Actionable recommendation** — one specific, concrete thing to do differently. Or an explicit confirmation that the current approach is correct and why. Vague guidance ("rest more," "sleep better") is not acceptable.

**Failure condition:** If this analysis could have been generated without access to Ethan's specific data, it is not good enough.

---

*MX-4 — Cybot Galactica MX-series multi-system interface unit*
*Commissioned at Affa orbital assembly platform*
*Signature: `#2bc4e8`*
```

- [ ] **Step 3: Commit**

```bash
cd /opt/bacta && git add mx4/system-prompt.md
git commit -m "docs(mx4): system-prompt — replace HTML output section with analysis depth standards"
```

---

## Task 10: Seed Wiki Files

**Files:**
- Create: `mx4/HEARTBEAT.md`
- Create: `mx4/wiki/SCHEMA.md`
- Create: `mx4/wiki/ethan-profile.md`
- Create: `mx4/wiki/weekly-observations.md`
- Create: `mx4/wiki/hrv-patterns.md`
- Create: `mx4/wiki/sleep-patterns.md`
- Create: `mx4/wiki/training-patterns.md`
- Create: `mx4/wiki/correlations.md`
- Create: `mx4/wiki/archive/.gitkeep`

- [ ] **Step 1: Create `mx4/HEARTBEAT.md`**

```markdown
# MX-4 Standing Orders
Last updated: 2026-06-14

## Current Focus
Establish baselines. This is the first orchestrator run. Focus on identifying Ethan's personal norms across all three sections before making trend-based assessments. Note what data is sparse or absent.

## Suppressions
None yet.

## Context
Ethan is preparing for a wedding in late July 2026. His declared VO2 max target is 52–55 ml/kg/min ("Excellent" for a 26-year-old male). He is a software engineer, athlete, and lacrosse official. Training load has been building through a summer running block. Sleep patterns reflect a busy schedule with variable overnight stress scores.

Update this file between sessions to redirect MX-4's attention or suppress repeated observations.
```

- [ ] **Step 2: Create `mx4/wiki/SCHEMA.md`**

```markdown
# Wiki Schema and Maintenance Rules

## Purpose
This wiki is MX-4's persistent knowledge base — the accumulated understanding of Ethan's patterns that informs every briefing. It is not a raw data log. It is distilled knowledge: patterns, baselines, correlations, and trajectories that have been observed and validated across multiple sessions.

## Pages

| Page | Purpose | Update trigger |
|---|---|---|
| `ethan-profile.md` | Stable facts: goals, background, targets, training history | Only when facts change |
| `hrv-patterns.md` | Autonomic patterns, baseline, recovery correlations | When a new pattern is established |
| `sleep-patterns.md` | Architecture tendencies, stage deficits, sleep stress patterns | When a new pattern is established |
| `training-patterns.md` | Load tolerance, VO2 trajectory, training block notes | Each training week |
| `weekly-observations.md` | Rolling ~14-day log of notable findings | Every session |
| `correlations.md` | Cross-domain patterns (sleep ↔ HRV, load ↔ recovery) | When correlation is confirmed |

## Page Length Discipline
- Soft limit: 1500 estimated tokens (~1200 words). writeWikiPage warns when exceeded.
- Hard limit: 2000 tokens. The wrap step archives the current version and synthesizes a denser replacement.
- Result: pages stay accurate and dense. They are not observation logs — they are distilled patterns.

## Writing Rules
- State what is known, not what was observed once. One anomalous reading is not a pattern.
- `ethan-profile.md` contains stable facts only — not session-specific observations.
- `weekly-observations.md` is a rolling window. Oldest entries are dropped when the page reaches ~1500 tokens.
- Archive naming: `YYYY-MM-DD-{page-name}.md`

## What MX-4 Should Write Here
- A new HRV baseline value after 7+ days of consistent readings
- A confirmed correlation (e.g., "high training load day → HRV suppression 2 days later")
- A trajectory update (e.g., "VO2 max has improved 1 point over 6 weeks")
- A pattern (e.g., "deep sleep percentage drops on days following >90 min intensity")
- NOT: individual night's sleep score, today's body battery reading
```

- [ ] **Step 3: Create `mx4/wiki/ethan-profile.md`**

```markdown
# Ethan Profile

## Identity
- Name: Ethan Bridgehouse
- Age: 26 (male)
- Role: Software engineer, athlete, lacrosse official
- Location: Home in EST timezone; biometrics tracked via Garmin device

## Declared Goals
- VO2 max target: 52–55 ml/kg/min ("Excellent" for 26-year-old male) by late July 2026 (pre-wedding)
- Current VO2 max: ~51–52 ml/kg/min (as of mid-June 2026)
- Summer training block: building aerobic base through structured running

## Training Context
- Primary sport: running (trail and road)
- Secondary activities: strength training, multi-sport
- Lacrosse officiating adds physical activity but is not tracked as structured training
- Training follows a build/recover periodization pattern

## Health Baseline (approximate, as of June 2026)
- HRV: ~54ms average (7-day); varies 45–70ms depending on load and recovery
- Resting HR: ~48–52 bpm
- Body battery: typically 70–90 at wake on recovery days, lower during high-load periods

## Key Dates
- Late July 2026: Wedding — the target date for peak aerobic fitness

## Preferences
- Prefers direct assessment over cushioned readings
- Compares understanding over time — does not need simplification
- Uses biometric data seriously; MX-4's analysis informs actual training decisions
```

- [ ] **Step 4: Create empty wiki pages**

Create each file with a minimal header so `readAllWikiPagesSync` has something to load:

```markdown
# Weekly Observations
_(MX-4 will populate this on first run)_
```

```markdown
# HRV Patterns
_(MX-4 will populate this as patterns emerge)_
```

```markdown
# Sleep Patterns
_(MX-4 will populate this as patterns emerge)_
```

```markdown
# Training Patterns
_(MX-4 will populate this as patterns emerge)_
```

```markdown
# Correlations
_(MX-4 will populate this as cross-domain patterns are identified)_
```

Save these to:
- `mx4/wiki/weekly-observations.md`
- `mx4/wiki/hrv-patterns.md`
- `mx4/wiki/sleep-patterns.md`
- `mx4/wiki/training-patterns.md`
- `mx4/wiki/correlations.md`

- [ ] **Step 5: Create archive directory placeholder**

```bash
touch /opt/bacta/mx4/wiki/archive/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add mx4/HEARTBEAT.md mx4/wiki/
git commit -m "feat(mx4): seed wiki files — HEARTBEAT.md, SCHEMA.md, ethan-profile.md, empty pattern pages"
```

---

## Task 11: Client Briefing Type + useBriefing Hook

**Files:**
- Create: `client/src/lib/briefing.ts`
- Create: `client/src/hooks/useBriefing.ts`

- [ ] **Step 1: Create `client/src/lib/briefing.ts`**

```typescript
export interface BriefingResult {
  tone:           'POSITIVE' | 'CAUTION' | 'FLAG'
  headline:       string
  body:           string
  recommendation: string
  flags:          string[]
  generated_at?:  string
  model?:         string
}
```

- [ ] **Step 2: Create `client/src/hooks/useBriefing.ts`**

```typescript
import { useState, useEffect } from 'react'
import type { BriefingResult } from '../lib/briefing'

export function useBriefing(section: string): BriefingResult | null {
  const [data, setData] = useState<BriefingResult | null>(null)

  useEffect(() => {
    fetch(`/api/insights/${section}`)
      .then(r => r.json())
      .then((d: BriefingResult) => setData(d))
      .catch(err => console.error(`[useBriefing:${section}]`, err))
  }, [section])

  return data
}
```

- [ ] **Step 3: Type check client**

```bash
cd /opt/bacta && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /opt/bacta && git add client/src/lib/briefing.ts client/src/hooks/useBriefing.ts
git commit -m "feat(mx4): client BriefingResult type and useBriefing fetch hook"
```

---

## Task 12: Update MX4Briefing Component

**Files:**
- Modify: `client/src/components/MX4Card.tsx`

The current `MX4Briefing` accepts `brief: Brief` (stub shape). Add an optional `liveData?: BriefingResult` prop. When `liveData` is present, render the live layout: headline subhead, `react-markdown` body, recommendation directive row, flags in chips. When absent, fall back to existing stub rendering.

- [ ] **Step 1: Read `client/src/components/MX4Card.tsx` to confirm current state**

Check the `MX4BriefingProps` interface and the current render structure (already read earlier — confirm no changes since session start).

- [ ] **Step 2: Update `client/src/components/MX4Card.tsx`**

Add to imports at top:
```typescript
import ReactMarkdown from 'react-markdown'
import type { BriefingResult } from '../lib/briefing'
```

Update `MX4BriefingProps`:
```typescript
interface MX4BriefingProps {
  accent:    string
  brief:     Brief
  liveData?: BriefingResult
}
```

Replace the `MX4Briefing` function body with a version that uses `liveData` when present:

```typescript
export function MX4Briefing({ accent, brief, liveData }: MX4BriefingProps) {
  // Derive display values — live data takes priority over stub
  const rawTone    = liveData ? liveData.tone.toLowerCase() as Tone : brief.tone
  const activeMood: MX4Mood = liveData
    ? (liveData.tone === 'POSITIVE' ? 'pleased' : 'alert')
    : brief.mood
  const activeMeta = liveData?.generated_at
    ? (() => {
        const d = new Date(liveData.generated_at)
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
      })()
    : brief.meta

  const tc = toneColor(rawTone)
  const verdictLabel = rawTone === 'flag' ? 'FLAG' : rawTone === 'caution' ? 'CAUTION' : 'POSITIVE'

  return (
    <div
      style={{
        position: 'relative',
        background: `linear-gradient(160deg, ${hexA(accent, 0.10)}, ${COLORS.surface} 55%)`,
        border: `1px solid ${hexA(accent, 0.35)}`,
        borderRadius: 14,
        boxShadow: `0 0 32px ${hexA(accent, 0.08)}`,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px 11px' }}>
        <MX4Sigil color={accent} size={19} spin mood={activeMood} />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: accent,
            flex: 1,
            minWidth: 0,
          }}
        >
          INCOMING // MX-4
        </span>
        {activeMeta && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', color: COLORS.textMuted, flexShrink: 0 }}>
            {activeMeta}
          </span>
        )}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: FONT_MONO,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            padding: '3px 9px',
            borderRadius: 20,
            background: hexA(tc, 0.18),
            color: tc,
            border: `1px solid ${hexA(tc, 0.4)}`,
            flexShrink: 0,
          }}
        >
          <StatusCore accent={tc} size={5} />
          {verdictLabel}
        </span>
      </div>

      {/* Body — live markdown or stub text */}
      <div style={{ padding: '0 15px 13px' }}>
        {liveData ? (
          <>
            {/* Headline */}
            <p style={{ margin: '0 0 7px 0', fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: accent }}>
              {liveData.headline}
            </p>
            {/* Body via react-markdown */}
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p style={{ margin: '0 0 8px 0', fontFamily: FONT_UI, fontSize: 15, lineHeight: 1.55, color: '#eef4fb' }}>
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong style={{ color: accent, fontWeight: 600 }}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em style={{ color: COLORS.textSecondary, fontStyle: 'italic' }}>{children}</em>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: '0 0 8px 0', paddingLeft: 18 }}>{children}</ul>
                ),
                li: ({ children }) => (
                  <li style={{ fontFamily: FONT_UI, fontSize: 14, lineHeight: 1.5, color: '#eef4fb', marginBottom: 3 }}>{children}</li>
                ),
              }}
            >
              {liveData.body}
            </ReactMarkdown>
            {/* Recommendation directive */}
            <div
              style={{
                marginTop: 8,
                padding: '7px 10px',
                background: hexA(accent, 0.07),
                borderLeft: `2px solid ${hexA(accent, 0.5)}`,
                borderRadius: '0 6px 6px 0',
              }}
            >
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: accent, fontWeight: 700 }}>DIRECTIVE · </span>
              <span style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text, lineHeight: 1.4 }}>{liveData.recommendation}</span>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 16, lineHeight: 1.55, color: '#eef4fb' }}>
            {brief.line}
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 7,
                height: '0.9em',
                background: accent,
                marginLeft: 3,
                verticalAlign: 'middle',
                animation: 'mx4blink 1.1s step-end infinite',
              }}
            />
          </p>
        )}
      </div>

      {/* Footer chips */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 15px 13px',
          borderTop: `1px solid ${hexA(accent, 0.18)}`,
        }}
      >
        {liveData ? (
          <>
            <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
              FLAGS <span style={{ color: liveData.flags.length > 0 ? tc : accent }}>{liveData.flags.length}</span>
            </span>
            {liveData.flags.slice(0, 2).map((flag, i) => (
              <span key={i} style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: '0.08em', color: COLORS.textMuted }}>
                · {flag.toUpperCase()}
              </span>
            ))}
          </>
        ) : (
          brief.chips.map(([key, val]) => (
            <span key={key} style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
              {key}{' '}
              <span style={{ color: accent }}>{val}</span>
            </span>
          ))
        )}
        <span style={{ marginLeft: 'auto' }}>
          <FTelemetry color={accent} bars={4} />
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type check**

```bash
cd /opt/bacta && npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
cd /opt/bacta && git add client/src/components/MX4Card.tsx
git commit -m "feat(mx4): MX4Briefing accepts liveData prop — react-markdown body, headline, recommendation"
```

---

## Task 13: Wire Section Pages

**Files:**
- Modify: `client/src/pages/RecoveryPage.tsx`
- Modify: `client/src/pages/SleepPage.tsx`
- Modify: `client/src/pages/TrainingPage.tsx`

The pattern is the same for all three pages. Read each file to find the `MX4Briefing` usage, add the `useBriefing` import and call, and pass `liveData`.

- [ ] **Step 1: Update `client/src/pages/RecoveryPage.tsx`**

Add import at top:
```typescript
import { useBriefing } from '../hooks/useBriefing'
```

Inside the component function body (before the return), add:
```typescript
const liveBriefing = useBriefing('recovery')
```

Find the `<MX4Briefing accent={A} brief={BRIEFS.recovery} />` line and update it to:
```typescript
<MX4Briefing accent={A} brief={BRIEFS.recovery} liveData={liveBriefing ?? undefined} />
```

- [ ] **Step 2: Update `client/src/pages/SleepPage.tsx`**

Same pattern:
```typescript
import { useBriefing } from '../hooks/useBriefing'
// ...
const liveBriefing = useBriefing('sleep')
// ...
<MX4Briefing accent={A} brief={BRIEFS.sleep} liveData={liveBriefing ?? undefined} />
```

- [ ] **Step 3: Update `client/src/pages/TrainingPage.tsx`**

Same pattern:
```typescript
import { useBriefing } from '../hooks/useBriefing'
// ...
const liveBriefing = useBriefing('training')
// ...
<MX4Briefing accent={A} brief={BRIEFS.training} liveData={liveBriefing ?? undefined} />
```

- [ ] **Step 4: Type check**

```bash
cd /opt/bacta && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Run client tests**

```bash
cd /opt/bacta && npm run test:client
```
Expected: all client tests pass. (Section page tests mock the API and won't be affected since they test component rendering, not the live fetch.)

- [ ] **Step 6: Commit**

```bash
cd /opt/bacta && git add client/src/pages/RecoveryPage.tsx client/src/pages/SleepPage.tsx client/src/pages/TrainingPage.tsx
git commit -m "feat(mx4): wire section pages to useBriefing — live briefings replace stubs when available"
```

---

## Task 14: Run Full Test Suite and Type Check

- [ ] **Step 1: Run all tests**

```bash
cd /opt/bacta && npm test
```
Expected: all tests pass (213+ tests — the 5 new test files add more).

- [ ] **Step 2: Type check server**

```bash
cd /opt/bacta && npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors.

- [ ] **Step 3: Type check client**

```bash
cd /opt/bacta && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Fix any issues, then commit**

If any tests fail or type errors appear, fix them before proceeding. Once clean:

```bash
cd /opt/bacta && git add -A
git commit -m "fix: resolve any type errors and test failures from Phase 2"
```
(Only commit this step if there were actual fixes; skip if previous tasks were clean.)

---

## Task 15: Manual First Run and Verification

This task requires a configured API key in the app settings. If no API key is set, the orchestrator will fail gracefully and log an error — that's expected behavior.

- [ ] **Step 1: Build and start the dev server**

```bash
cd /opt/bacta && npm run dev:server &
```

- [ ] **Step 2: Verify the nightly scheduler logs on startup**

Check server console output for:
```
[mx4] nightly run scheduled at 04:00 (cron: 00 04 * * *)
```
Or if no API key is set, check that startup still succeeds without crashing.

- [ ] **Step 3: Trigger a manual run**

```bash
curl -X POST http://localhost:3001/api/mx4/run
```
Expected response: `{"ok":true}` with HTTP 202.

- [ ] **Step 4: Check server logs for orchestrator activity**

Within ~30 seconds, the console should show:
```
[mx4] orchestrator run started <timestamp>
[mx4] recovery briefing written
[mx4] sleep briefing written
[mx4] training briefing written
[mx4] orchestrator run complete
```
(Or error logs if no API key is configured — expected and handled gracefully.)

- [ ] **Step 5: Verify briefings in DB (if run succeeded)**

```bash
# Use the bacta-sqlite MCP or sqlite3 if available:
# SELECT section, generated_at FROM mx4_briefings;
curl http://localhost:3001/api/insights/recovery
```
Expected: JSON with `tone`, `headline`, `body`, `recommendation`, `flags` — MX-4's voice, not stub text.

- [ ] **Step 6: Visual verification via app**

```
/run
```

Navigate to Recovery section, then Sleep, then Training. Each should show the live `MX4Briefing` with the headline, markdown body, and recommendation directive row — not the five-week-old stub text.

- [ ] **Step 7: Kill dev server and commit verification**

```bash
kill %1  # or kill the background job
cd /opt/bacta && git tag mx4-phase2-complete
```

---

## Self-Review: Spec Coverage Check

| Spec requirement | Task |
|---|---|
| sections.ts with corrected metric names | Task 2 |
| orchestrator.ts — two-step generateText + generateObject | Task 4 |
| wiki.ts plain utility functions | Task 3 |
| wrap.ts — archive oversized pages | Task 5 |
| node-cron nightly scheduler | Task 6 |
| Reschedule on settings change | Task 6 |
| GET /api/insights/:section reads mx4_briefings | Task 7 |
| POST /api/mx4/run fire-and-forget | Task 8 |
| system-prompt.md HTML output section removed | Task 9 |
| HEARTBEAT.md created | Task 10 |
| mx4/wiki/ seeded with initial pages | Task 10 |
| MX4Briefing liveData prop + react-markdown | Task 12 |
| Section pages wired to useBriefing | Task 13 |
| All tests pass | Task 14 |
| Manual first run verified | Task 15 |
