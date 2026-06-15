import { useState, useEffect, useRef } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  section?: string
  created_at?: string
}

export function useChat(section?: string) {
  const sessionId = `chat-${new Date().toISOString().slice(0, 10)}`
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [hiddenBefore, setHiddenBefore] = useState<string | null>(null)
  const hiddenBeforeRef = useRef<string | null>(null)

  function loadMessages() {
    fetch(`/api/mx4/chat/${sessionId}`)
      .then(r => r.json())
      .then((msgs: ChatMessage[]) => {
        const cutoff = hiddenBeforeRef.current
        setMessages(cutoff
          ? msgs.filter(m => (m.created_at ?? '') > cutoff)
          : msgs)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadMessages()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  function clearVisualHistory() {
    const now = new Date().toISOString()
    hiddenBeforeRef.current = now
    setHiddenBefore(now)
    setMessages(prev => prev.filter(m => (m.created_at ?? '') > now))
  }

  async function submit(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || streaming) return

    if (!overrideText) setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, section }])
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', section }])

    try {
      const res = await fetch('/api/mx4/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, section }),
      })

      if (!res.ok || !res.body) throw new Error('stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed: string | { error: string } = JSON.parse(data)
            if (typeof parsed === 'string') {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  role: 'assistant',
                  content: next[next.length - 1].content + parsed,
                  section,
                }
                return next
              })
            } else if (typeof parsed === 'object' && parsed.error) {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  role: 'assistant',
                  content: 'MX-4 is offline. Configure an AI provider in Settings.',
                  section,
                }
                return next
              })
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: 'MX-4 is offline. Configure an AI provider in Settings.',
          section,
        }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  return { messages, input, setInput, streaming, submit, sessionId, loadMessages, clearVisualHistory, hiddenBefore }
}
