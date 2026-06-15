import { useRef, useEffect } from 'react'
import { COLORS, FONT_MONO, FONT_UI } from '../theme'
import { Sheet, SheetShell, SheetHeader } from './Sheet'
import { MX4Sigil } from './primitives/MX4Sigil'
import { hexA } from '../lib/hexA'
import { useChat } from '../hooks/useChat'

const SUGGESTED_PROMPTS = [
  'How is my recovery trending?',
  "Plan today's training",
  'Why is my HRV up?',
  'Summarize my week',
]

const WIKI_PROMPT = 'Review your wiki pages and update them based on our conversation so far. Write any new patterns or findings worth preserving.'

interface AskSheetProps {
  open: boolean
  onClose: () => void
  accent: string
}

export function AskSheet({ open, onClose, accent }: AskSheetProps) {
  const { messages, input, setInput, streaming, submit, loadMessages } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (open) {
      loadMessages()
      const t = setTimeout(() => textareaRef.current?.focus(), 400)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const showSuggested = messages.length === 0

  return (
    <Sheet open={open} onClose={onClose} maxHeight="88%">
      <SheetShell accent={accent}>
        <SheetHeader
          accent={accent}
          title="MX-4"
          sub="ASK ANYTHING · MEDICAL & PROTOCOL"
          sigil={<MX4Sigil color={accent} size={30} spin glow mood={streaming ? 'think' : 'transmit'} />}
          onClose={onClose}
        />

        {/* Scrollable message area */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            padding: '4px 18px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Static greeting — not stored in DB, not sent to model */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}>
              <MX4Sigil color={accent} size={26} mood="pleased" />
            </span>
            <div
              style={{
                background: hexA(accent, 0.08),
                border: `1px solid ${hexA(accent, 0.22)}`,
                borderRadius: '4px 14px 14px 14px',
                padding: '11px 14px',
                maxWidth: '85%',
              }}
            >
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#eef4fb', fontFamily: FONT_UI }}>
                Standing by, Commander. Ask me about any system, or I can walk your latest readouts. What do you need?
              </p>
            </div>
          </div>

          {/* Conversation history */}
          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    background: hexA(accent, 0.15),
                    border: `1px solid ${hexA(accent, 0.3)}`,
                    borderRadius: '14px 4px 14px 14px',
                    padding: '10px 14px',
                    maxWidth: '80%',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#eef4fb', fontFamily: FONT_UI }}>
                    {msg.content}
                  </p>
                </div>
              </div>
            ) : (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>
                  <MX4Sigil
                    color={accent}
                    size={26}
                    mood={streaming && i === messages.length - 1 ? 'think' : 'pleased'}
                  />
                </span>
                <div
                  style={{
                    background: hexA(accent, 0.08),
                    border: `1px solid ${hexA(accent, 0.22)}`,
                    borderRadius: '4px 14px 14px 14px',
                    padding: '11px 14px',
                    maxWidth: '85%',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#eef4fb', fontFamily: FONT_UI }}>
                    {msg.content}
                    {streaming && i === messages.length - 1 && (
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-block',
                          width: 6,
                          height: 14,
                          background: accent,
                          marginLeft: 3,
                          verticalAlign: 'middle',
                          animation: 'mx4blink 1.1s step-end infinite',
                        }}
                      />
                    )}
                  </p>
                </div>
              </div>
            )
          )}

          {/* Suggested prompts — visible only before first message */}
          {showSuggested && (
            <>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  letterSpacing: '0.16em',
                  color: COLORS.textMuted,
                  marginTop: 4,
                }}
              >
                SUGGESTED
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 4 }}>
                {SUGGESTED_PROMPTS.map(prompt => (
                  <span
                    key={prompt}
                    onClick={() => submit(prompt)}
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: 12.5,
                      color: COLORS.textSecondary,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.line}`,
                      borderRadius: 18,
                      padding: '8px 13px',
                      cursor: 'pointer',
                    }}
                  >
                    {prompt}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', paddingBottom: 8 }}>
                <span
                  onClick={() => submit(WIKI_PROMPT)}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color: accent,
                    background: hexA(accent, 0.08),
                    border: `1px solid ${hexA(accent, 0.25)}`,
                    borderRadius: 18,
                    padding: '6px 12px',
                    cursor: 'pointer',
                  }}
                >
                  SYNC WIKI ›
                </span>
              </div>
            </>
          )}
        </div>

        {/* Input bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 9,
            padding: '12px 16px 28px',
            borderTop: `1px solid ${COLORS.line}`,
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message MX-4"
            rows={1}
            style={{
              flex: 1,
              background: COLORS.surface,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 11,
              padding: '11px 13px',
              fontFamily: FONT_MONO,
              fontSize: 12.5,
              color: COLORS.text,
              letterSpacing: '0.02em',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={() => submit()}
            disabled={streaming || !input.trim()}
            aria-label="Send"
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 11,
              border: `1px solid ${hexA(accent, streaming || !input.trim() ? 0.2 : 0.5)}`,
              background: hexA(accent, streaming || !input.trim() ? 0.05 : 0.14),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: streaming || !input.trim() ? 'default' : 'pointer',
              padding: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" y1="18" x2="18" y2="6" />
              <polyline points="9,6 18,6 18,15" />
            </svg>
          </button>
        </div>
      </SheetShell>
    </Sheet>
  )
}
