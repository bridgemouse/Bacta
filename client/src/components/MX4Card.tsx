// All imports at top
import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { MX4Sigil } from './primitives/MX4Sigil'
import type { MX4Mood } from './primitives/MX4Sigil'
import { FTelemetry } from './primitives/FTelemetry'
import { StatusCore } from './primitives/StatusCore'
import { hexA } from '../lib/hexA'
import { COLORS, FONT_MONO, FONT_UI, toneColor } from '../theme'
import type { Brief } from '../lib/stubData'
import type { BriefingResult } from '../lib/briefing'
import { useAskSheet } from '../lib/AskSheetContext'
import { useToast } from '../lib/ToastContext'
import { getChatSessionId } from '../lib/chatSession'

// ─── New API ─────────────────────────────────────────────────────
interface TransmissionPanelProps {
  accent: string
  mood?: MX4Mood
  label?: string
  meta?: string
  assessment: string
  chips?: [string, string][]
}

const DEFAULT_CHIPS: [string, string][] = [
  ['TONE', 'POSITIVE'],
  ['FLAGS', '0'],
  ['SYNC', 'OK'],
]

// ─── MX4Briefing — section accent card with verdict badge ────────────────────
interface MX4BriefingProps {
  accent:      string
  brief:       Brief
  liveData?:   BriefingResult
  section?:    string
  onRefresh?:  () => void
}

const SECTION_LABELS: Record<string, string> = {
  home:     'HOME',
  recovery: 'RECOVERY',
  sleep:    'SLEEP',
  training: 'TRAINING',
}

export function MX4Briefing({ accent, brief, liveData, section, onRefresh }: MX4BriefingProps) {
  const rawTone    = liveData ? liveData.tone.toLowerCase() as 'positive' | 'caution' | 'flag' : brief.tone
  const activeMood: MX4Mood = liveData
    ? (liveData.tone === 'POSITIVE' ? 'pleased' : 'alert')
    : brief.mood
  const activeMeta = liveData?.generated_at
    ? (() => {
        const d = new Date(liveData.generated_at)
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
      })()
    : brief.meta

  const tc = toneColor(rawTone)
  const verdictLabel = rawTone === 'flag' ? 'FLAG' : rawTone === 'caution' ? 'CAUTION' : 'POSITIVE'

  const flags = liveData?.flags ?? []

  const { openAskSheet } = useAskSheet()
  const { showToast } = useToast()

  const [refreshState, setRefreshState] = useState<'idle' | 'running' | 'error'>('idle')
  const [refreshProgress, setRefreshProgress] = useState<number | null>(null)
  const errorResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (errorResetRef.current) clearTimeout(errorResetRef.current)
  }, [])

  // Fades the body in the moment live data replaces the stub line — covers
  // Home's own first load (nothing can be prefetched before it) and acts as a
  // safety net elsewhere if a section's prefetch hasn't resolved yet.
  const hasLiveData = liveData != null
  const wasLiveDataRef = useRef(hasLiveData)
  const [bodyAnimKey, setBodyAnimKey] = useState(0)
  useEffect(() => {
    if (wasLiveDataRef.current !== hasLiveData) {
      wasLiveDataRef.current = hasLiveData
      setBodyAnimKey(k => k + 1)
    }
  }, [hasLiveData])

  // Refresh-all ("mx4_home_rerun_mode" = all_sections) runs recovery -> sleep -> training -> home
  // in that fixed order (see server/lib/ai/sections.ts SECTIONS) — home is always last, so once
  // recovery/sleep/training are all done, only home's own briefing remains.
  const REFRESH_ALL_STAGES = ['recovery', 'sleep', 'training', 'home']

  // Shared by handleRefresh (after triggering a new run) and the on-mount resume
  // effect (after finding one already in flight) — polls until the section's own
  // briefing timestamp advances, updating staged progress for refresh-all runs.
  async function pollForCompletion(isFullRun: boolean) {
    let succeeded = false
    try {
      const trackedSections = isFullRun ? REFRESH_ALL_STAGES : [section as string]
      const fetchGeneratedAt = async (s: string) => {
        const res = await fetch(`/api/insights/${s}`)
        const d = await res.json() as { generated_at?: string }
        return d.generated_at
      }

      // Fetch current API state as baseline — liveData prop may be null or stale
      const baseline: Record<string, string | undefined> = {}
      await Promise.all(trackedSections.map(async s => { baseline[s] = await fetchGeneratedAt(s) }))

      let attempts = 0
      while (attempts < 24) {
        await new Promise(r => setTimeout(r, 10_000))
        const current: Record<string, string | undefined> = {}
        await Promise.all(trackedSections.map(async s => { current[s] = await fetchGeneratedAt(s) }))

        if (isFullRun) {
          const doneCount = trackedSections.filter(s => current[s] !== baseline[s]).length
          setRefreshProgress(Math.round((doneCount / trackedSections.length) * 100))
        }

        if (current[section as string] !== baseline[section as string]) {
          onRefresh?.()
          succeeded = true
          break
        }
        try {
          const statusRes = await fetch(`/api/mx4/run/${section}/status`)
          const statusData = await statusRes.json() as { error: string | null }
          if (statusData.error) {
            showToast(statusData.error, 'error')
            break
          }
        } catch {
          // ignore status-check failures — fall through to the next poll attempt
        }
        attempts++
      }
    } catch {
      // handled by succeeded flag below
    } finally {
      setRefreshState(succeeded ? 'idle' : 'error')
      setRefreshProgress(null)
      if (!succeeded) {
        errorResetRef.current = setTimeout(() => setRefreshState('idle'), 4000)
      }
    }
  }

  async function detectFullRun(): Promise<boolean> {
    if (section !== 'home') return false
    try {
      const settingsRes = await fetch('/api/settings')
      const settings = await settingsRes.json() as Record<string, string>
      return settings.mx4_home_rerun_mode === 'all_sections'
    } catch {
      // treat as home-only regeneration if the settings fetch fails
      return false
    }
  }

  async function handleRefresh() {
    if (!section || refreshState === 'running') return
    if (errorResetRef.current) {
      clearTimeout(errorResetRef.current)
      errorResetRef.current = null
    }
    setRefreshState('running')
    setRefreshProgress(null)

    const isFullRun = await detectFullRun()

    let triggerRes: Response
    try {
      triggerRes = await fetch(`/api/mx4/run/${section}`, { method: 'POST' })
    } catch {
      setRefreshState('error')
      setRefreshProgress(null)
      errorResetRef.current = setTimeout(() => setRefreshState('idle'), 4000)
      return
    }

    if (triggerRes.status === 409) {
      // Another run (e.g. the nightly full orchestrator) is already in progress —
      // this click didn't start anything, so don't poll for it or surface a stale
      // error left over from a previous, unrelated run of this section. Not a
      // failure of this click, so don't flash the FAILED state either.
      showToast('MX-4 is already running. Try again shortly.', 'error')
      setRefreshState('idle')
      setRefreshProgress(null)
      return
    }

    await pollForCompletion(isFullRun)
  }

  // On mount (including remounting after navigating away and back), check whether
  // a refresh is genuinely still running server-side rather than always defaulting
  // to idle — the previous mount's in-flight run has no other way to reach this one (#114).
  useEffect(() => {
    if (!section) return
    let cancelled = false
    void (async () => {
      try {
        const statusRes = await fetch(`/api/mx4/run/${section}/status`)
        const statusData = await statusRes.json() as { error: string | null; running?: boolean }
        if (cancelled || !statusData.running) return
        setRefreshState('running')
        setRefreshProgress(null)
        const isFullRun = await detectFullRun()
        if (cancelled) return
        await pollForCompletion(isFullRun)
      } catch {
        // ignore — stay idle if the status check itself fails
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  async function handleFullAnalysis() {
    if (!liveData?.body) return
    // Computed at click time so it matches useChat's sessionId when AskSheet re-renders on open.
    // Computing at render time causes a mismatch after UTC midnight if MX4Card hasn't re-rendered.
    const sessionId = getChatSessionId()
    // Normalize literal \N sequences the model occasionally emits instead of real newlines,
    // then ensure ## headers always start on their own line
    const body = liveData.body
      .replace(/\\N/g, '\n')
      .replace(/([^\n])(##\s)/g, '$1\n\n$2')
      .trim()
    // If the ## DIRECTIVE section has no content (orchestrator prompt artifact),
    // inject the recommendation field as fallback directive body
    const directiveEmpty = /##\s*DIRECTIVE\s*$/.test(body)
    const seededContent = directiveEmpty && liveData.recommendation
      ? `${body}\n${liveData.recommendation}`
      : body
    try {
      await fetch('/api/mx4/chat/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content: seededContent, section }),
      })
    } catch {
      // Non-fatal — open AskSheet anyway
    }
    openAskSheet()
  }

  return (
    <>
    <div
      style={{
        position: 'relative',
        background: `linear-gradient(160deg, ${hexA(accent, 0.10)}, ${COLORS.surface} 55%)`,
        border: `1px solid ${hexA(accent, 0.35)}`,
        borderRadius: 14,
        boxShadow: `0 0 32px ${hexA(accent, 0.08)}`,
        marginBottom: flags.length > 0 ? 8 : 14,
        overflow: 'hidden',
      }}
    >
      {refreshProgress !== null && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: hexA(accent, 0.15) }}>
          <div
            style={{
              height: '100%',
              width: `${refreshProgress}%`,
              background: accent,
              transition: 'width 0.3s linear',
            }}
          />
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px 11px' }}>
        <MX4Sigil color={accent} size={19} spin mood={activeMood} />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: accent,
            flex: 1,
            minWidth: 0,
          }}
        >
          MX-4 // {section ? SECTION_LABELS[section] ?? section.toUpperCase() : 'INTEL'}
        </span>
        {activeMeta && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', color: COLORS.textMuted, flexShrink: 0 }}>
            {activeMeta}
          </span>
        )}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: FONT_MONO,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            padding: '3px 9px',
            borderRadius: 20,
            background: hexA(tc, 0.18),
            color: tc,
            border: `1px solid ${hexA(tc, 0.4)}`,
            flexShrink: 0,
          }}
        >
          <StatusCore accent={tc} size={5} />
          {verdictLabel}
        </span>
      </div>

      {/* Body — live markdown or stub text */}
      <div key={bodyAnimKey} data-testid="mx4-body" style={{ padding: '0 15px 13px', animation: bodyAnimKey > 0 ? 'valueFadeIn 400ms ease' : undefined }}>
        {liveData ? (
          <>
            <p style={{ margin: '0 0 7px 0', fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: accent }}>
              {liveData.headline}
            </p>
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p style={{ margin: '0 0 8px 0', fontFamily: FONT_UI, fontSize: 15, lineHeight: 1.55, color: '#eef4fb' }}>
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong style={{ color: accent, fontWeight: 600 }}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em style={{ color: COLORS.textSecondary, fontStyle: 'italic' }}>{children}</em>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: '0 0 8px 0', paddingLeft: 18 }}>{children}</ul>
                ),
                li: ({ children }) => (
                  <li style={{ fontFamily: FONT_UI, fontSize: 14, lineHeight: 1.5, color: '#eef4fb', marginBottom: 3 }}>{children}</li>
                ),
                h2: ({ children }) => (
                  <h2 style={{ margin: '10px 0 4px', fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: accent, textTransform: 'uppercase' as const }}>
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
              {liveData.summary ?? liveData.body}
            </ReactMarkdown>
            <div
              style={{
                marginTop: 8,
                padding: '7px 10px',
                background: hexA(accent, 0.07),
                borderLeft: `2px solid ${hexA(accent, 0.5)}`,
                borderRadius: '0 6px 6px 0',
              }}
            >
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: accent, fontWeight: 700 }}>DIRECTIVE · </span>
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <span style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text, lineHeight: 1.4 }}>{children}</span>
                  ),
                  strong: ({ children }) => (
                    <strong style={{ color: accent, fontWeight: 600 }}>{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em style={{ color: COLORS.textSecondary, fontStyle: 'italic' }}>{children}</em>
                  ),
                }}
              >
                {liveData.recommendation}
              </ReactMarkdown>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 16, lineHeight: 1.55, color: '#eef4fb' }}>
            {brief.line}
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 7,
                height: '0.9em',
                background: accent,
                marginLeft: 3,
                verticalAlign: 'middle',
                animation: 'mx4blink 1.1s step-end infinite',
              }}
            />
          </p>
        )}
      </div>

      {/* Footer chips */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 15px 13px',
          borderTop: `1px solid ${hexA(accent, 0.18)}`,
        }}
      >
        {!liveData && brief.chips.map(([key, val]) => (
          <span key={key} style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
            {key}{' '}
            <span style={{ color: accent }}>{val}</span>
          </span>
        ))}
        {liveData?.summary && (
          <button
            onClick={handleFullAnalysis}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: FONT_MONO,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: accent,
              flexShrink: 0,
            }}
          >
            FULL ANALYSIS ›
          </button>
        )}
        {section && (
          <button
            onClick={handleRefresh}
            disabled={refreshState === 'running'}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: refreshState === 'running' ? 'default' : 'pointer',
              fontFamily: FONT_MONO,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: refreshState === 'running' ? COLORS.textMuted : refreshState === 'error' ? COLORS.mx4Red : accent,
              flexShrink: 0,
            }}
          >
            {refreshState === 'running'
              ? (refreshProgress !== null ? `RUNNING · ${refreshProgress}% ›` : 'RUNNING ›')
              : refreshState === 'error' ? 'FAILED ›' : 'REFRESH ›'}
          </button>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <FTelemetry color={accent} bars={4} />
        </span>
      </div>
    </div>

    {flags.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {flags.map((flag, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: FONT_MONO,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              padding: '3px 9px',
              borderRadius: 20,
              background: hexA(tc, 0.12),
              color: tc,
              border: `1px solid ${hexA(tc, 0.3)}`,
            }}
          >
            <StatusCore accent={tc} size={5} />
            {flag}
          </span>
        ))}
      </div>
    )}
    </>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export function TransmissionPanel({
  accent,
  mood = 'transmit',
  label = 'INCOMING // MX-4',
  meta,
  assessment,
  chips = DEFAULT_CHIPS,
}: TransmissionPanelProps) {
  return (
    <div
      style={{
        position: 'relative',
        background: `linear-gradient(160deg, ${hexA(accent, 0.10)}, ${COLORS.surface} 50%)`,
        border: `1px solid ${hexA(accent, 0.35)}`,
        borderRadius: 14,
        boxShadow: `0 0 32px ${hexA(accent, 0.08)}`,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px 11px' }}>
        <MX4Sigil color={accent} size={19} spin mood={mood} />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: accent,
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </span>
        {meta && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 8.5,
              letterSpacing: '0.08em',
              color: COLORS.textMuted,
              flexShrink: 0,
            }}
          >
            {meta}
          </span>
        )}
      </div>

      <div style={{ padding: '0 15px 13px' }}>
        <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 16.5, lineHeight: 1.5, color: '#eef4fb' }}>
          {assessment}
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 7,
              height: '0.9em',
              background: accent,
              marginLeft: 3,
              verticalAlign: 'middle',
              animation: 'mx4blink 1.1s step-end infinite',
            }}
          />
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 15px 13px',
          borderTop: `1px solid ${hexA(accent, 0.18)}`,
        }}
      >
        {chips.map(([key, val]) => (
          <span key={key} style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted }}>
            {key}{' '}
            <span style={{ color: accent }}>{val}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          <FTelemetry color={accent} bars={4} />
        </span>
      </div>
    </div>
  )
}
