import { tool } from 'ai'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import db from '../../db/client'
import {
  readAllWikiPagesSync,
  writeWikiPageSync,
  listWikiPagesSync,
  archiveWikiPageSync,
} from './wiki'

const VAULT_ROOT = process.env.VAULT_WIKI_ROOT ?? '/mnt/vault/wiki'

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
  execute: async () => ({ content: readAllWikiPagesSync() }),
})

export const writeWikiPage = tool({
  description: 'Write or update a wiki page. Returns a warning if the page exceeds 1500 estimated tokens.',
  inputSchema: z.object({
    name:    z.string().describe('Page filename without extension, e.g. "hrv-patterns"'),
    content: z.string().describe('Full markdown content for the page'),
  }),
  execute: async ({ name, content }) => {
    const result = writeWikiPageSync(name, content)
    return { ok: true, ...result }
  },
})

export const listWikiPages = tool({
  description: 'List all wiki pages with estimated token counts. Used by the wrap step to detect pages needing synthesis.',
  inputSchema: z.object({}),
  execute: async () => ({ pages: listWikiPagesSync() }),
})

export const archiveWikiPage = tool({
  description: 'Copy the current version of a wiki page to the archive directory before rewriting with a synthesis.',
  inputSchema: z.object({
    name: z.string().describe('Page filename without extension, e.g. "hrv-patterns"'),
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
