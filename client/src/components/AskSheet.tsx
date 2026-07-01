import { useRef, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { COLORS, FONT_MONO, FONT_UI, SECTION_ACCENTS, MX4_COLOR } from '../theme'
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


interface AskSheetProps {
  open:    boolean
  onClose: () => void
  accent:  string
  section: string
}

function msgAccent(section?: string): string {
  if (!section) return MX4_COLOR
  return (SECTION_ACCENTS as Record<string, string>)[section] ?? MX4_COLOR
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

function chunkSkills<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function handleCarouselScroll(e: React.UIEvent<HTMLDivElement>, setPage: (n: number) => void) {
  const el = e.currentTarget
  const page = Math.round(el.scrollLeft / el.clientWidth)
  setPage(page)
}

export function AskSheet({ open, onClose, accent, section }: AskSheetProps) {
  const { messages, input, setInput, streaming, toolCalls, submit, loadMessages, clearVisualHistory } = useChat(section)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [skills, setSkills] = useState<Array<{ label: string; prompt: string }>>([])
  const [activePage, setActivePage] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (open) {
      loadMessages()
      fetch('/api/settings/custom-skills')
        .then(r => r.json())
        .then((d: { skills: Array<{ label: string; prompt: string }> }) => setSkills(d.skills ?? []))
        .catch(() => {})
      if (textareaRef.current) autoResize(textareaRef.current)
      const t = setTimeout(() => textareaRef.current?.focus(), 400)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current)
  }, [input])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const showSuggested = messages.length === 0

  const clearViewButton = messages.length > 0 ? (
    <button
      onClick={clearVisualHistory}
      style={{
        background: 'none',
        border: 'none',
        padding: '4px 6px',
        cursor: 'pointer',
        fontFamily: FONT_MONO,
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: COLORS.textMuted,
        flexShrink: 0,
      }}
    >
      CLEAR VIEW ›
    </button>
  ) : undefined

  return (
    <Sheet open={open} onClose={onClose} maxHeight="88%">
      <SheetShell accent={accent} onClose={onClose}>
        <SheetHeader
          accent={accent}
          title="MX-4"
          sub="ASK ANYTHING · MEDICAL & PROTOCOL"
          sigil={<MX4Sigil color={accent} size={30} spin glow mood={streaming ? 'think' : 'transmit'} />}
          onClose={onClose}
          actions={clearViewButton}
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
          {/* Static greeting */}
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
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: COLORS.text, fontFamily: FONT_MONO }}>
                Standing by, Commander. Ask me about any system, or I can walk your latest readouts. What do you need?
              </p>
            </div>
          </div>

          {/* Conversation history */}
          {messages.map((msg, i) => {
            const color = msgAccent(msg.section)
            return msg.role === 'user' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    background: hexA(color, 0.15),
                    border: `1px solid ${hexA(color, 0.3)}`,
                    borderRadius: '14px 4px 14px 14px',
                    padding: '10px 14px',
                    maxWidth: '80%',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: COLORS.text, fontFamily: FONT_MONO }}>
                    {msg.content}
                  </p>
                </div>
              </div>
            ) : (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MX4Sigil
                    color={color}
                    size={18}
                    mood={streaming && i === messages.length - 1 ? 'think' : 'pleased'}
                  />
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: hexA(color, 0.6) }}>MX-4</span>
                </div>
                <div
                  style={{
                    borderLeft: `2px solid ${hexA(color, 0.25)}`,
                    paddingLeft: 12,
                    minWidth: 0,
                  }}
                >
                  {streaming && i === messages.length - 1 && toolCalls.length > 0 && (
                    <div style={{ marginBottom: msg.content ? 10 : 0 }}>
                      {toolCalls.map((label, ti) => {
                        const isActive = ti === toolCalls.length - 1
                        return (
                          <div
                            key={ti}
                            style={{
                              fontFamily: FONT_MONO,
                              fontSize: 9,
                              letterSpacing: '0.1em',
                              color: isActive ? hexA(color, 0.75) : COLORS.textMuted,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap' as const,
                              textOverflow: 'ellipsis',
                              marginBottom: 3,
                            }}
                          >
                            {isActive ? (
                              <span
                                aria-hidden
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: '50%',
                                  background: color,
                                  flexShrink: 0,
                                  display: 'inline-block',
                                  animation: 'mx4blink 1.1s step-end infinite',
                                }}
                              />
                            ) : (
                              <span style={{ width: 5, flexShrink: 0, color: COLORS.textMuted }}>·</span>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p style={{ margin: '0 0 6px 0', fontSize: 13, lineHeight: 1.6, color: COLORS.text, fontFamily: FONT_MONO }}>
                          {children}
                        </p>
                      ),
                      strong: ({ children }) => (
                        <strong style={{ color, fontWeight: 600 }}>{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em style={{ color: COLORS.textSecondary, fontStyle: 'italic' }}>{children}</em>
                      ),
                      ul: ({ children }) => (
                        <ul style={{ margin: '0 0 6px 0', paddingLeft: 16 }}>{children}</ul>
                      ),
                      li: ({ children }) => (
                        <li style={{ fontFamily: FONT_MONO, fontSize: 13, lineHeight: 1.6, color: COLORS.text, marginBottom: 2 }}>{children}</li>
                      ),
                      h2: ({ children }) => (
                        <h2 style={{ margin: '10px 0 4px', fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color, textTransform: 'uppercase' as const }}>
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 style={{ margin: '8px 0 3px', fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em', color: COLORS.textSecondary, textTransform: 'uppercase' as const }}>
                          {children}
                        </h3>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {streaming && i === messages.length - 1 && (
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-block',
                        width: 6,
                        height: 14,
                        background: color,
                        marginLeft: 3,
                        verticalAlign: 'middle',
                        animation: 'mx4blink 1.1s step-end infinite',
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {/* Suggested prompts */}
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
              {skills.length > 0 && (() => {
                const pages = chunkSkills(skills, 3)
                const totalPages = pages.length
                return (
                  <>
                    <div
                      ref={carouselRef}
                      data-testid="skill-carousel"
                      onScroll={e => handleCarouselScroll(e, setActivePage)}
                      style={{
                        display: 'flex',
                        overflowX: 'auto',
                        scrollSnapType: 'x mandatory',
                        scrollbarWidth: 'none',
                        WebkitOverflowScrolling: 'touch',
                        paddingBottom: totalPages > 1 ? 4 : 8,
                      } as React.CSSProperties}
                    >
                      {pages.map((page, pi) => (
                        <div
                          key={pi}
                          style={{
                            flex: '0 0 100%',
                            scrollSnapAlign: 'start',
                            display: 'flex',
                            gap: 8,
                          }}
                        >
                          {page.map(skill => (
                            <span
                              key={skill.label}
                              data-testid="skill-pill"
                              onClick={() => submit(skill.prompt)}
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
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {skill.label} ›
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingBottom: 8 }}>
                        {pages.map((_, pi) => (
                          <div
                            key={pi}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: pi === activePage ? MX4_COLOR : COLORS.line,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
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
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message MX-4"
            style={{
              flex: 1,
              background: COLORS.surface,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 11,
              padding: '10px 13px',
              fontFamily: FONT_UI,
              fontSize: 16,
              color: COLORS.text,
              resize: 'none',
              outline: 'none',
              lineHeight: 1.4,
              minHeight: 40,
              maxHeight: 120,
              overflowY: 'auto',
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
