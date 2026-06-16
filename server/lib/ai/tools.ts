import { tool } from 'ai'
import { z } from 'zod'
import { dbReadonly } from '../../db/client'
import {
  readAllWikiPagesSync,
  writeWikiPageSync,
  listWikiPagesSync,
  archiveWikiPageSync,
} from './wiki'

const QUERY_DB_DESCRIPTION = `Run a read-only SQL SELECT query against the Garmin biometric database.

Schema:
  garmin_snapshots(date TEXT, metric TEXT, value REAL, unit TEXT, source_json TEXT)
  garmin_activities(date TEXT, activity_id TEXT, type_key TEXT, duration_s REAL, distance_m REAL, calories REAL, avg_hr REAL, training_effect REAL)
  mx4_briefings(section TEXT, content_json TEXT, generated_at TEXT, model TEXT)
    — section values: 'recovery', 'sleep', 'training', 'home'
    — content_json is a JSON string: { tone, headline, summary, body, recommendation, flags }
    — Query example: SELECT section, content_json FROM mx4_briefings WHERE section IN ('recovery','sleep','training')

garmin_snapshots uses EAV format — one row per metric per day. ALWAYS filter by metric name:
  SELECT date, value FROM garmin_snapshots WHERE metric = 'hrv' ORDER BY date DESC LIMIT 30

Never use column names like sleep_score or hrv as column selectors — they are VALUES in the metric column.

Available metric names:
  hrv, hrv_baseline_high, hrv_baseline_low, hrv_week_avg
  recovery_score, recovery_time_h
  resting_hr, stress_avg, stress_max
  body_battery_charged, body_battery_drained, body_battery_wake, body_battery_current
  sleep_s, sleep_score, sleep_deep_s, sleep_rem_s, sleep_light_s, sleep_awake_s, sleep_stress, sleep_spo2, sleep_hr, sleep_resp
  resp_avg, resp_max, spo2_avg
  steps, distance_m, intensity_mod_min, intensity_vig_min
  training_load, training_load_min, training_load_max, training_status_n
  vo2max, fitness_age, fitness_age_achievable
  calories_active, calories_total
  hrzone_1_min, hrzone_2_min, hrzone_3_min, hrzone_4_min, hrzone_5_min`

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
