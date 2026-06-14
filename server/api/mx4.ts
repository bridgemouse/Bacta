import { Router } from 'express'
import { streamText, stepCountIs } from 'ai'
import { runOrchestrator, loadSystemPrompt } from '../lib/ai/orchestrator'
import { loadChatHistory } from '../lib/ai/chat'
import { getModel } from '../lib/ai/provider'
import { readAllWikiPagesSync, loadHeartbeat } from '../lib/ai/wiki'
import { queryDb, readVault, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage } from '../lib/ai/tools'
import db from '../db/client'

const mx4Router = Router()

mx4Router.post('/run', (_req, res) => {
  res.status(202).json({ ok: true })
  setImmediate(() => {
    runOrchestrator().catch(err => console.error('[mx4] manual run error:', err))
  })
})

mx4Router.get('/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const rows = db.prepare(
    `SELECT role, content FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at ASC`
  ).all(sessionId) as { role: string; content: string }[]
  res.json(rows.map(r => ({ role: r.role, content: r.content })))
})

mx4Router.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body as { message?: string; sessionId?: string }

  if (typeof message !== 'string' || !message.trim() || typeof sessionId !== 'string' || !sessionId) {
    res.status(400).json({ error: 'message and sessionId required' })
    return
  }

  db.prepare(
    'INSERT INTO mx4_chat_messages (session_id, role, content) VALUES (?, ?, ?)'
  ).run(sessionId, 'user', message.trim())

  const history = loadChatHistory(sessionId)
  const wikiContext = readAllWikiPagesSync()
  const heartbeat = loadHeartbeat()
  const systemBase = loadSystemPrompt()
  const system = [
    systemBase,
    heartbeat ? `\n\n## Standing Orders\n${heartbeat}` : '',
    `\n\n## Wiki Knowledge\n${wikiContext}`,
  ].join('')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const result = streamText({
      model: getModel('chat'),
      system,
      messages: [...history, { role: 'user' as const, content: message.trim() }],
      tools: { queryDb, readVault, readAllWikiPages, writeWikiPage, listWikiPages, archiveWikiPage },
      stopWhen: stepCountIs(8),
    })

    let fullText = ''
    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      fullText += chunk
    }

    if (fullText) {
      db.prepare(
        'INSERT INTO mx4_chat_messages (session_id, role, content) VALUES (?, ?, ?)'
      ).run(sessionId, 'assistant', fullText)
    } else {
      res.write(`data: ${JSON.stringify({ error: 'no response — check AI provider settings' })}\n\n`)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
  }

  res.write('data: [DONE]\n\n')
  res.end()
})

export default mx4Router
