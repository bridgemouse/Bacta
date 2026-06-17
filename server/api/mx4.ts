import { Router } from 'express'
import { streamText, stepCountIs } from 'ai'
import { runOrchestrator, runSectionById, loadSystemPrompt } from '../lib/ai/orchestrator'
import { assembleSystemPrompt } from '../lib/ai/prompt'
import { loadChatHistory } from '../lib/ai/chat'
import { getModel } from '../lib/ai/provider'
import { readAllWikiPagesSync, loadHeartbeat, resetWikiPatternPages, resetAllWikiPages } from '../lib/ai/wiki'
import { queryDb, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage } from '../lib/ai/tools'
import { research } from '../lib/ai/research'
import { getVaultTools } from '../lib/ai/vaultClient'
import { getSetting } from '../lib/settings'
import db from '../db/client'

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

const VALID_RUN_SECTIONS = ['recovery', 'sleep', 'training', 'home']

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
    } finally {
      orchestratorRunning = false
    }
  })
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

mx4Router.post('/chat', async (req, res) => {
  const { message, sessionId, section } = req.body as { message?: string; sessionId?: string; section?: string }

  if (typeof message !== 'string' || !message.trim() || typeof sessionId !== 'string' || !sessionId) {
    res.status(400).json({ error: 'message and sessionId required' })
    return
  }

  db.prepare(
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
  const system = assembleSystemPrompt(systemBase, heartbeat, wikiContext)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const result = streamText({
      model: getModel('chat'),
      system,
      messages: [...history, { role: 'user' as const, content: message.trim() }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: { queryDb, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage, research, ...await getVaultTools() } as any,
      stopWhen: stepCountIs(8),
    })

    let fullText = ''
    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      fullText += chunk
    }

    if (fullText) {
      db.prepare(
        'INSERT INTO mx4_chat_messages (session_id, role, content, section) VALUES (?, ?, ?, ?)'
      ).run(sessionId, 'assistant', fullText, section ?? null)
    } else {
      res.write(`data: ${JSON.stringify({ error: 'no response — check AI provider settings' })}\n\n`)
    }
  } catch (e: unknown) {
    console.error('[mx4] chat stream error:', e)
    res.write(`data: ${JSON.stringify({ error: 'MX-4 is unavailable — check AI provider settings.' })}\n\n`)
  }

  res.write('data: [DONE]\n\n')
  res.end()
})

export default mx4Router
