import { tool } from 'ai'
import { z } from 'zod'
import { dbReadonly } from '../../db/client'
import {
  readAllWikiPagesSync,
  writeWikiPageSync,
  listWikiPagesSync,
  archiveWikiPageSync,
} from './wiki'

const QUERY_DB_DESCRIPTION = `Run a read-only SQL SELECT query against the health biometric database.

Schema:
  health_snapshots(date TEXT, metric TEXT, source TEXT, value REAL, unit TEXT, source_json TEXT)
  health_activities(date TEXT, activity_id TEXT, source TEXT, type_key TEXT, duration_s REAL, distance_m REAL, calories REAL, avg_hr REAL, training_effect REAL)
  mx4_briefings(section TEXT, content_json TEXT, generated_at TEXT, model TEXT)
    — section values: 'recovery', 'sleep', 'training', 'home'
    — content_json is a JSON string: { tone, headline, summary, body, recommendation, flags }
    — Query example: SELECT section, content_json FROM mx4_briefings WHERE section IN ('recovery','sleep','training')

health_snapshots uses EAV format — one row per metric per day. ALWAYS filter by metric name:
  SELECT date, value FROM health_snapshots WHERE metric = 'hrv' ORDER BY date DESC LIMIT 30

Never use column names like sleep_score or hrv as column selectors — they are VALUES in the metric column.

For the full metric catalog (names, units, typical ranges, sparse flags) see MX4_REFERENCE.md in your context.
To discover what metrics are actually present in the DB: SELECT DISTINCT metric FROM health_snapshots ORDER BY metric`

export const queryDb = tool({
  description: QUERY_DB_DESCRIPTION,
  inputSchema: z.object({
    sql: z.string().describe('SQL SELECT query to execute'),
  }),
  execute: async ({ sql }) => {
    const trimmed = sql.trim()
    // Defense in depth: (1) must read as SELECT/WITH, (2) runs on an engine-level
    // read-only connection, (3) prepare() throws on multiple statements, and
    // (4) stmt.reader rejects anything that doesn't return rows (writes/DDL/PRAGMA-set).
    if (!/^(select|with)\b/i.test(trimmed)) {
      return { error: 'Only read-only SELECT queries are permitted' }
    }
    try {
      const stmt = dbReadonly.prepare(trimmed)
      if (!stmt.reader) {
        return { error: 'Only read-only SELECT queries are permitted' }
      }
      return { rows: stmt.all() }
    } catch {
      // Never leak SQLite error text / schema back to the model.
      return { error: 'Query failed — check the metric name and SQL syntax.' }
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
