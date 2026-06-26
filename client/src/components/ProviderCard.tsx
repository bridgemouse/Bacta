import { COLORS, FONT_MONO, FONT_UI, MX4_COLOR } from '../theme'
import { hexA } from '../lib/hexA'

const PROVIDER_LABELS: Record<string, string> = {
  strava: 'STRAVA',
  hevy: 'HEVY',
  oura: 'OURA',
  whoop: 'WHOOP',
  polar: 'POLAR',
  withings: 'WITHINGS',
}

export type ProviderSyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export interface ProviderCardProps {
  provider: string
  isOAuth: boolean
  connected: boolean
  lastSync: string | null
  clientId: string
  clientSecret: string
  apiKey: string
  onClientIdChange: (v: string) => void
  onClientSecretChange: (v: string) => void
  onApiKeyChange: (v: string) => void
  onConnect: () => void
  onDisconnect: () => void
  onSync: () => void
  syncStatus: ProviderSyncStatus
  syncError: string
  connectError: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: FONT_MONO,
  fontSize: 11,
  padding: '7px 10px',
  marginTop: 8,
  borderRadius: 8,
  border: `1px solid ${COLORS.line}`,
  background: COLORS.base,
  color: COLORS.text,
  outline: 'none',
  boxSizing: 'border-box',
}

const btnBase: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9,
  letterSpacing: '0.1em',
  padding: '6px 14px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
}

export function ProviderCard({
  provider,
  isOAuth,
  connected,
  lastSync,
  clientId,
  clientSecret,
  apiKey,
  onClientIdChange,
  onClientSecretChange,
  onApiKeyChange,
  onConnect,
  onDisconnect,
  onSync,
  syncStatus,
  syncError,
  connectError,
}: ProviderCardProps) {
  const label = PROVIDER_LABELS[provider] ?? provider.toUpperCase()

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div
      data-testid={`provider-card-${provider}`}
      style={{
        background: COLORS.surfaceElevated,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 8,
        border: `1px solid ${connected ? hexA(MX4_COLOR, 0.35) : COLORS.line}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: '0.12em',
          fontWeight: 600,
          color: connected ? MX4_COLOR : COLORS.textSecondary,
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          letterSpacing: '0.08em',
          color: connected ? COLORS.mx4Green : COLORS.textMuted,
        }}>
          {connected ? '● CONNECTED' : '○ DISCONNECTED'}
        </span>
      </div>

      {connected ? (
        <div>
          {lastSyncLabel && (
            <div style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              color: COLORS.textMuted,
              marginTop: 6,
            }}>
              LAST SYNC {lastSyncLabel}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={onSync}
              disabled={syncStatus === 'syncing'}
              style={{
                ...btnBase,
                background: syncStatus === 'synced'
                  ? hexA(COLORS.mx4Green, 0.15)
                  : hexA(MX4_COLOR, 0.15),
                color: syncStatus === 'synced' ? COLORS.mx4Green : MX4_COLOR,
                opacity: syncStatus === 'syncing' ? 0.6 : 1,
              }}
            >
              {syncStatus === 'syncing' ? 'SYNCING…' : syncStatus === 'synced' ? 'SYNCED ✓' : 'SYNC NOW'}
            </button>
            <button
              onClick={onDisconnect}
              style={{
                ...btnBase,
                background: hexA(COLORS.mx4Red, 0.1),
                color: COLORS.mx4Red,
              }}
            >
              DISCONNECT
            </button>
          </div>
          {syncError && (
            <div style={{
              fontFamily: FONT_UI,
              fontSize: 11,
              color: COLORS.mx4Red,
              marginTop: 6,
            }}>
              {syncError}
            </div>
          )}
        </div>
      ) : (
        <div>
          {isOAuth ? (
            <>
              <input
                placeholder="Client ID"
                value={clientId}
                onChange={e => onClientIdChange(e.target.value)}
                style={inputStyle}
                autoComplete="off"
              />
              <input
                type="password"
                placeholder="Client Secret"
                value={clientSecret}
                onChange={e => onClientSecretChange(e.target.value)}
                style={inputStyle}
                autoComplete="new-password"
              />
            </>
          ) : (
            <input
              type="password"
              placeholder="API Key"
              value={apiKey}
              onChange={e => onApiKeyChange(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
            />
          )}
          <button
            onClick={onConnect}
            style={{
              ...btnBase,
              marginTop: 10,
              background: hexA(MX4_COLOR, 0.15),
              color: MX4_COLOR,
            }}
          >
            CONNECT
          </button>
          {connectError && (
            <div style={{
              fontFamily: FONT_UI,
              fontSize: 11,
              color: COLORS.mx4Red,
              marginTop: 6,
            }}>
              {connectError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
