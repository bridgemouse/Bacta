import { ProviderTokens, tokensExpired } from '../shared/types'

const TOKEN_URL = 'https://www.strava.com/oauth/token'
const API_BASE  = 'https://www.strava.com/api/v3'

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id:       clientId,
    redirect_uri:    redirectUri,
    response_type:   'code',
    approval_prompt: 'auto',
    scope:           'read,activity:read_all,profile:read_all',
    state,
  })
  return `https://www.strava.com/oauth/authorize?${p}`
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
  })
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_at: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at }
}

export async function refreshTokens(
  clientId: string, clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  if (!tokensExpired(tokens)) return tokens
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }),
  })
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_at: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at }
}

export interface StravaActivity {
  id:                   number
  name:                 string
  sport_type:           string
  start_date_local:     string   // ISO 8601 local e.g. '2026-06-20T07:00:00'
  distance:             number   // metres
  moving_time:          number   // seconds
  total_elevation_gain: number   // metres
  average_heartrate?:   number
  kilojoules?:          number
}

export async function fetchActivities(accessToken: string, afterEpoch: number): Promise<StravaActivity[]> {
  const all: StravaActivity[] = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({ after: String(afterEpoch), per_page: '100', page: String(page) })
    const res = await fetch(`${API_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`)
    const batch = await res.json() as StravaActivity[]
    if (batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
    page++
    await new Promise(r => setTimeout(r, 500))
  }

  return all
}
