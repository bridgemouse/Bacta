import type { ModelMessage } from 'ai'
import db from '../../db/client'

export function loadChatHistory(sessionId: string): ModelMessage[] {
  const rows = db.prepare(
    `SELECT role, content FROM mx4_chat_messages WHERE session_id = ? ORDER BY created_at ASC`
  ).all(sessionId) as { role: string; content: string }[]

  return rows.map(r => ({
    role: r.role as 'user' | 'assistant',
    content: r.content,
  }))
}
