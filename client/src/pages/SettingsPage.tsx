import { useState, useEffect } from 'react'
import { AppShell } from '../components/AppShell'
import { Rail } from '../components/viz/Rail'
import { SecurityRail } from '../components/SecurityRail'
import { APP_VERSION } from '../version'
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
  const [clearedKey, setClearedKey] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyFocused, setApiKeyFocused] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')
  const [skills, setSkills] = useState<Array<{ label: string; prompt: string }>>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [vaultTestStatus, setVaultTestStatus] = useState<TestStatus>('idle')
  const [vaultTestError, setVaultTestError] = useState('')
  const [vaultTestDetails, setVaultTestDetails] = useState<{ domains?: number; page_count?: number } | null>(null)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings)
    fetch('/api/settings/custom-skills').then(r => r.json()).then(d => setSkills(d.skills ?? []))
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

  async function saveSkills(updated: Array<{ label: string; prompt: string }>) {
    await fetch('/api/settings/mx4_custom_skills', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(updated) }),
    })
    setSkills(updated)
  }

  async function deleteSkill(index: number) {
    await saveSkills(skills.filter((_, i) => i !== index))
  }

  async function addSkill() {
    if (!newLabel.trim() || !newPrompt.trim()) return
    await saveSkills([...skills, { label: newLabel.trim(), prompt: newPrompt.trim() }])
    setNewLabel('')
    setNewPrompt('')
    setShowAddForm(false)
  }

  function startEdit(i: number) {
    setEditingIndex(i)
    setEditLabel(skills[i].label)
    setEditPrompt(skills[i].prompt)
    setShowAddForm(false)
  }

  async function saveEdit() {
    if (editingIndex === null || !editLabel.trim() || !editPrompt.trim()) return
    await saveSkills(skills.map((s, i) => i === editingIndex ? { label: editLabel.trim(), prompt: editPrompt.trim() } : s))
    setEditingIndex(null)
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

  const testVaultConn = async () => {
    setVaultTestStatus('testing')
    setVaultTestError('')
    setVaultTestDetails(null)
    try {
      const res = await fetch('/api/settings/test-vault-connection', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setVaultTestStatus('ok')
        setVaultTestDetails(data.details ?? null)
        setTimeout(() => setVaultTestStatus('idle'), 5000)
      } else {
        setVaultTestStatus('error')
        setVaultTestError(data.error ?? 'Unknown error')
      }
    } catch {
      setVaultTestStatus('error')
      setVaultTestError('Network error')
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

  async function clearData(endpoint: string, key: string, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return
    await fetch(endpoint, { method: 'DELETE' })
    setClearedKey(key)
    setTimeout(() => setClearedKey(null), 2500)
  }

  const vaultEnabled = settings['vault_enabled'] === 'true'
  const nightlySyncOn = settings['mx4_nightly_enabled'] === 'true'
  const syncOnGarminOn = settings['mx4_on_sync_enabled'] === 'true'
  const homeRerunAll = settings['mx4_home_rerun_mode'] === 'all_sections'

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
        <div style={rowStyle}>
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

        {/* Home re-run mode toggle */}
        <div style={rowStyleLast}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={labelStyle}>Home re-run includes all sections</span>
              {savedBadge('mx4_home_rerun_mode')}
            </div>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, letterSpacing: '0.08em' }}>
              When off, uses cached briefings
            </span>
          </div>
          <Toggle
            on={homeRerunAll}
            onChange={v => save('mx4_home_rerun_mode', v ? 'all_sections' : 'home_only')}
          />
        </div>
      </div>

      {/* Rail 3: VAULT */}
      <Rail label="VAULT" accent={MX4_COLOR} />

      <div style={cardStyle}>
        <div style={vaultEnabled ? rowStyle : rowStyleLast}>
          <span style={labelStyle}>Connect LLM-Wiki</span>
          <Toggle
            on={vaultEnabled}
            onChange={v => save('vault_enabled', String(v))}
          />
        </div>

        {vaultEnabled && (
          <>
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <span style={labelStyle}>Vault URL</span>
                {savedBadge('vault_url')}
              </div>
              <input
                type="text"
                placeholder="http://192.168.1.x:8765"
                value={settings['vault_url'] ?? ''}
                onChange={e => setSettings(prev => ({ ...prev, vault_url: e.target.value }))}
                onBlur={e => save('vault_url', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save('vault_url', (e.target as HTMLInputElement).value) }}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 16,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.surfaceElevated,
                  color: COLORS.text,
                  outline: 'none',
                  width: 190,
                  minWidth: 0,
                }}
              />
            </div>

            <div style={rowStyleLast}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={testVaultConn}
                  disabled={vaultTestStatus === 'testing'}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: `1px solid ${
                      vaultTestStatus === 'ok' ? COLORS.mx4Green :
                      vaultTestStatus === 'error' ? COLORS.mx4Red :
                      MX4_COLOR
                    }`,
                    background: 'none',
                    color:
                      vaultTestStatus === 'ok' ? COLORS.mx4Green :
                      vaultTestStatus === 'error' ? COLORS.mx4Red :
                      MX4_COLOR,
                    cursor: vaultTestStatus === 'testing' ? 'default' : 'pointer',
                  }}
                >
                  {vaultTestStatus === 'testing' ? 'TESTING…' :
                   vaultTestStatus === 'ok' ? '✓ CONNECTED' :
                   vaultTestStatus === 'error' ? '✗ FAILED' :
                   'TEST CONNECTION'}
                </button>
                {vaultTestStatus === 'ok' && vaultTestDetails && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, letterSpacing: '0.08em' }}>
                    {vaultTestDetails.domains} DOMAINS · {vaultTestDetails.page_count} PAGES
                  </span>
                )}
                {vaultTestStatus === 'error' && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.mx4Red, letterSpacing: '0.06em' }}>
                    {vaultTestError}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Rail 4: CUSTOM SKILLS */}
      <Rail label="CUSTOM SKILLS" accent={MX4_COLOR} />

      <div style={cardStyle}>
        {skills.map((skill, i) => {
          const isLocked = i === 0
          const isLast = i === skills.length - 1
          const isEditing = editingIndex === i

          if (isEditing) {
            return (
              <div key={i} style={{ padding: '12px 0', borderBottom: isLast && !showAddForm ? 'none' : `1px solid ${COLORS.line}` }}>
                <input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  placeholder="LABEL"
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 16,
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: `1px solid ${COLORS.line}`,
                    background: COLORS.surfaceElevated,
                    color: COLORS.text,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box' as const,
                    marginBottom: 8,
                  }}
                />
                <textarea
                  value={editPrompt}
                  onChange={e => setEditPrompt(e.target.value)}
                  rows={3}
                  style={{
                    fontFamily: FONT_UI,
                    fontSize: 16,
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: `1px solid ${COLORS.line}`,
                    background: COLORS.surfaceElevated,
                    color: COLORS.text,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box' as const,
                    resize: 'vertical' as const,
                    marginBottom: 10,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setEditingIndex(null)}
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      padding: '5px 12px',
                      borderRadius: 7,
                      border: `1px solid ${COLORS.line}`,
                      background: COLORS.surfaceElevated,
                      color: COLORS.textSecondary,
                      cursor: 'pointer',
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={!editLabel.trim() || !editPrompt.trim()}
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      padding: '5px 12px',
                      borderRadius: 7,
                      border: `1px solid ${MX4_COLOR}`,
                      background: hexA(MX4_COLOR, 0.12),
                      color: MX4_COLOR,
                      cursor: !editLabel.trim() || !editPrompt.trim() ? 'default' : 'pointer',
                    }}
                  >
                    SAVE ›
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div key={i} style={isLast && !showAddForm ? rowStyleLast : rowStyle}>
              <span style={{ ...labelStyle, fontFamily: FONT_MONO, fontSize: 12, color: COLORS.text }}>
                {skill.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => startEdit(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    color: COLORS.textMuted,
                    flexShrink: 0,
                  }}
                >
                  EDIT
                </button>
                {!isLocked && (
                  <button
                    onClick={() => deleteSkill(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 6px',
                      cursor: 'pointer',
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      color: COLORS.mx4Red,
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {showAddForm ? (
          <div style={{ padding: '12px 0' }}>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="LABEL"
              style={{
                fontFamily: FONT_MONO,
                fontSize: 16,
                padding: '7px 10px',
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.surfaceElevated,
                color: COLORS.text,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box' as const,
                marginBottom: 8,
              }}
            />
            <textarea
              value={newPrompt}
              onChange={e => setNewPrompt(e.target.value)}
              placeholder="Full prompt text…"
              rows={3}
              style={{
                fontFamily: FONT_UI,
                fontSize: 16,
                padding: '7px 10px',
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.surfaceElevated,
                color: COLORS.text,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box' as const,
                resize: 'vertical' as const,
                marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAddForm(false); setNewLabel(''); setNewPrompt('') }}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.surfaceElevated,
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={addSkill}
                disabled={!newLabel.trim() || !newPrompt.trim()}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: `1px solid ${MX4_COLOR}`,
                  background: hexA(MX4_COLOR, 0.12),
                  color: MX4_COLOR,
                  cursor: !newLabel.trim() || !newPrompt.trim() ? 'default' : 'pointer',
                }}
              >
                SAVE ›
              </button>
            </div>
          </div>
        ) : (
          <div style={rowStyleLast}>
            <span />
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                cursor: 'pointer',
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.1em',
                color: MX4_COLOR,
              }}
            >
              ADD SKILL ›
            </button>
          </div>
        )}
      </div>

      {/* Rail 4: DATA MANAGEMENT */}
      <Rail label="DATA MANAGEMENT" accent={COLORS.mx4Red} />

      <div style={cardStyle}>
        {[
          {
            key: 'chat',
            label: 'Clear chat history',
            endpoint: '/api/mx4/chat',
            confirm: 'Clear all MX-4 chat messages?\n\nThis permanently deletes every message in the current and all past sessions. MX-4 will have no memory of previous conversations.',
          },
          {
            key: 'wiki-patterns',
            label: 'Clear wiki pattern pages',
            endpoint: '/api/mx4/wiki/patterns',
            confirm: 'Reset MX-4 wiki pattern pages?\n\nThis erases all learned HRV patterns, sleep patterns, training patterns, correlations, and weekly observations. Your profile (name, age, goals) is preserved. MX-4 will rebuild patterns over time.',
          },
          {
            key: 'wiki-all',
            label: 'Clear full wiki',
            endpoint: '/api/mx4/wiki/all',
            confirm: 'Reset the full MX-4 wiki?\n\nThis erases ALL accumulated knowledge including your profile. MX-4 will start completely fresh with no memory of patterns, baselines, or identity context. This cannot be undone.',
          },
        ].map(({ key, label, endpoint, confirm }, i, arr) => (
          <div key={key} style={i < arr.length - 1 ? rowStyle : rowStyleLast}>
            <span style={{ ...labelStyle, color: COLORS.text }}>{label}</span>
            <button
              onClick={() => clearData(endpoint, key, confirm)}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.08em',
                padding: '5px 12px',
                borderRadius: 7,
                border: `1px solid ${clearedKey === key ? COLORS.mx4Green : hexA(COLORS.mx4Red, 0.5)}`,
                background: hexA(clearedKey === key ? COLORS.mx4Green : COLORS.mx4Red, 0.1),
                color: clearedKey === key ? COLORS.mx4Green : COLORS.mx4Red,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {clearedKey === key ? 'CLEARED ·' : 'CLEAR ›'}
            </button>
          </div>
        ))}
      </div>

      <SecurityRail />

      {/* Rail 5: GARMIN */}
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

      <div style={{
        textAlign: 'center', padding: '20px 0 8px',
        fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.12em', color: COLORS.textMuted,
      }}>
        BACTA·OS v{APP_VERSION}
      </div>
    </AppShell>
  )
}
