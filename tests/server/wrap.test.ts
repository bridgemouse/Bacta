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

    const rewritten = fs.readFileSync(path.join(dir, 'oversized-page.md'), 'utf-8')
    expect(rewritten).toBe('Synthesized content: patterns observed across 14 days.')
  })
})
