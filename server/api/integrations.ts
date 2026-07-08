import { Router, Request, Response, RequestHandler } from 'express'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import path from 'path'
import db from '../db/client'
import { logEvent } from '../lib/logger'
import { getSetting, setSetting, PROVIDERS, Provider } from '../lib/settings'
import { isAuthConfigured, verifyToken, parseCookies, SESSION_COOKIE } from '../lib/auth'
import { encrypt, decrypt } from '../lib/integrations/shared/encryption'
import { ProviderTokens, daysAgo, toEpoch } from '../lib/integrations/shared/types'
import { getAuthUrl as stravaAuthUrl, exchangeCode as stravaExchange, refreshTokens as stravaRefresh, fetchActivities } from '../lib/integrations/strava/stravaService'
import { processActivities } from '../lib/integrations/strava/stravaProcessor'
import { fetchWorkoutsSince } from '../lib/integrations/hevy/hevyService'
import { processWorkouts } from '../lib/integrations/hevy/hevyProcessor'
import { getAuthUrl as ouraAuthUrl, exchangeCode as ouraExchange, refreshTokens as ouraRefresh, fetchOuraData } from '../lib/integrations/oura/ouraService'
import { processOuraData } from '../lib/integrations/oura/ouraProcessor'
import { getAuthUrl as whoopAuthUrl, exchangeCode as whoopExchange, refreshTokens as whoopRefresh, fetchWhoopData } from '../lib/integrations/whoop/whoopService'
import { processWhoopData } from '../lib/integrations/whoop/whoopProcessor'
import { getAuthUrl as polarAuthUrl, exchangeCode as polarExchange, refreshTokens as polarRefresh, fetchPolarData } from '../lib/integrations/polar/polarService'
import { processPolarData } from '../lib/integrations/polar/polarProcessor'
import { getAuthUrl as withingsAuthUrl, exchangeCode as withingsExchange, refreshTokens as withingsRefresh, fetchWithingsData } from '../lib/integrations/withings/withingsService'
import { processWithingsData } from '../lib/integrations/withings/withingsProcessor'

const router = Router()
const OAUTH_PROVIDERS = new Set<Provider>(['strava', 'polar', 'oura', 'whoop', 'withings'])

// Accepts BACTA_INTERNAL_TOKEN (for pollers) OR a valid session cookie.
// If BACTA_INTERNAL_TOKEN is configured, auth is always enforced for sync —
// unauthenticated requests must either present the token or a valid session.
function requireSyncAuth(req: Request, res: Response, next: () => void): void {
  const bearer   = (req.headers.authorization ?? '').replace('Bearer ', '')
  const internal = process.env.BACTA_INTERNAL_TOKEN ?? ''
  if (internal && bearer === internal) return next()
  // Auth bypass only applies when neither a PIN nor an internal token is configured
  if (!isAuthConfigured() && !internal) return next()
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  if (verifyToken(token)) return next()
  res.status(401).json({ error: 'Authentication required' })
}

function getTokens(provider: Provider): ProviderTokens | null {
  const raw = getSetting(`${provider}_tokens`)
  if (!raw) return null
  const plain = decrypt(raw)
  if (!plain) return null
  try { return JSON.parse(plain) as ProviderTokens } catch { return null }
}

function saveTokens(provider: Provider, tokens: ProviderTokens): void {
  setSetting(`${provider}_tokens`, encrypt(JSON.stringify(tokens)))
}

function isConnected(provider: Provider): boolean {
  const enabled = getSetting(`${provider}_enabled`)
  if (provider === 'garmin') return enabled === 'true'
  if (provider === 'hevy')   return enabled === 'true' && !!getSetting('hevy_api_key')
  return enabled === 'true' && !!getTokens(provider)
}

function addToSourcePriority(provider: Provider): void {
  try {
    const current: string[] = JSON.parse(getSetting('source_priority') ?? '["garmin"]')
    if (!current.includes(provider)) {
      setSetting('source_priority', JSON.stringify([...current, provider]))
    }
  } catch { /* leave unchanged */ }
}

function removeFromSourcePriority(provider: Provider): void {
  try {
    const current: string[] = JSON.parse(getSetting('source_priority') ?? '["garmin"]')
    setSetting('source_priority', JSON.stringify(current.filter(p => p !== provider)))
  } catch { /* leave unchanged */ }
}

function getRedirectUri(provider: Provider): string {
  const base = getSetting('base_url') || 'http://localhost:3001'
  return `${base}/api/integrations/${provider}/callback`
}

// GET /api/integrations/status — must be registered before /:provider routes
router.get('/status', (_req: Request, res: Response) => {
  const out: Record<string, { connected: boolean; lastSync: string | null }> = {}
  for (const p of PROVIDERS) {
    let lastSync = getSetting(`${p}_last_sync`) || null
    if (p === 'garmin' && !lastSync) {
      const row = db.prepare(`SELECT MAX(date) as d FROM health_snapshots WHERE source = 'garmin'`)
        .get() as { d: string | null }
      lastSync = row?.d ?? null
    }
    out[p] = { connected: isConnected(p), lastSync }
  }
  res.json(out)
})

// GET /api/integrations/:provider/status
router.get('/:provider/status', (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!PROVIDERS.includes(provider)) return void res.status(400).json({ error: 'Unknown provider' })
  res.json({
    connected: isConnected(provider),
    lastSync:  getSetting(`${provider}_last_sync`) || null,
    enabled:   getSetting(`${provider}_enabled`) === 'true',
  })
})

// GET /api/integrations/:provider/authorize
router.get('/:provider/authorize', (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!PROVIDERS.includes(provider))    return void res.status(400).json({ error: 'Unknown provider' })
  if (!OAUTH_PROVIDERS.has(provider))   return void res.status(400).json({ error: 'Provider uses API key, not OAuth' })

  const baseUrl  = getSetting('base_url')
  if (!baseUrl) return void res.status(400).json({ error: 'base_url not configured — set it in Settings first' })

  const clientId = getSetting(`${provider}_client_id`) ?? ''
  if (!clientId) return void res.status(400).json({ error: `${provider}_client_id not configured` })

  const state = randomUUID()
  setSetting(`${provider}_oauth_state`, encrypt(state))
  const redirectUri = getRedirectUri(provider)

  let url: string
  switch (provider) {
    case 'strava': url = stravaAuthUrl(clientId, redirectUri, state); break
    case 'oura':  url = ouraAuthUrl (clientId, redirectUri, state); break
    case 'whoop': url = whoopAuthUrl(clientId, redirectUri, state); break
    case 'polar':    url = polarAuthUrl   (clientId, redirectUri, state); break
    case 'withings': url = withingsAuthUrl(clientId, redirectUri, state); break
    default: return void res.status(400).json({ error: 'Provider not yet implemented' })
  }

  res.json({ url })
})

// POST /api/integrations/:provider/disconnect
router.post('/:provider/disconnect', (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!PROVIDERS.includes(provider)) return void res.status(400).json({ error: 'Unknown provider' })
  setSetting(`${provider}_tokens`,   '')
  setSetting(`${provider}_enabled`,  'false')
  setSetting(`${provider}_last_sync`, '')
  removeFromSourcePriority(provider)
  console.log(`[integrations] ${provider} disconnected`)
  res.json({ ok: true })
})

// POST /api/integrations/:provider/sync
router.post('/:provider/sync', requireSyncAuth, async (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!PROVIDERS.includes(provider)) return void res.status(400).json({ error: 'Unknown provider' })
  if (getSetting(`${provider}_enabled`) !== 'true') return void res.status(400).json({ error: 'Provider not connected' })

  try {
    const recordsWritten = await runSync(provider)
    setSetting(`${provider}_last_sync`, new Date().toISOString())
    res.json({ ok: true, provider, recordsWritten })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    console.error(`[integrations] ${provider} sync error:`, err)
    logEvent('integrations', 'error', `${provider} sync failed: ${message}`)
    res.status(500).json({ error: message })
  }
})

async function runSync(provider: Provider): Promise<number> {
  const since = daysAgo(30)

  switch (provider) {
    case 'garmin': {
      // Garmin is managed by the Python poller — fire and forget, return immediately
      const script = path.join(process.cwd(), 'scripts', 'garmin_poller.py')
      spawn('python3', [script], { stdio: 'ignore', detached: true }).unref()
      setSetting('garmin_last_sync', new Date().toISOString())
      return 0
    }

    case 'strava': {
      const tokens = getTokens('strava')
      if (!tokens) throw new Error('Strava not connected')
      const clientId     = getSetting('strava_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('strava_client_secret') ?? '') ?? ''
      const fresh = await stravaRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('strava', fresh)
      const activities = await fetchActivities(fresh.access_token, toEpoch(since))
      return processActivities(activities)
    }

    case 'hevy': {
      const apiKey = decrypt(getSetting('hevy_api_key') ?? '') ?? ''
      if (!apiKey) throw new Error('Hevy API key not configured')
      const workouts = await fetchWorkoutsSince(apiKey, since)
      return processWorkouts(workouts)
    }

    case 'oura': {
      const tokens = getTokens('oura')
      if (!tokens) throw new Error('Oura not connected')
      const clientId     = getSetting('oura_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('oura_client_secret') ?? '') ?? ''
      const fresh = await ouraRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('oura', fresh)
      const today = new Date().toISOString().slice(0, 10)
      const data  = await fetchOuraData(fresh.access_token, daysAgo(30), today)
      return processOuraData(data)
    }

    case 'whoop': {
      const tokens = getTokens('whoop')
      if (!tokens) throw new Error('Whoop not connected')
      const clientId     = getSetting('whoop_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('whoop_client_secret') ?? '') ?? ''
      const fresh = await whoopRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('whoop', fresh)
      const today = new Date().toISOString().slice(0, 10)
      const data  = await fetchWhoopData(fresh.access_token, daysAgo(30), today)
      return processWhoopData(data)
    }

    case 'polar': {
      const tokens = getTokens('polar')
      if (!tokens) throw new Error('Polar not connected')
      const clientId     = getSetting('polar_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('polar_client_secret') ?? '') ?? ''
      const fresh = await polarRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('polar', fresh)
      const today = new Date().toISOString().slice(0, 10)
      const data  = await fetchPolarData(fresh.access_token, daysAgo(30), today)
      return processPolarData(data)
    }

    case 'withings': {
      const tokens = getTokens('withings')
      if (!tokens) throw new Error('Withings not connected')
      const clientId     = getSetting('withings_client_id')     ?? ''
      const clientSecret = decrypt(getSetting('withings_client_secret') ?? '') ?? ''
      const fresh = await withingsRefresh(clientId, clientSecret, tokens)
      if (fresh !== tokens) saveTokens('withings', fresh)
      const today = new Date().toISOString().slice(0, 10)
      const groups = await fetchWithingsData(fresh.access_token, daysAgo(30), today)
      return processWithingsData(groups)
    }

    default:
      throw new Error(`Sync not yet implemented for ${provider}`)
  }
}

// OAuth callback — registered WITHOUT requireAuth in server/index.ts
// because the browser arrives here from an external redirect with no session cookie.
// CSRF protection: state parameter is verified against the stored oauth_state.
export const callbackHandler: RequestHandler = async (req: Request, res: Response) => {
  const provider = req.params.provider as Provider
  if (!OAUTH_PROVIDERS.has(provider)) {
    return void res.status(400).json({ error: 'Unknown OAuth provider' })
  }

  const { code, state, error } = req.query as Record<string, string>
  const baseUrl = getSetting('base_url') || ''

  if (error) {
    return void res.redirect(`${baseUrl}/#/settings?error=${provider}`)
  }
  if (!code || !state) {
    return void res.status(400).json({ error: 'Missing code or state' })
  }

  const rawState   = getSetting(`${provider}_oauth_state`)
  const savedState = rawState ? decrypt(rawState) : null
  if (!savedState || state !== savedState) {
    return void res.status(400).json({ error: 'State mismatch — possible CSRF' })
  }

  const clientId     = getSetting(`${provider}_client_id`)     ?? ''
  const clientSecret = decrypt(getSetting(`${provider}_client_secret`) ?? '') ?? ''
  const redirectUri  = getRedirectUri(provider)

  try {
    let tokens: ProviderTokens
    switch (provider) {
      case 'strava':
        tokens = await stravaExchange(clientId, clientSecret, code, redirectUri)
        break
      case 'oura':
        tokens = await ouraExchange(clientId, clientSecret, code, redirectUri)
        break
      case 'whoop':
        tokens = await whoopExchange(clientId, clientSecret, code, redirectUri)
        break
      case 'polar':
        tokens = await polarExchange(clientId, clientSecret, code, redirectUri)
        break
      case 'withings':
        tokens = await withingsExchange(clientId, clientSecret, code, redirectUri)
        break
      default:
        return void res.redirect(`${baseUrl}/#/settings?error=${provider}`)
    }

    saveTokens(provider, tokens)
    setSetting(`${provider}_enabled`, 'true')
    setSetting(`${provider}_oauth_state`, '')  // clear used state
    addToSourcePriority(provider)
    console.log(`[integrations] ${provider} connected successfully`)
    res.redirect(`${baseUrl}/#/settings?connected=${provider}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[integrations] ${provider} callback error:`, err)
    logEvent('integrations', 'error', `${provider} OAuth callback failed: ${message}`)
    res.redirect(`${baseUrl}/#/settings?error=${provider}`)
  }
}

export { router as integrationsRouter }
