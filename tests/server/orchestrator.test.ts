import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

process.env.DB_PATH   = ':memory:'
process.env.WIKI_DIR  = path.join(os.tmpdir(), 'bacta-orch-wiki-' + process.pid)

// Mock generateText and generateObject from 'ai' before any imports
// Use importOriginal to preserve `tool` (used at module load time in tools.ts)
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
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
  }
})

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
