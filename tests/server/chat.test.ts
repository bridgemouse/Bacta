import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('loadChatHistory', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('returns empty array for unknown session', async () => {
    const { loadChatHistory } = await import('../../server/lib/ai/chat')
    expect(loadChatHistory('no-such-session')).toEqual([])
  })

  it('returns messages for a session in insertion order', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare('INSERT INTO mx4_chat_messages (session_id, role, content) VALUES (?, ?, ?)').run('s1', 'user', 'hello')
    db.prepare('INSERT INTO mx4_chat_messages (session_id, role, content) VALUES (?, ?, ?)').run('s1', 'assistant', 'hi')

    const { loadChatHistory } = await import('../../server/lib/ai/chat')
    const result = loadChatHistory('s1')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ role: 'user', content: 'hello' })
    expect(result[1]).toEqual({ role: 'assistant', content: 'hi' })
  })

  it('excludes messages from other sessions', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare('INSERT INTO mx4_chat_messages (session_id, role, content) VALUES (?, ?, ?)').run('other', 'user', 'other msg')
    db.prepare('INSERT INTO mx4_chat_messages (session_id, role, content) VALUES (?, ?, ?)').run('s2', 'user', 'my msg')

    const { loadChatHistory } = await import('../../server/lib/ai/chat')
    const result = loadChatHistory('s2')
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('my msg')
  })
})
