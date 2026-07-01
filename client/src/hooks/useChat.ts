import { useState, useEffect, useRef } from 'react'
import { getChatSessionId } from '../lib/chatSession'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  section?: string
  created_at?: string
}

export function useChat(section?: string) {
  const sessionId = getChatSessionId()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [toolCalls, setToolCalls] = useState<string[]>([])
  const [hiddenBefore, setHiddenBefore] = useState<string | null>(null)
  const hiddenBeforeRef = useRef<string | null>(null)
  const hasTextRef = useRef(false)
  const toolClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function loadMessages() {
    fetch(`/api/mx4/chat/${sessionId}`)
      .then(r => r.ok ? r.json() : [])
      .then((msgs: ChatMessage[]) => {
        if (!Array.isArray(msgs)) return
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
    hasTextRef.current = false
    if (toolClearTimerRef.current) clearTimeout(toolClearTimerRef.current)
    setToolCalls([])
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
            const parsed: string | { error: string } | { tool: string } = JSON.parse(data)
            if (typeof parsed === 'string') {
              if (!hasTextRef.current) {
                hasTextRef.current = true
                toolClearTimerRef.current = setTimeout(() => setToolCalls([]), 800)
              }
              setMessages(prev => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (!last) return prev
                next[next.length - 1] = {
                  role: 'assistant',
                  content: (last.content ?? '') + parsed,
                  section,
                }
                return next
              })
            } else if (typeof parsed === 'object' && 'tool' in parsed) {
              setToolCalls(prev => [...prev.slice(-2), parsed.tool])
            } else if (typeof parsed === 'object' && 'error' in parsed) {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  role: 'assistant',
                  content: (parsed as { error: string }).error,
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
          content: 'Connection lost during analysis. MX-4 may have completed — try sending another message.',
          section,
        }
        return next
      })
    } finally {
      setStreaming(false)
      setToolCalls([])
    }
  }

  return { messages, input, setInput, streaming, toolCalls, submit, sessionId, loadMessages, clearVisualHistory, hiddenBefore }
}
