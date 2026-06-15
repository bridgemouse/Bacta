import { useState, useEffect } from 'react'
import { AppShell } from '../components/AppShell'
import { Rail } from '../components/viz/Rail'
import { COLORS, FONT_MONO, FONT_UI, MX4_COLOR } from '../theme'
import { hexA } from '../lib/hexA'

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  google:    ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.5-flash'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8'],
  openai:    ['gpt-4o-mini', 'gpt-4o', 'o3'],
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Gemini', anthropic: 'Claude', openai: 'OpenAI',
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error'

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        position: 'relative',
        width: 42,
        height: 24,
        borderRadius: 12,
        border: `1px solid ${on ? MX4_COLOR : COLORS.line}`,
        background: on ? hexA(MX4_COLOR, 0.2) : COLORS.surfaceElevated,
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 20 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: on ? MX4_COLOR : COLORS.textMuted,
          transition: 'left 0.15s, background 0.15s',
        }}
      />
    </button>
  )
}

const cardStyle: React.CSSProperties = {
  background: COLORS.surface,
  borderRadius: 12,
  padding: '0 16px',
  marginBottom: 8,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '11px 0',
  borderBottom: `1px solid ${COLORS.line}`,
}

const rowStyleLast: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '11px 0',
}

const labelStyle: React.CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: 13.5,
  color: COLORS.textSecondary,
  flexShrink: 0,
}

const selectStyle: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 11,
  padding: '6px 10px',
  borderRadius: 8,
  border: `1px solid ${COLORS.line}`,
  background: COLORS.surfaceElevated,
  color: COLORS.text,
  cursor: 'pointer',
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyFocused, setApiKeyFocused] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings)
  }, [])

  const save = async (key: string, value: string) => {
    await fetch(`/api/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    setSettings(prev => ({ ...prev, [key]: value }))
    setSavedKey(key)
    setTimeout(() => setSavedKey(null), 1500)
  }

  const testConn = async () => {
    setTestStatus('testing')
    setTestError('')
    try {
      const res = await fetch('/api/settings/test-connection', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setTestStatus('ok')
        setTimeout(() => setTestStatus('idle'), 3000)
      } else {
        setTestStatus('error')
        setTestError(data.error ?? 'Unknown error')
      }
    } catch {
      setTestStatus('error')
      setTestError('Network error')
    }
  }

  const savedBadge = (key: string) =>
    savedKey === key ? (
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: MX4_COLOR, letterSpacing: '0.1em' }}>
        SAVED ·
      </span>
    ) : null

  const currentProvider = settings['ai_provider'] ?? 'google'
  const models = MODELS_BY_PROVIDER[currentProvider] ?? []

  const handleProviderChange = (p: string) => {
    const firstModel = (MODELS_BY_PROVIDER[p] ?? [])[0] ?? ''
    save('ai_provider', p)
    save('mx4_briefing_model', firstModel)
    save('mx4_chat_model', firstModel)
  }

  const nightlySyncOn = settings['mx4_nightly_enabled'] === 'true'
  const syncOnGarminOn = settings['mx4_on_sync_enabled'] === 'true'

  const testButtonLabel =
    testStatus === 'testing' ? 'TESTING…' :
    testStatus === 'ok'      ? '✓ OK' :
    testStatus === 'error'   ? '✗ FAIL' :
    apiKeyInput.length > 0   ? 'SAVE' : 'TEST'

  const testButtonColor =
    testStatus === 'ok'    ? COLORS.green :
    testStatus === 'error' ? COLORS.mx4Red :
    MX4_COLOR

  return (
    <AppShell section="settings">
      {/* Rail 1: AI PROVIDER */}
      <Rail label="AI PROVIDER" accent={MX4_COLOR} />

      <div style={cardStyle}>
        {/* Provider segmented control */}
        <div style={rowStyle}>
          <span style={labelStyle}>Provider</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(PROVIDER_LABELS).map(([key, label]) => {
              const active = currentProvider === key
              return (
                <button
                  key={key}
                  onClick={() => handleProviderChange(key)}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    padding: '5px 11px',
                    borderRadius: 7,
                    border: `1px solid ${active ? MX4_COLOR : COLORS.line}`,
                    background: active ? hexA(MX4_COLOR, 0.15) : COLORS.surfaceElevated,
                    color: active ? MX4_COLOR : COLORS.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* API Key input + action button */}
        <div style={rowStyleLast}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <span style={labelStyle}>API Key</span>
            {savedBadge('ai_api_key')}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
            <input
              type={apiKeyFocused ? 'text' : 'password'}
              value={apiKeyInput}
              placeholder={settings['ai_api_key'] ? '••••••••••••••••' : 'Enter key…'}
              onChange={e => setApiKeyInput(e.target.value)}
              onFocus={() => setApiKeyFocused(true)}
              onBlur={() => setApiKeyFocused(false)}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${apiKeyFocused ? MX4_COLOR : COLORS.line}`,
                background: COLORS.surfaceElevated,
                color: COLORS.text,
                minWidth: 0,
                width: 160,
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                if (apiKeyInput.length > 0) {
                  save('ai_api_key', apiKeyInput)
                  setApiKeyInput('')
                } else {
                  testConn()
                }
              }}
              disabled={testStatus === 'testing'}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.06em',
                padding: '6px 11px',
                borderRadius: 7,
                border: `1px solid ${testButtonColor}`,
                background: hexA(testButtonColor, 0.12),
                color: testButtonColor,
                cursor: testStatus === 'testing' ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              {testButtonLabel}
            </button>
          </div>
        </div>
        {testStatus === 'error' && testError && (
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: COLORS.mx4Red,
            paddingBottom: 10,
            letterSpacing: '0.04em',
          }}>
            {testError}
          </div>
        )}
      </div>

      {/* Rail 2: MX-4 INTELLIGENCE */}
      <Rail label="MX-4 INTELLIGENCE" accent={MX4_COLOR} />

      <div style={cardStyle}>
        {/* Briefing model */}
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={labelStyle}>Briefing model</span>
            {savedBadge('mx4_briefing_model')}
          </div>
          <select
            value={settings['mx4_briefing_model'] ?? models[0] ?? ''}
            onChange={e => save('mx4_briefing_model', e.target.value)}
            style={selectStyle}
          >
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Chat model */}
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={labelStyle}>Chat model</span>
            {savedBadge('mx4_chat_model')}
          </div>
          <select
            value={settings['mx4_chat_model'] ?? models[0] ?? ''}
            onChange={e => save('mx4_chat_model', e.target.value)}
            style={selectStyle}
          >
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Nightly sync toggle + time input */}
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={labelStyle}>Nightly sync</span>
            {savedBadge('mx4_nightly_enabled')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {nightlySyncOn && (
              <input
                type="time"
                value={settings['mx4_nightly_time'] ?? '04:00'}
                onChange={e => save('mx4_nightly_time', e.target.value)}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  padding: '5px 8px',
                  borderRadius: 8,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.surfaceElevated,
                  color: COLORS.text,
                  outline: 'none',
                }}
              />
            )}
            <Toggle
              on={nightlySyncOn}
              onChange={v => save('mx4_nightly_enabled', String(v))}
            />
          </div>
        </div>

        {/* Sync on Garmin toggle */}
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={labelStyle}>Sync on Garmin</span>
            {savedBadge('mx4_on_sync_enabled')}
          </div>
          <Toggle
            on={syncOnGarminOn}
            onChange={v => save('mx4_on_sync_enabled', String(v))}
          />
        </div>

        {/* Chat compression threshold */}
        <div style={rowStyleLast}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={labelStyle}>Compress chat after</span>
            {savedBadge('mx4_chat_compression_threshold')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              min="10"
              max="100"
              value={settings['mx4_chat_compression_threshold'] ?? '20'}
              onChange={e => save('mx4_chat_compression_threshold', e.target.value)}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                padding: '5px 8px',
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.surfaceElevated,
                color: COLORS.text,
                outline: 'none',
                width: 60,
                textAlign: 'right' as const,
              }}
            />
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, letterSpacing: '0.08em' }}>
              MESSAGES
            </span>
          </div>
        </div>
      </div>

      {/* Rail 3: GARMIN */}
      <Rail label="GARMIN" accent={MX4_COLOR} />

      <div style={cardStyle}>
        <div style={rowStyleLast}>
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.12em',
            color: COLORS.textMuted,
          }}>
            SYNC PREFERENCES — COMING SOON
          </span>
        </div>
      </div>
    </AppShell>
  )
}
