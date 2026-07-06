import { Router } from 'express'
import { streamText, stepCountIs } from 'ai'
import { runOrchestrator, runSectionById, loadSystemPrompt } from '../lib/ai/orchestrator'
import { SECTIONS } from '../lib/ai/sections'
import { assembleSystemPrompt } from '../lib/ai/prompt'
import { loadChatHistory } from '../lib/ai/chat'
import { getModel } from '../lib/ai/provider'
import { readAllWikiPagesSync, loadHeartbeat, resetWikiPatternPages, resetAllWikiPages } from '../lib/ai/wiki'
import { queryDb, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage } from '../lib/ai/tools'
import { research } from '../lib/ai/research'
import { getVaultTools, isVaultEnabled } from '../lib/ai/vaultClient'
import { getSetting } from '../lib/settings'
import { logEvent } from '../lib/logger'
import db from '../db/client'

export function toolLabel(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'queryDb': {
      const sql = String(args.sql ?? '')
      const match = sql.match(/metric\s*=\s*'([^']+)'/i)
      return match ? `PULLING TELEMETRY ON ${match[1]}` : 'PULLING TELEMETRY'
    }
    case 'research': {
      const q = String(args.query ?? '').slice(0, 50).trim()
      return q ? `SWEEPING ARCHIVES FOR ${q}` : 'SWEEPING ARCHIVES'
    }
    case 'readAllWikiPages':
      return 'CONSULTING LOADED MATRICES'
    case 'writeWikiPage': {
      const name = String(args.name ?? '')
      return name ? `ENCODING ${name} TO MATRIX` : 'ENCODING TO MATRIX'
    }
    case 'archiveWikiPage': {
      const name = String(args.name ?? '')
      return name ? `ARCHIVING ${name} FROM MATRIX` : 'ARCHIVING FROM MATRIX'
    }
    case 'listWikiPages':
      return 'SURVEYING LOADED MATRICES'
    case 'search_wiki': {
      const q = String(args.query ?? '').slice(0, 50).trim()
      return q ? `SWEEPING EXTERNAL MATRIX FOR ${q}` : 'SWEEPING EXTERNAL MATRIX'
    }
    case 'read_wiki_page': {
      const path = String(args.path ?? '')
      return path ? `PULLING ${path} FROM EXTERNAL MATRIX` : 'PULLING FROM EXTERNAL MATRIX'
    }
    case 'get_wiki_index':
      return 'ORIENTING ON EXTERNAL MATRIX'
    case 'list_wiki_pages':
      return 'SURVEYING EXTERNAL MATRIX'
    default:
      return `ACCESSING ${toolName.toUpperCase()}`
  }
}

// Error, not Error: unknown rejections can be plain error-shaped objects
// ({ code, message }, common from MCP/JSON-RPC transports) rather than Error
// instances — String(obj) would collapse those to "[object Object]".
function errorDetail(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

export function categorizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : ''
  if (/api.key|not configured|no.*(provider|ai)|invalid.key|unauthorized/i.test(msg)) {
    return 'No AI provider configured. Check Settings → Intelligence.'
  }
  if (/rate.limit|429|quota|too many requests/i.test(msg)) {
    return 'Rate limit reached — try again in a moment.'
  }
  if (/timeout|timed out/i.test(msg)) {
    return 'MX-4 timed out during analysis. Try a shorter query.'
  }
  return 'MX-4 encountered an error. Try again.'
}

async function compressSessionIfNeeded(sessionId: string): Promise<void> {
  const threshold = parseInt(getSetting('mx4_chat_compression_threshold') ?? '20', 10)
  const rows = db.prepare(
    'SELECT id, role, content FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as { id: number; role: string; content: string }[]

  if (rows.length <= threshold) return

  const toCompress = rows.slice(0, rows.length - threshold)
  const text = toCompress.map(r => `${r.role.toUpperCase()}: ${r.content}`).join('\n\n')

  const { generateText: gt } = await import('ai')
  const { text: compressed } = await gt({
    model: getModel('chat'),
    prompt: `You are MX-4. Compress the following conversation history into a single concise summary in your voice, preserving all key findings, data points, and decisions. Begin with "[MX-4 ARCHIVE] ".\n\n${text}`,
    maxOutputTokens: 400,
  })

  const ids = toCompress.map(r => r.id)
  db.prepare(`DELETE FROM mx4_chat_messages WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids)
  db.prepare('INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)').run(
    sessionId, 'assistant', compressed, null
  )
}

const mx4Router = Router()

// In-flight guard so rapid Home-refresh taps / double POSTs can't stack
// concurrent orchestrator runs and rack up AI spend (OPS-M2).
let orchestratorRunning = false

// Last categorized failure per section, surfaced via GET /run/:section/status
// so the client can show a toast instead of the fire-and-forget run failing silently.
const sectionRunErrors: Record<string, string | null> = {}

mx4Router.post('/run', (_req, res) => {
  if (orchestratorRunning) {
    res.status(409).json({ ok: false, error: 'A run is already in progress' })
    return
  }
  orchestratorRunning = true
  res.status(202).json({ ok: true })
  setImmediate(async () => {
    try {
      await runOrchestrator()
    } catch (err) {
      console.error('[mx4] manual run error:', err)
    } finally {
      orchestratorRunning = false
    }
  })
})

const VALID_RUN_SECTIONS = SECTIONS.map(s => s.id)

mx4Router.post('/run/:section', (req, res) => {
  const { section } = req.params
  if (!VALID_RUN_SECTIONS.includes(section)) {
    res.status(404).json({ error: `Unknown section: ${section}` })
    return
  }
  if (orchestratorRunning) {
    res.status(409).json({ ok: false, error: 'A run is already in progress' })
    return
  }
  orchestratorRunning = true
  sectionRunErrors[section] = null
  res.status(202).json({ ok: true })
  setImmediate(async () => {
    try {
      const homeRerunMode = getSetting('mx4_home_rerun_mode') ?? 'home_only'
      if (section === 'home' && homeRerunMode === 'all_sections') {
        await runOrchestrator()
      } else {
        await runSectionById(section)
      }
    } catch (err) {
      console.error(`[mx4] section run error (${section}):`, err)
      sectionRunErrors[section] = categorizeError(err)
    } finally {
      orchestratorRunning = false
    }
  })
})

// GET /api/mx4/run/:section/status — last categorized failure for a section's most
// recent run, if any. Lets the client surface a toast for the fire-and-forget /run/:section.
mx4Router.get('/run/:section/status', (req, res) => {
  const { section } = req.params
  res.json({ error: sectionRunErrors[section] ?? null })
})

mx4Router.get('/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const rows = db.prepare(
    `SELECT role, content, section, created_at FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at ASC`
  ).all(sessionId) as { role: string; content: string; section: string | null; created_at: string }[]
  res.json(rows.map(r => ({
    role: r.role,
    content: r.content,
    ...(r.section != null ? { section: r.section } : {}),
    created_at: r.created_at,
  })))
})

mx4Router.delete('/chat', (_req, res) => {
  db.prepare('DELETE FROM mx4_chat_messages').run()
  res.json({ ok: true })
})

mx4Router.delete('/wiki/patterns', (_req, res) => {
  try {
    resetWikiPatternPages()
    res.json({ ok: true })
  } catch (e: unknown) {
    console.error('[mx4] wiki/patterns reset failed:', e)
    res.status(500).json({ error: 'Failed to reset wiki pattern pages' })
  }
})

mx4Router.delete('/wiki/all', (_req, res) => {
  try {
    resetAllWikiPages()
    res.json({ ok: true })
  } catch (e: unknown) {
    console.error('[mx4] wiki/all reset failed:', e)
    res.status(500).json({ error: 'Failed to reset wiki' })
  }
})

mx4Router.post('/chat/seed', (req, res) => {
  const { sessionId, content, section } = req.body as { sessionId?: string; content?: string; section?: string }
  if (typeof sessionId !== 'string' || !sessionId.trim() || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'sessionId and content required' })
    return
  }
  db.prepare(
    'INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)'
  ).run(sessionId.trim(), 'assistant', content.trim(), section ?? null)
  res.json({ ok: true })
})

// On a failed/empty turn, the user's message was already persisted but no assistant
// reply follows it. Left in place, the next request's history would end on two
// consecutive user turns — malformed input to the AI provider that reproduces this
// failure on every later turn in the session. Removing the orphaned row lets the
// user simply retry with clean history instead.
function removeOrphanedUserTurn(rowId: number | bigint): void {
  try {
    db.prepare('DELETE FROM mx4_chat_messages WHERE id = ?').run(rowId)
  } catch (e: unknown) {
    console.error('[mx4] failed to remove orphaned user turn:', e)
  }
}

// Own source ('mx4-chat', not 'mx4') so frequent chat-failure logging can't crowd
// the nightly orchestrator's low-volume 'mx4' history out of the default Logs view.
function logChatFailure(message: string): void {
  try {
    logEvent('mx4-chat', 'error', message)
  } catch (logErr: unknown) {
    console.error('[mx4] failed to log chat failure:', logErr)
  }
}

mx4Router.post('/chat', async (req, res) => {
  const { message, sessionId, section } = req.body as { message?: string; sessionId?: string; section?: string }

  if (typeof message !== 'string' || !message.trim() || typeof sessionId !== 'string' || !sessionId) {
    res.status(400).json({ error: 'message and sessionId required' })
    return
  }

  const userMessage = db.prepare(
    'INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)'
  ).run(sessionId, 'user', message.trim(), section ?? null)

  // Compress if needed before building context
  try {
    await compressSessionIfNeeded(sessionId)
  } catch {
    // Non-fatal — proceed without compression
  }

  const history = loadChatHistory(sessionId)
  const wikiContext = readAllWikiPagesSync()
  const heartbeat = loadHeartbeat()
  const systemBase = loadSystemPrompt()
  // Chat is where MX-4 curates his wiki (writeWikiPage / SYNC WIKI), so include
  // the wiki-curation standard here.
  const system = assembleSystemPrompt(systemBase, heartbeat, wikiContext, true)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const vaultTools = isVaultEnabled()
      ? await getVaultTools().catch((vaultErr: unknown) => {
          console.error('[mx4] vault tools unavailable:', vaultErr)
          logChatFailure(`Vault tools unavailable (session ${sessionId}): ${errorDetail(vaultErr)}`)
          return {}
        })
      : {}
    const result = streamText({
      model: getModel('chat'),
      system,
      messages: [...history, { role: 'user' as const, content: message.trim() }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: { queryDb, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage, research, ...vaultTools } as any,
      stopWhen: stepCountIs(8),
    })

    let fullText = ''
    for await (const part of result.fullStream) {
      if (part.type === 'tool-call') {
        const label = toolLabel(part.toolName, part.input as Record<string, unknown>)
        res.write(`data: ${JSON.stringify({ tool: label })}\n\n`)
      } else if (part.type === 'text-delta') {
        res.write(`data: ${JSON.stringify(part.text)}\n\n`)
        fullText += part.text
      }
    }

    if (fullText) {
      db.prepare(
        'INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)'
      ).run(sessionId, 'assistant', fullText, section ?? null)
    } else {
      logChatFailure(`Chat turn produced no response (session ${sessionId})`)
      removeOrphanedUserTurn(userMessage.lastInsertRowid)
      res.write(`data: ${JSON.stringify({ error: categorizeError(new Error('no response')) })}\n\n`)
    }
  } catch (e: unknown) {
    console.error('[mx4] chat stream error:', e)
    const categorized = categorizeError(e)
    logChatFailure(`Chat turn threw (session ${sessionId}): ${categorized}`)
    removeOrphanedUserTurn(userMessage.lastInsertRowid)
    res.write(`data: ${JSON.stringify({ error: categorized })}\n\n`)
  }

  res.write('data: [DONE]\n\n')
  res.end()
})

export default mx4Router
