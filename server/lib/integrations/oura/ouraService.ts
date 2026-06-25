import { ProviderTokens, tokensExpired } from '../shared/types'

const TOKEN_URL = 'https://api.ouraring.com/oauth/token'
const API_BASE  = 'https://api.ouraring.com'

function basicAuth(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         'daily sleep heartrate workout personal',
    state,
  })
  return `https://cloud.ouraring.com/oauth/authorize?${p}`
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { Authorization: basicAuth(clientId, clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error(`Oura token exchange failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + d.expires_in }
}

export async function refreshTokens(
  clientId: string, clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  if (!tokensExpired(tokens)) return tokens
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { Authorization: basicAuth(clientId, clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error(`Oura token refresh failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + d.expires_in }
}

export interface OuraDailySleep {
  day:                  string
  score:                number | null
  average_hrv:          number | null
  average_breath:       number | null
  total_sleep_duration: number | null
  deep_sleep_duration:  number | null
  light_sleep_duration: number | null
  rem_sleep_duration:   number | null
  average_saturation:   number | null
}

export interface OuraDailyReadiness {
  day:                string
  score:              number | null
  resting_heart_rate: number | null
}

export interface OuraDailyActivity {
  day:   string
  steps: number | null
}

export interface OuraData {
  sleep:     OuraDailySleep[]
  readiness: OuraDailyReadiness[]
  activity:  OuraDailyActivity[]
}

async function fetchCollection<T>(accessToken: string, path: string, startDate: string, endDate: string): Promise<T[]> {
  const all: T[] = []
  let nextToken: string | null = null
  do {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
    if (nextToken) params.set('next_token', nextToken)
    const res = await fetch(`${API_BASE}${path}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Oura ${path} fetch failed: ${res.status}`)
    const data = await res.json() as { data: T[]; next_token: string | null }
    all.push(...data.data)
    nextToken = data.next_token
  } while (nextToken)
  return all
}

export async function fetchOuraData(accessToken: string, startDate: string, endDate: string): Promise<OuraData> {
  const [sleep, readiness, activity] = await Promise.all([
    fetchCollection<OuraDailySleep>    (accessToken, '/v2/usercollection/daily_sleep',     startDate, endDate),
    fetchCollection<OuraDailyReadiness>(accessToken, '/v2/usercollection/daily_readiness', startDate, endDate),
    fetchCollection<OuraDailyActivity> (accessToken, '/v2/usercollection/daily_activity',  startDate, endDate),
  ])
  return { sleep, readiness, activity }
}
