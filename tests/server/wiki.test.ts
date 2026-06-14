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
