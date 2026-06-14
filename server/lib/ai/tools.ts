import { tool } from 'ai'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import db from '../../db/client'

const WIKI_DIR   = process.env.WIKI_DIR        ?? path.join(process.cwd(), 'mx4', 'wiki')
const VAULT_ROOT = process.env.VAULT_WIKI_ROOT ?? '/mnt/vault/wiki'

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

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
    relativePath: z.string().describe('Path relative to vault wiki root, e.g. "training/summer-plan.md"'),
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
  execute: async () => {
    if (!fs.existsSync(WIKI_DIR)) return { content: '(wiki not yet initialized)' }
    const files = fs.readdirSync(WIKI_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
    if (files.length === 0) return { content: '(wiki is empty)' }
    const parts = files.map(f => {
      const content = fs.readFileSync(path.join(WIKI_DIR, f), 'utf-8')
      return `\n\n=== ${f} ===\n${content}`
    })
    return { content: parts.join('') }
  },
})

export const writeWikiPage = tool({
  description: 'Write or update a wiki page. Returns a warning if the page exceeds 1500 estimated tokens.',
  inputSchema: z.object({
    name:    z.string().describe('Page filename without extension, e.g. "hrv-patterns"'),
    content: z.string().describe('Full markdown content for the page'),
  }),
  execute: async ({ name, content }) => {
    fs.mkdirSync(WIKI_DIR, { recursive: true })
    fs.writeFileSync(path.join(WIKI_DIR, `${name}.md`), content, 'utf-8')
    const tokenEstimate = estimateTokens(content)
    const warning = tokenEstimate > 1500
      ? `Page is ~${tokenEstimate} estimated tokens (soft limit 1500, hard limit 2000). Synthesis required before next write if over 2000.`
      : undefined
    return { ok: true, tokenEstimate, warning }
  },
})

export const listWikiPages = tool({
  description: 'List all wiki pages with estimated token counts. Used by the wrap step to detect pages needing synthesis.',
  inputSchema: z.object({}),
  execute: async () => {
    if (!fs.existsSync(WIKI_DIR)) return { pages: [] }
    const files = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.md')).sort()
    const pages = files.map(f => {
      const content = fs.readFileSync(path.join(WIKI_DIR, f), 'utf-8')
      return { name: f.replace('.md', ''), tokenEstimate: estimateTokens(content) }
    })
    return { pages }
  },
})

export const archiveWikiPage = tool({
  description: 'Copy the current version of a wiki page to the archive directory before rewriting with a synthesis.',
  inputSchema: z.object({
    name: z.string().describe('Page filename without extension, e.g. "hrv-patterns"'),
  }),
  execute: async ({ name }) => {
    const srcPath = path.join(WIKI_DIR, `${name}.md`)
    if (!fs.existsSync(srcPath)) return { error: `Page not found: ${name}` }
    const archiveDir = path.join(WIKI_DIR, 'archive')
    fs.mkdirSync(archiveDir, { recursive: true })
    const date     = new Date().toISOString().slice(0, 10)
    const destPath = path.join(archiveDir, `${date}-${name}.md`)
    fs.copyFileSync(srcPath, destPath)
    return { ok: true, archivedTo: `archive/${date}-${name}.md` }
  },
})
