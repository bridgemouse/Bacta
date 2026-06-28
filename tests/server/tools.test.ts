import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

process.env.DB_PATH = ':memory:'

const TEST_WIKI_DIR = path.join(os.tmpdir(), 'bacta-wiki-test-' + process.pid)
process.env.WIKI_DIR = TEST_WIKI_DIR

describe('MX-4 Tools', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { default: db } = await import('../../server/db/client')
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      'INSERT INTO health_snapshots (date, metric, value, unit) VALUES (?, ?, ?, ?)'
    ).run(today, 'hrv', 52, 'ms')
    fs.mkdirSync(TEST_WIKI_DIR, { recursive: true })
  })

  afterAll(() => {
    fs.rmSync(TEST_WIKI_DIR, { recursive: true, force: true })
  })

  describe('queryDb', () => {
    it('returns rows for a valid SELECT', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const today = new Date().toISOString().slice(0, 10)
      const result = await queryDb.execute!({ sql: `SELECT value FROM health_snapshots WHERE metric = 'hrv' AND date = '${today}'` }) as any
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].value).toBe(52)
    })

    it('returns error for non-SELECT statement', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const result = await queryDb.execute!({ sql: 'DROP TABLE health_snapshots' }) as any
      expect(result.error).toMatch(/SELECT/)
    })

    it('returns error for invalid SQL', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const result = await queryDb.execute!({ sql: 'SELECT * FROM nonexistent_table' }) as any
      expect(result.error).toBeDefined()
    })

    it('can query mx4_briefings table', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
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

    it('rejects UPDATE and does not mutate data', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const { default: db } = await import('../../server/db/client')
      const before = db.prepare("SELECT value FROM health_snapshots WHERE metric='hrv'").get() as any
      const result = await queryDb.execute!({ sql: "UPDATE health_snapshots SET value=0 WHERE metric='hrv'" }) as any
      expect(result.error).toMatch(/SELECT/)
      const after = db.prepare("SELECT value FROM health_snapshots WHERE metric='hrv'").get() as any
      expect(after.value).toBe(before.value)
    })

    it('rejects DELETE', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const result = await queryDb.execute!({ sql: 'DELETE FROM health_snapshots' }) as any
      expect(result.error).toMatch(/SELECT/)
    })

    it('rejects multiple statements (injection via ;)', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const result = await queryDb.execute!({ sql: 'SELECT 1; DROP TABLE health_snapshots' }) as any
      expect(result.error).toBeDefined()
      const { default: db } = await import('../../server/db/client')
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='health_snapshots'").get()
      expect(exists).toBeTruthy()
    })

    it('rejects a write smuggled inside a CTE', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const result = await queryDb.execute!({ sql: "WITH x AS (SELECT 1) DELETE FROM health_snapshots" }) as any
      expect(result.error).toBeDefined()
    })

    it('allows a read-only WITH ... SELECT', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const result = await queryDb.execute!({ sql: "WITH x AS (SELECT value FROM health_snapshots WHERE metric='hrv') SELECT * FROM x" }) as any
      expect(result.rows).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('does not leak SQLite error text / schema on failure', async () => {
      const { queryDb } = await import('../../server/lib/ai/tools')
      const result = await queryDb.execute!({ sql: 'SELECT * FROM secret_table_name' }) as any
      expect(result.error).toBeDefined()
      expect(result.error).not.toContain('secret_table_name')
    })
  })

  describe('readAllWikiPages', () => {
    it('returns placeholder when wiki is empty', async () => {
      const { readAllWikiPages } = await import('../../server/lib/ai/tools')
      const result = await readAllWikiPages.execute!({}) as any
      expect(result.content).toContain('empty')
    })

    it('returns page content after a page is written', async () => {
      fs.writeFileSync(path.join(TEST_WIKI_DIR, 'test-page.md'), '# Test\nHello wiki.')
      const { readAllWikiPages } = await import('../../server/lib/ai/tools')
      const result = await readAllWikiPages.execute!({}) as any
      expect(result.content).toContain('Hello wiki.')
    })
  })

  describe('writeWikiPage', () => {
    it('creates a wiki page and returns token estimate', async () => {
      const { writeWikiPage } = await import('../../server/lib/ai/tools')
      const result = await writeWikiPage.execute!({ name: 'hrv-patterns', content: '# HRV Patterns\nBaseline is 52ms.' }) as any
      expect(result.ok).toBe(true)
      expect(result.tokenEstimate).toBeGreaterThan(0)
      expect(fs.existsSync(path.join(TEST_WIKI_DIR, 'hrv-patterns.md'))).toBe(true)
    })

    it('returns a warning when content exceeds 1500 tokens', async () => {
      const { writeWikiPage } = await import('../../server/lib/ai/tools')
      const longContent = 'word '.repeat(2000)
      const result = await writeWikiPage.execute!({ name: 'long-page', content: longContent }) as any
      expect(result.warning).toBeDefined()
      expect(result.warning).toContain('1500')
    })
  })

  describe('listWikiPages', () => {
    it('returns page names and token estimates', async () => {
      const { listWikiPages } = await import('../../server/lib/ai/tools')
      const result = await listWikiPages.execute!({}) as any
      expect(result.pages.length).toBeGreaterThan(0)
      expect(result.pages[0]).toHaveProperty('name')
      expect(result.pages[0]).toHaveProperty('tokenEstimate')
    })
  })

  describe('archiveWikiPage', () => {
    it('copies the page to archive directory', async () => {
      const { archiveWikiPage } = await import('../../server/lib/ai/tools')
      const result = await archiveWikiPage.execute!({ name: 'hrv-patterns' }) as any
      expect(result.ok).toBe(true)
      const archiveDir = path.join(TEST_WIKI_DIR, 'archive')
      const files = fs.readdirSync(archiveDir)
      expect(files.some(f => f.includes('hrv-patterns'))).toBe(true)
    })

    it('returns error when page does not exist', async () => {
      const { archiveWikiPage } = await import('../../server/lib/ai/tools')
      const result = await archiveWikiPage.execute!({ name: 'nonexistent-page' }) as any
      expect(result.error).toBeDefined()
    })
  })
})
