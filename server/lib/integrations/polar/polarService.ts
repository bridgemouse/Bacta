import { ProviderTokens } from '../shared/types'

const BASE_ACCESSLINK = 'https://www.polaraccesslink.com'

function basicAuth(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    state,
  })
  return `https://flow.polar.com/oauth2/authorization?${p.toString()}`
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
  const res = await fetch('https://polarremote.com/v2/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization':  basicAuth(clientId, clientSecret),
      'Content-Type':   'application/x-www-form-urlencoded',
      'Accept':         'application/json',
    },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Polar token exchange failed: ${res.status}`)
  const d = await res.json() as { access_token: string; token_type: string; x_user_id: number }

  // Register user — 409 = already registered = OK
  const regRes = await fetch(`${BASE_ACCESSLINK}/v3/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${d.access_token}`,
      'Content-Type':  'application/xml',
      'Accept':        'application/json',
    },
    body: `<?xml version="1.0" encoding="UTF-8"?><register><member-id>${d.x_user_id}</member-id></register>`,
  })
  if (!regRes.ok && regRes.status !== 409) {
    throw new Error(`Polar user registration failed: ${regRes.status}`)
  }

  const tenYears = 10 * 365 * 24 * 3600
  return {
    access_token:  d.access_token,
    refresh_token: '',
    expires_at:    Math.floor(Date.now() / 1000) + tenYears,
  }
}

// Polar tokens are long-lived — no refresh needed
export async function refreshTokens(
  _clientId: string, _clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  return tokens
}

export interface PolarExercise {
  id:           string
  start_time:   string
  duration:     string  // ISO 8601 duration: "PT1H0M0S"
  sport:        string
  distance:     number | null
  heart_rate:   { average: number } | null
  calories:     number | null
}

export interface PolarNight {
  date:          string
  sleep_summary: {
    total_sleep_time:    number | null
    deep_sleep_time:     number | null
    light_sleep_time:    number | null
    rem_time:            number | null
    sleep_score:         number | null
    breathing_rate_avg:  number | null
    heart_rate:          { average: number } | null
  }
}

export interface PolarRecharge {
  date:                          string
  heart_rate_avg:                number | null
  heart_rate_variability_sdnn:   number | null
}

export interface PolarData {
  exercises: PolarExercise[]
  nights:    PolarNight[]
  recharges: PolarRecharge[]
}

async function getCollection<T>(accessToken: string, path: string, startDate: string, endDate: string, key: string): Promise<T[]> {
  const p = new URLSearchParams({ date_start: startDate, date_end: endDate })
  const res = await fetch(`${BASE_ACCESSLINK}${path}?${p.toString()}`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Polar ${path} failed: ${res.status}`)
  const d = await res.json() as Record<string, T[]>
  return d[key] ?? []
}

export async function fetchPolarData(accessToken: string, startDate: string, endDate: string): Promise<PolarData> {
  const [exercises, nights, recharges] = await Promise.all([
    getCollection<PolarExercise>(accessToken, '/v3/exercises',              startDate, endDate, 'exercises'),
    getCollection<PolarNight>   (accessToken, '/v3/users/sleep',            startDate, endDate, 'nights'),
    getCollection<PolarRecharge>(accessToken, '/v3/users/nightly-recharge', startDate, endDate, 'recharges'),
  ])
  // Filter exercises by start_time (exercises endpoint may not support date_start)
  const filtered = exercises.filter(e => e.start_time >= `${startDate}T00:00:00`)
  return { exercises: filtered, nights, recharges }
}
