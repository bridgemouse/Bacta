import { ProviderTokens, tokensExpired } from '../shared/types'

const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2'
const MEASURE_URL = 'https://wbsapi.withings.net/measure'

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         'user.info,user.metrics',
    state,
  })
  return `https://account.withings.com/oauth2_user/authorize2?${p.toString()}`
}

async function tokenRequest(body: URLSearchParams): Promise<ProviderTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Withings token request failed: ${res.status}`)
  const d = await res.json() as { status: number; body: { access_token: string; refresh_token: string; expires_in: number } }
  if (d.status !== 0) throw new Error(`Withings token error status: ${d.status}`)
  return {
    access_token:  d.body.access_token,
    refresh_token: d.body.refresh_token,
    expires_at:    Math.floor(Date.now() / 1000) + d.body.expires_in,
  }
}

export async function exchangeCode(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<ProviderTokens> {
  return tokenRequest(new URLSearchParams({
    action:        'requesttoken',
    grant_type:    'authorization_code',
    client_id:     clientId,
    client_secret: clientSecret,
    code,
    redirect_uri:  redirectUri,
  }))
}

export async function refreshTokens(
  clientId: string, clientSecret: string, tokens: ProviderTokens
): Promise<ProviderTokens> {
  if (!tokensExpired(tokens)) return tokens
  return tokenRequest(new URLSearchParams({
    action:        'requesttoken',
    grant_type:    'refresh_token',
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
  }))
}

export interface WithingsMeasure {
  value: number
  type:  number
  unit:  number
}

export interface WithingsMeasureGroup {
  date:     number  // Unix epoch
  measures: WithingsMeasure[]
}

export async function fetchWithingsData(
  accessToken: string, startDate: string, endDate: string
): Promise<WithingsMeasureGroup[]> {
  const startEpoch = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)
  const endEpoch   = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000)

  const body = new URLSearchParams({
    action:    'getmeas',
    meastype:  '1,11,54',
    startdate: String(startEpoch),
    enddate:   String(endEpoch),
    category:  '1',
  })

  const res = await fetch(MEASURE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Withings measure failed: ${res.status}`)
  const d = await res.json() as { status: number; body: { measuregrps: WithingsMeasureGroup[] } }
  if (d.status !== 0) throw new Error(`Withings measure error status: ${d.status}`)
  return d.body.measuregrps ?? []
}
