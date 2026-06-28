import { ProviderTokens, tokensExpired } from '../shared/types'

const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const API_BASE  = 'https://api.prod.whoop.com'

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         'offline read:recovery read:sleep read:workout read:body_measurement',
    state,
  })
  return `https://api.prod.whoop.com/oauth/oauth2/auth?${p}`
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
  })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error(`Whoop token exchange failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + d.expires_in }
}

export async function refreshTokens(
  clientId: string, clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  if (!tokensExpired(tokens)) return tokens
  const body = new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId, client_secret: clientSecret,
  })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error(`Whoop token refresh failed: ${res.status}`)
  const d = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + d.expires_in }
}

export interface WhoopRecovery {
  created_at:  string
  score_state: string
  score: {
    recovery_score:     number
    resting_heart_rate: number
    hrv_rmssd_milli:    number
  } | null
}

export interface WhoopSleep {
  start:       string
  end:         string
  nap:         boolean
  score_state: string
  score: {
    stage_summary: {
      total_in_bed_time_milli:          number
      total_awake_time_milli:           number
      total_light_sleep_time_milli:     number
      total_slow_wave_sleep_time_milli: number
      total_rem_sleep_time_milli:       number
    }
    respiratory_rate: number
  } | null
}

export interface WhoopWorkout {
  id:          string
  start:       string
  end:         string
  sport_id:    number
  score_state: string
  score: {
    average_heart_rate: number
    kilojoule:          number
    distance_meter?:    number
  } | null
}

export interface WhoopData {
  recovery: WhoopRecovery[]
  sleep:    WhoopSleep[]
  workouts: WhoopWorkout[]
}

async function fetchPaginated<T>(accessToken: string, path: string, start: string, end: string): Promise<T[]> {
  const all: T[] = []
  let nextToken: string | null = null
  do {
    const params = new URLSearchParams({ start, end, limit: '25' })
    if (nextToken) params.set('nextToken', nextToken)
    const res = await fetch(`${API_BASE}${path}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Whoop ${path} fetch failed: ${res.status}`)
    const data = await res.json() as { records: T[]; next_token: string | null }
    all.push(...data.records)
    nextToken = data.next_token
  } while (nextToken)
  return all
}

export async function fetchWhoopData(
  accessToken: string, startDate: string, endDate: string
): Promise<WhoopData> {
  const start = `${startDate}T00:00:00.000Z`
  const end   = `${endDate}T23:59:59.999Z`
  const [recovery, sleep, workouts] = await Promise.all([
    fetchPaginated<WhoopRecovery>(accessToken, '/v2/recovery',         start, end),
    fetchPaginated<WhoopSleep>   (accessToken, '/v2/activity/sleep',   start, end),
    fetchPaginated<WhoopWorkout> (accessToken, '/v2/activity/workout', start, end),
  ])
  return { recovery, sleep, workouts }
}
